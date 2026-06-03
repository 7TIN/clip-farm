import path from "node:path";

import type { ClipJson, ReframeSettings, SmartCropMetadata, VideoMetadata } from "./types";

type FfprobeOutput = {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    avg_frame_rate?: string;
  }>;
  format?: {
    duration?: string;
  };
};

export type ClipMediaDetails = {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  durationMs: number;
  durationInFrames: number;
};

export async function readVideoDetails(videoPath: string): Promise<Partial<VideoMetadata>> {
  const result = await runBinary("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate",
    "-of",
    "json",
    videoPath,
  ]);

  const parsed = JSON.parse(result.stdout || "{}") as FfprobeOutput;
  const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video");
  const durationSeconds = Number(parsed.format?.duration || 0);

  return {
    durationMs: Number.isFinite(durationSeconds) ? Math.round(durationSeconds * 1000) : undefined,
    width: videoStream?.width,
    height: videoStream?.height,
    codec: videoStream?.codec_name,
  };
}

export async function readClipMediaDetails(videoPath: string): Promise<ClipMediaDetails> {
  const result = await runBinary("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_type,width,height,r_frame_rate,avg_frame_rate",
    "-of",
    "json",
    videoPath,
  ]);

  const parsed = JSON.parse(result.stdout || "{}") as FfprobeOutput;
  const videoStream = parsed.streams?.find((stream) => stream.codec_type === "video");
  const durationSeconds = Number(parsed.format?.duration || 0);
  const fps = parseFps(videoStream?.avg_frame_rate || videoStream?.r_frame_rate);

  if (!videoStream?.width || !videoStream.height || !Number.isFinite(durationSeconds)) {
    throw new Error("Could not read clip media details with ffprobe.");
  }

  return {
    width: videoStream.width,
    height: videoStream.height,
    fps,
    durationSeconds,
    durationMs: Math.round(durationSeconds * 1000),
    durationInFrames: Math.max(1, Math.ceil(durationSeconds * fps)),
  };
}

export async function extractAudio(inputPath: string, outputPath: string) {
  await runBinary("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);
}

export async function renderClip(
  inputPath: string,
  clip: ClipJson,
  clipsDir: string,
  settings?: ReframeSettings,
  smartCrop?: SmartCropMetadata,
) {
  const outputPath = getClipOutputPath(clipsDir, clip, settings);
  const startSeconds = (clip.startMs / 1000).toFixed(3);
  const durationSeconds = (clip.durationMs / 1000).toFixed(3);
  const args = [
    "-y",
    "-ss",
    startSeconds,
    "-i",
    inputPath,
    "-t",
    durationSeconds,
  ];

  const videoFilter = settings ? buildReframeFilter(clip, settings, smartCrop) : undefined;

  if (videoFilter) {
    if (videoFilter.kind === "complex") {
      args.push("-filter_complex", videoFilter.value, "-map", "[v]", "-map", "0:a?");
    } else {
      args.push("-vf", videoFilter.value);
    }
  }

  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  );

  await runBinary("ffmpeg", args);

  return outputPath;
}

function getClipOutputPath(clipsDir: string, clip: ClipJson, settings?: ReframeSettings) {
  if (!settings) {
    return path.join(clipsDir, `${clip.id}.mp4`);
  }

  const ratioSlug = settings.aspectRatio.replace(":", "x");
  const modeSlug =
    settings.mode === "normal" ? `normal-${settings.normalStrategy}` : `smart-${settings.smartLayout}`;
  return path.join(clipsDir, `${clip.id}_${ratioSlug}_${modeSlug}.mp4`);
}

function buildReframeFilter(
  clip: ClipJson,
  settings: ReframeSettings,
  smartCrop?: SmartCropMetadata,
) {
  if (settings.mode === "smart" && smartCrop?.entries.length) {
    return buildSmartCropFilter(clip, settings, smartCrop);
  }

  if (settings.mode === "smart" && smartCrop?.layout === "split" && smartCrop.panels?.length) {
    return buildSmartSplitFilter(settings, smartCrop);
  }

  return { kind: "vf" as const, value: buildNormalReframeFilter(settings) };
}

function buildNormalReframeFilter(settings: ReframeSettings) {
  const { targetWidth: width, targetHeight: height } = settings;

  if (settings.normalStrategy === "pad") {
    return [
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
      "setsar=1",
    ].join(",");
  }

  if (settings.normalStrategy === "blur-background") {
    return [
      `split=2[bg][fg]`,
      `[bg]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=24[bg]`,
      `[fg]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg]`,
      `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`,
    ].join(";");
  }

  return [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    "setsar=1",
  ].join(",");
}

