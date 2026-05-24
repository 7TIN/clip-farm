import argparse
import json
import os
import statistics
import sys


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def even(value):
    return max(2, int(value) // 2 * 2)


def crop_size(source_width, source_height, target_width, target_height):
    source_ratio = source_width / source_height
    target_ratio = target_width / target_height

    if source_ratio > target_ratio:
        height = source_height
        width = even(height * target_ratio)
    else:
        width = source_width
        height = even(width / target_ratio)

    return width, height


def crop_for_center(center_x, center_y, crop_width, crop_height, source_width, source_height):
    max_x = max(0, source_width - crop_width)
    max_y = max(0, source_height - crop_height)
    return {
        "x": int(round(clamp(center_x - crop_width / 2, 0, max_x))),
        "y": int(round(clamp(center_y - crop_height / 2, 0, max_y))),
        "width": crop_width,
        "height": crop_height,
    }


def side_for_detection(detection, source_width, source_height):
    if source_width >= source_height:
        return "left" if detection["center_x"] < source_width / 2 else "right"
    return "top" if detection["center_y"] < source_height / 2 else "bottom"


def median_center(detections):
    return (
        statistics.median([d["center_x"] for d in detections]),
        statistics.median([d["center_y"] for d in detections]),
    )


def detect_faces(video_path, model_path, sample_interval_ms, min_confidence):
    try:
        import cv2
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision as mp_vision
    except ImportError as error:
        print(
            "Missing Python CV dependency. Install opencv-python and mediapipe, "
            f"or use normal FFmpeg reframe mode. Details: {error}",
            file=sys.stderr,
        )
        return 1, None

    if not os.path.exists(model_path):
        print(
            f"Face detector model not found at: {model_path}\n"
            "Run setup:python-first to download it.",
            file=sys.stderr,
        )
        return 1, None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Could not open video: {video_path}", file=sys.stderr)
        return 1, None

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    source_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    source_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    sample_every = max(1, int(round(fps * sample_interval_ms / 1000)))
    frames = []

    base_options = mp_python.BaseOptions(model_asset_path=model_path)
    options = mp_vision.FaceDetectorOptions(
        base_options=base_options,
        min_detection_confidence=min_confidence,
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

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = detector.detect(mp_image)
            detections = []

            for item in result.detections or []:
                if not item.categories:
                    continue

                confidence = item.categories[0].score
                if confidence < min_confidence:
                    continue

                box = item.bounding_box
                width = max(1, box.width)
                height = max(1, box.height)
                detections.append(
                    {
                        "center_x": box.origin_x + width / 2,
                        "center_y": box.origin_y + height / 2,
                        "width": width,
                        "height": height,
                        "area": width * height,
                        "confidence": confidence,
                    }
                )

            detections.sort(key=lambda d: d["area"], reverse=True)
            time_ms = int(round((frame_index / fps) * 1000))
            frames.append({"time_ms": time_ms, "detections": detections})
            frame_index += 1

    cap.release()
    return 0, {
        "source_width": source_width,
        "source_height": source_height,
        "frame_count": frame_count,
        "frames": frames,
    }


def stable_single_entries(frames, source_width, source_height, crop_width, crop_height, args):
    center_x = source_width / 2
    center_y = source_height / 2
    current_crop = crop_for_center(
        center_x,
        center_y,
        crop_width,
        crop_height,
        source_width,
        source_height,
    )
    current_side = None
    pending_side = None
    pending_since = None
    min_move_x = crop_width * args.min_move
    min_move_y = crop_height * args.min_move
    entries = []

    for frame in frames:
        detections = frame["detections"]
        if not detections:
            pending_side = None
            pending_since = None
            continue

        selected = detections[0]
        selected_side = side_for_detection(selected, source_width, source_height)

        if current_side is None:
            current_side = selected_side
            current_crop = crop_for_center(
                selected["center_x"],
                selected["center_y"],
                crop_width,
                crop_height,
                source_width,
                source_height,
            )
            entries.append(
                {
                    "time_ms": 0,
                    **current_crop,
                    "confidence": selected["confidence"],
                }
            )
            continue

        if selected_side == current_side:
            pending_side = None
            pending_since = None
            continue

        if pending_side != selected_side:
            pending_side = selected_side
            pending_since = frame["time_ms"]
            continue

        if frame["time_ms"] - (pending_since or frame["time_ms"]) < args.switch_hold_ms:
            continue

        next_crop = crop_for_center(
            selected["center_x"],
            selected["center_y"],
            crop_width,
            crop_height,
            source_width,
            source_height,
        )

        if (
            abs(next_crop["x"] - current_crop["x"]) < min_move_x
            and abs(next_crop["y"] - current_crop["y"]) < min_move_y
        ):
            continue

        start_time = frame["time_ms"]
        end_time = frame["time_ms"] + args.transition_ms
        entries.append(
            {
                "time_ms": start_time,
                **current_crop,
                "confidence": selected["confidence"],
            }
        )
        entries.append(
            {
                "time_ms": end_time,
                **next_crop,
                "confidence": selected["confidence"],
            }
        )
        current_crop = next_crop
        current_side = selected_side
        pending_side = None
        pending_since = None

    if not entries:
        entries.append(
            {
                "time_ms": 0,
                **current_crop,
                "confidence": 0,
            }
        )

    return collapse_duplicate_entries(entries)


def collapse_duplicate_entries(entries):
    cleaned = []
    for entry in entries:
        if cleaned and cleaned[-1]["time_ms"] == entry["time_ms"]:
            cleaned[-1] = entry
            continue
        if cleaned and cleaned[-1]["x"] == entry["x"] and cleaned[-1]["y"] == entry["y"]:
            continue
        cleaned.append(entry)
    return cleaned


def split_panels(frames, source_width, source_height, target_width, target_height):
    orientation = "vertical" if source_width >= source_height else "horizontal"

    if orientation == "vertical":
        panel_target_width = even(target_width / 2)
        panel_target_height = target_height
        primary_center = (source_width * 0.25, source_height * 0.5)
        secondary_center = (source_width * 0.75, source_height * 0.5)
    else:
        panel_target_width = target_width
        panel_target_height = even(target_height / 2)
        primary_center = (source_width * 0.5, source_height * 0.25)
        secondary_center = (source_width * 0.5, source_height * 0.75)

    panel_crop_width, panel_crop_height = crop_size(
        source_width,
        source_height,
        panel_target_width,
        panel_target_height,
    )

    groups = {"primary": [], "secondary": []}
    all_detections = []

    for frame in frames:
        for detection in frame["detections"]:
            all_detections.append(detection)
            if orientation == "vertical":
                key = "primary" if detection["center_x"] < source_width / 2 else "secondary"
            else:
                key = "primary" if detection["center_y"] < source_height / 2 else "secondary"
            groups[key].append(detection)

    if not groups["primary"] or not groups["secondary"]:
        largest = sorted(all_detections, key=lambda d: d["area"], reverse=True)[:2]
        if orientation == "vertical":
            largest.sort(key=lambda d: d["center_x"])
        else:
            largest.sort(key=lambda d: d["center_y"])
        if len(largest) >= 2:
            groups["primary"] = [largest[0]]
            groups["secondary"] = [largest[1]]

    panels = []
    for label, fallback_center in (
        ("primary", primary_center),
        ("secondary", secondary_center),
    ):
        detections = groups[label]
        if detections:
            center_x, center_y = median_center(detections)
            confidence = statistics.median([d["confidence"] for d in detections])
        else:
            center_x, center_y = fallback_center
            confidence = 0

        panels.append(
            {
                "label": label,
                **crop_for_center(
                    center_x,
                    center_y,
                    panel_crop_width,
                    panel_crop_height,
                    source_width,
                    source_height,
                ),
                "confidence": confidence,
            }
        )

    return orientation, panels, panel_crop_width, panel_crop_height


def main():
    parser = argparse.ArgumentParser(description="Detect faces and emit crop metadata for Clip Farm.")
    parser.add_argument("--video-path", required=True)
    parser.add_argument("--target-width", type=int, required=True)
    parser.add_argument("--target-height", type=int, required=True)
    parser.add_argument("--layout", choices=["single", "split"], default="single")
    parser.add_argument("--sample-interval-ms", type=int, default=500)
    parser.add_argument("--deadzone", type=float, default=0.18)
    parser.add_argument("--min-move", type=float, default=0.12)
    parser.add_argument("--switch-hold-ms", type=int, default=1400)
    parser.add_argument("--transition-ms", type=int, default=900)
    parser.add_argument("--min-confidence", type=float, default=0.5)
    parser.add_argument(
        "--model-path",
        default=os.path.join(os.path.dirname(__file__), "../models/blaze_face_short_range.tflite"),
    )
    args = parser.parse_args()

    model_path = os.path.abspath(args.model_path)
    exit_code, data = detect_faces(
        args.video_path,
        model_path,
        args.sample_interval_ms,
        args.min_confidence,
    )
    if exit_code != 0:
        return exit_code

    source_width = data["source_width"]
    source_height = data["source_height"]
    frames = data["frames"]
    crop_width, crop_height = crop_size(
        source_width,
        source_height,
        args.target_width,
        args.target_height,
    )

    if args.layout == "split":
        orientation, panels, panel_crop_width, panel_crop_height = split_panels(
            frames,
            source_width,
            source_height,
            args.target_width,
            args.target_height,
        )
        output = {
            "layout": "split",
            "source_width": source_width,
            "source_height": source_height,
            "target_width": args.target_width,
            "target_height": args.target_height,
            "crop_width": panel_crop_width,
            "crop_height": panel_crop_height,
            "frame_count": data["frame_count"],
            "split_orientation": orientation,
            "panels": panels,
            "entries": [],
        }
    else:
        entries = stable_single_entries(
            frames,
            source_width,
            source_height,
            crop_width,
            crop_height,
            args,
        )
        output = {
            "layout": "single",
            "source_width": source_width,
            "source_height": source_height,
            "target_width": args.target_width,
            "target_height": args.target_height,
            "crop_width": crop_width,
            "crop_height": crop_height,
            "frame_count": data["frame_count"],
            "entries": entries,
        }

    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
