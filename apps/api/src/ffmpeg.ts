import path from "node:path";

import type { ClipJson, ReframeSettings, SmartCropMetadata, VideoMetadata } from "./types";

type FfprobeOutput = {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
  }>;
  format?: {
    duration?: string;
  };
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
    args.push("-vf", videoFilter);
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
    settings.mode === "normal" ? `normal-${settings.normalStrategy}` : "smart-face";
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

  return buildNormalReframeFilter(settings);
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

  return [
    `crop=${cropWidth}:${cropHeight}:${xExpression}:${yExpression}`,
    `scale=${settings.targetWidth}:${settings.targetHeight}`,
    "setsar=1",
  ].join(",");
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
  const fallback = sorted[sorted.length - 1]?.value ?? 0;

  let expression = String(fallback);

  for (let index = sorted.length - 2; index >= 0; index -= 1) {
    const entry = sorted[index]!;
    const next = sorted[index + 1]!;
    expression = `if(lt(t\\,${next.timeSeconds.toFixed(3)})\\,${entry.value}\\,${expression})`;
  }

  return expression;
}

function even(value: number) {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function runBinary(command: string, args: string[]) {
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
