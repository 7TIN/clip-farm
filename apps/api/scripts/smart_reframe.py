import argparse
import json
import sys
import os


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def even(value):
    return max(2, int(value) // 2 * 2)


def moving_average(values, radius=3):
    smoothed = []
    for index in range(len(values)):
        start = max(0, index - radius)
        end = min(len(values), index + radius + 1)
        window = values[start:end]
        smoothed.append(sum(window) / len(window))
    return smoothed


def crop_size(source_width, source_height, target_width, target_height):
    source_ratio = source_width / source_height
    target_ratio = target_width / target_height

    if source_ratio > target_ratio:
        crop_height = source_height
        crop_width = even(crop_height * target_ratio)
    else:
        crop_width = source_width
        crop_height = even(crop_width / target_ratio)

    return crop_width, crop_height


def main():
    parser = argparse.ArgumentParser(description="Detect faces and emit crop metadata for Clip Farm.")
    parser.add_argument("--video-path", required=True)
    parser.add_argument("--target-width", type=int, required=True)
    parser.add_argument("--target-height", type=int, required=True)
    parser.add_argument("--sample-interval-ms", type=int, default=500)
    parser.add_argument(
        "--model-path",
        default=os.path.join(os.path.dirname(__file__), "../models/blaze_face_short_range.tflite"),
    )
    args = parser.parse_args()

    try:
        import cv2
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision as mp_vision
    except ImportError as error:
        print(
            "Missing Python CV dependency. Install opencv-python and mediapipe, "
            "or use normal FFmpeg reframe mode. "
            f"Details: {error}",
            file=sys.stderr,
        )
        return 1

    model_path = os.path.abspath(args.model_path)
    if not os.path.exists(model_path):
        print(
            f"Face detector model not found at: {model_path}\n"
            "Run setup:python-first to download it.",
            file=sys.stderr,
        )
        return 1

    cap = cv2.VideoCapture(args.video_path)
    if not cap.isOpened():
        print(f"Could not open video: {args.video_path}", file=sys.stderr)
        return 1

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    source_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    source_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    sample_every = max(1, int(round(fps * args.sample_interval_ms / 1000)))
    crop_width, crop_height = crop_size(
        source_width, source_height, args.target_width, args.target_height
    )

    max_x = max(0, source_width - crop_width)
    max_y = max(0, source_height - crop_height)
    center_x = max_x / 2
    center_y = max_y / 2
    entries = []

    # New Tasks API setup
    base_options = mp_python.BaseOptions(model_asset_path=model_path)
    options = mp_vision.FaceDetectorOptions(
        base_options=base_options,
        min_detection_confidence=0.5,
    )

    with mp_vision.FaceDetector.create_from_options(options) as detector:
        frame_index = 0

        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame_index % sample_every != 0:
                frame_index += 1
                continue

            # New API uses mediapipe Image, not raw numpy
            import mediapipe as mp
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = detector.detect(mp_image)

            selected = None
            confidence = 0

            if result.detections:
                # Pick the largest face by bounding box area
                selected = max(
                    result.detections,
                    key=lambda d: (
                        d.bounding_box.width * d.bounding_box.height
                    ),
                )
                confidence = selected.categories[0].score if selected.categories else 0

            if selected:
                box = selected.bounding_box
                # New API gives absolute pixel coords, not relative
                face_center_x = box.origin_x + box.width / 2
                face_center_y = box.origin_y + box.height / 2
                x = clamp(face_center_x - crop_width / 2, 0, max_x)
                y = clamp(face_center_y - crop_height / 2, 0, max_y)
            else:
                x = center_x
                y = center_y

            time_ms = int(round((frame_index / fps) * 1000))
            entries.append({
                "time_ms": time_ms,
                "x": x,
                "y": y,
                "width": crop_width,
                "height": crop_height,
                "confidence": confidence,
            })
            frame_index += 1

    cap.release()

    if not entries:
        entries.append({
            "time_ms": 0,
            "x": center_x,
            "y": center_y,
            "width": crop_width,
            "height": crop_height,
            "confidence": 0,
        })

    smoothed_x = moving_average([e["x"] for e in entries])
    smoothed_y = moving_average([e["y"] for e in entries])

    for index, entry in enumerate(entries):
        entry["x"] = int(round(clamp(smoothed_x[index], 0, max_x)))
        entry["y"] = int(round(clamp(smoothed_y[index], 0, max_y)))

    output = {
        "source_width": source_width,
        "source_height": source_height,
        "target_width": args.target_width,
        "target_height": args.target_height,
        "crop_width": crop_width,
        "crop_height": crop_height,
        "frame_count": frame_count,
        "entries": entries,
    }
    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())