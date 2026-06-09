import type { ClipResult, ReframeSettings, TranscriptSegment } from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
export const SHOW_DEV_LIBRARY =
  process.env.NEXT_PUBLIC_APP_ENV === "dev" ||
  process.env.NODE_ENV === "development";
export const POLL_INTERVAL_MS = 5_000;

export function absoluteApiUrl(path?: string) {
  if (!path) {
    return undefined;
  }

  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

export function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getClipSegments(clip: ClipResult, segments: TranscriptSegment[]) {
  return segments.filter(
    (segment) => segment.endMs > clip.startMs && segment.startMs < clip.endMs,
  );
}

export function formatMode(clip: ClipResult) {
  if (!clip.reframeMode) {
    return "Original";
  }

  if (clip.reframeMode === "smart") {
    return clip.smartLayout === "split" ? "AI split" : "AI face";
  }

  return clip.normalStrategy?.replace("-", " ") || "Normal";
}

export function formatSettings(settings: ReframeSettings) {
  if (settings.mode === "smart") {
    return `${settings.aspectRatio} smart ${settings.smartLayout}`;
  }

  return `${settings.aspectRatio} ${settings.normalStrategy.replace("-", " ")}`;
}
