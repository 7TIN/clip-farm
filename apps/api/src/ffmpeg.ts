import path from "node:path";

import type { ClipJson, VideoMetadata } from "./types";

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

export async function renderClip(inputPath: string, clip: ClipJson, clipsDir: string) {
  const outputPath = path.join(clipsDir, `${clip.id}.mp4`);
  const startSeconds = (clip.startMs / 1000).toFixed(3);
  const durationSeconds = (clip.durationMs / 1000).toFixed(3);

  await runBinary("ffmpeg", [
    "-y",
    "-ss",
    startSeconds,
    "-i",
    inputPath,
    "-t",
    durationSeconds,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-movflags",
    "+faststart",
    outputPath,
  ]);

  return outputPath;
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