function buildSmartCropFilter(
  clip: ClipJson,
  settings: ReframeSettings,
  metadata: SmartCropMetadata,
) {
  const cropWidth = even(metadata.cropWidth);
  const cropHeight = even(metadata.cropHeight);
  const entries = entriesForClip(clip, metadata);
  const xExpression = buildStepExpression(
    entries.map((entry) => ({
      timeSeconds: Math.max(0, (entry.timeMs - clip.startMs) / 1000),
      value: clamp(Math.round(entry.x), 0, metadata.sourceWidth - cropWidth),
    })),
  );
  const yExpression = buildStepExpression(
    entries.map((entry) => ({
      timeSeconds: Math.max(0, (entry.timeMs - clip.startMs) / 1000),
      value: clamp(Math.round(entry.y), 0, metadata.sourceHeight - cropHeight),
    })),
  );

  return {
    kind: "vf" as const,
    value: [
      `crop=${cropWidth}:${cropHeight}:${xExpression}:${yExpression}`,
      `scale=${settings.targetWidth}:${settings.targetHeight}`,
      "setsar=1",
    ].join(","),
  };
}

function buildSmartSplitFilter(settings: ReframeSettings, metadata: SmartCropMetadata) {
  const [primary, secondary] = metadata.panels || [];

  if (!primary || !secondary) {
    return { kind: "vf" as const, value: buildNormalReframeFilter(settings) };
  }

  if (metadata.splitOrientation === "horizontal") {
    const panelHeight = even(settings.targetHeight / 2);
    const first = cropScaleFilter("a", "top", primary, settings.targetWidth, panelHeight);
    const second = cropScaleFilter("b", "bottom", secondary, settings.targetWidth, panelHeight);

    return {
      kind: "complex" as const,
      value: [
        "[0:v]split=2[a][b]",
        first,
        second,
        `[top][bottom]vstack=inputs=2,drawbox=x=0:y=${panelHeight - 2}:w=${settings.targetWidth}:h=4:color=white@0.8:t=fill,setsar=1[v]`,
      ].join(";"),
    };
  }

  const panelWidth = even(settings.targetWidth / 2);
  const first = cropScaleFilter("a", "left", primary, panelWidth, settings.targetHeight);
  const second = cropScaleFilter("b", "right", secondary, panelWidth, settings.targetHeight);

  return {
    kind: "complex" as const,
    value: [
      "[0:v]split=2[a][b]",
      first,
      second,
      `[left][right]hstack=inputs=2,drawbox=x=${panelWidth - 2}:y=0:w=4:h=${settings.targetHeight}:color=white@0.8:t=fill,setsar=1[v]`,
    ].join(";"),
  };
}

function cropScaleFilter(
  inputLabel: string,
  outputLabel: string,
  panel: { x: number; y: number; width: number; height: number },
  targetWidth: number,
  targetHeight: number,
) {
  return `[${inputLabel}]crop=${even(panel.width)}:${even(panel.height)}:${Math.round(panel.x)}:${Math.round(panel.y)},scale=${targetWidth}:${targetHeight}[${outputLabel}]`;
}

function entriesForClip(clip: ClipJson, metadata: SmartCropMetadata) {
  const entries = metadata.entries
    .filter((entry) => entry.timeMs >= clip.startMs - 500 && entry.timeMs <= clip.endMs + 500)
    .filter((entry, index, all) => {
      if (index === 0) {
        return true;
      }

      return entry.timeMs - all[index - 1]!.timeMs >= 500;
    });

  if (entries.length > 0) {
    return entries;
  }

  return [
    {
      timeMs: clip.startMs,
      x: Math.max(0, Math.round((metadata.sourceWidth - metadata.cropWidth) / 2)),
      y: Math.max(0, Math.round((metadata.sourceHeight - metadata.cropHeight) / 2)),
      width: metadata.cropWidth,
      height: metadata.cropHeight,
    },
  ];
}

function buildStepExpression(entries: Array<{ timeSeconds: number; value: number }>) {
  const sorted = [...entries].sort((a, b) => a.timeSeconds - b.timeSeconds);
  if (sorted.length === 0) {
    return "0";
  }

  if (sorted.length === 1) {
    return String(sorted[0]!.value);
  }

  const last = sorted[sorted.length - 1]!;
  let expression = String(last.value);

  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    const entry = sorted[index]!;
    const next = sorted[index + 1]!;
    const duration = Math.max(0.001, next.timeSeconds - entry.timeSeconds);
    const interpolated = `${entry.value}+(${next.value - entry.value})*(t-${entry.timeSeconds.toFixed(3)})/${duration.toFixed(3)}`;
    expression = `if(lt(t\\,${entry.timeSeconds.toFixed(3)})\\,${entry.value}\\,if(lt(t\\,${next.timeSeconds.toFixed(3)})\\,${interpolated}\\,${expression}))`;
  }

  return expression;
}

function even(value: number) {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function runBinary(command: string, args: string[]) {
  let proc: Bun.Subprocess<"pipe", "pipe", "pipe">;

  try {
    proc = Bun.spawn([command, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    throw new Error(`${command} failed to start. Make sure it is installed and available in PATH.`);
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const details = stderr.trim() || stdout.trim() || `exit code ${exitCode}`;
    throw new Error(`${command} failed: ${details}`);
  }

  return { stdout, stderr };
}

function parseFps(rate?: string) {
  if (!rate || rate === "0/0") {
    return 30;
  }

  const [numerator, denominator] = rate.split("/").map(Number);
  if (numerator && denominator) {
    return numerator / denominator;
  }

  const parsed = Number(rate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}