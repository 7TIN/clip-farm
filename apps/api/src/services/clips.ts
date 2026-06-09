import type { ClipJson, TranscriptJson, TranscriptSegment } from "../types";

const MIN_CLIP_MS = 30_000;
const MAX_CLIP_MS = 40_000;
const TARGET_CLIP_MS = 35_000;

export function createRandomClips(transcript: TranscriptJson): ClipJson[] {
  const durationMs = transcript.durationMs || inferDurationFromSegments(transcript.segments);

  if (!durationMs || durationMs < 5_000) {
    return [];
  }

  const clipCount = getClipCount(durationMs);
  const latestStartMs = Math.max(0, durationMs - MIN_CLIP_MS);
  const spacing = clipCount > 1 ? latestStartMs / clipCount : 0;

  return Array.from({ length: clipCount }, (_, index) => {
    const jitter = Math.round(Math.random() * Math.max(1_000, spacing * 0.35));
    const roughStartMs = Math.min(latestStartMs, Math.round(index * spacing + jitter));
    const startMs = snapStartToSegment(roughStartMs, transcript.segments);
    const endMs = snapEndToSegment(startMs, transcript.segments, durationMs);
    const transcriptText = transcriptTextForRange(transcript.segments, startMs, endMs);
    const title = makeClipTitle(index, transcriptText);

    return {
      id: `clip_${crypto.randomUUID()}`,
      videoId: transcript.videoId,
      title,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      transcriptText,
      source: "random_mvp",
      status: "suggested",
    };
  });
}

function getClipCount(durationMs: number) {
  if (durationMs < 45_000) return 1;
  if (durationMs < 90_000) return 2;
  if (durationMs < 150_000) return 3;
  if (durationMs < 210_000) return 4;
  return 5;
}

function snapStartToSegment(roughStartMs: number, segments: TranscriptSegment[]) {
  if (segments.length === 0) {
    return roughStartMs;
  }

  const containing = segments.find(
    (segment) => segment.startMs <= roughStartMs && segment.endMs >= roughStartMs,
  );

  if (containing) {
    return containing.startMs;
  }

  const next = segments.find((segment) => segment.startMs >= roughStartMs);
  return next?.startMs ?? segments[segments.length - 1]?.startMs ?? roughStartMs;
}

function snapEndToSegment(startMs: number, segments: TranscriptSegment[], durationMs: number) {
  if (segments.length === 0) {
    return Math.min(durationMs, startMs + TARGET_CLIP_MS);
  }

  const minEndMs = Math.min(durationMs, startMs + MIN_CLIP_MS);
  const maxEndMs = Math.min(durationMs, startMs + MAX_CLIP_MS);
  const candidateSegments = segments.filter(
    (segment) => segment.endMs >= minEndMs && segment.endMs <= maxEndMs,
  );

  if (candidateSegments.length > 0) {
    const closest = candidateSegments.reduce((best, segment) => {
      const bestDistance = Math.abs(best.endMs - (startMs + TARGET_CLIP_MS));
      const nextDistance = Math.abs(segment.endMs - (startMs + TARGET_CLIP_MS));
      return nextDistance < bestDistance ? segment : best;
    });

    return closest.endMs;
  }

  const firstAfterMin = segments.find((segment) => segment.endMs >= minEndMs);
  return Math.min(firstAfterMin?.endMs ?? maxEndMs, maxEndMs);
}

function transcriptTextForRange(segments: TranscriptSegment[], startMs: number, endMs: number) {
  const text = segments
    .filter((segment) => segment.endMs > startMs && segment.startMs < endMs)
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return text || "Transcript text unavailable for this range.";
}

function makeClipTitle(index: number, transcriptText: string) {
  const words = transcriptText.split(/\s+/).filter(Boolean).slice(0, 8).join(" ");
  return words ? `Clip ${index + 1}: ${words}` : `Clip ${index + 1}`;
}

function inferDurationFromSegments(segments: TranscriptSegment[]) {
  return segments.reduce((max, segment) => Math.max(max, segment.endMs), 0);
}
