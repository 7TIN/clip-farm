import type { CaptionToken, ClipJson, TranscriptJson, TranscriptSegment } from "./types";

export function wordsForClip(transcript: TranscriptJson, clip: ClipJson): CaptionToken[] {
  const wordTokens = transcript.words
    .filter((word) => word.endMs > clip.startMs && word.startMs < clip.endMs)
    .map((word, index) => {
      const startMs = clamp(word.startMs - clip.startMs, 0, clip.durationMs);
      const endMs = clamp(word.endMs - clip.startMs, startMs + 1, clip.durationMs);

      return {
        text: index === 0 ? word.word : ` ${word.word}`,
        startMs,
        endMs,
        timestampMs: Math.round((startMs + endMs) / 2),
        confidence: 1,
      };
    });

  if (wordTokens.length > 0) {
    return wordTokens;
  }

  return approximateWordsFromSegments(transcript.segments, clip);
}

function approximateWordsFromSegments(segments: TranscriptSegment[], clip: ClipJson) {
  const tokens: CaptionToken[] = [];

  for (const segment of segments) {
    if (segment.endMs <= clip.startMs || segment.startMs >= clip.endMs) {
      continue;
    }

    const words = segment.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      continue;
    }

    const segmentStart = clamp(segment.startMs - clip.startMs, 0, clip.durationMs);
    const segmentEnd = clamp(segment.endMs - clip.startMs, segmentStart + 1, clip.durationMs);
    const step = (segmentEnd - segmentStart) / words.length;

    words.forEach((word, index) => {
      const startMs = Math.round(segmentStart + step * index);
      const endMs = Math.round(segmentStart + step * (index + 1));
      tokens.push({
        text: tokens.length === 0 ? word : ` ${word}`,
        startMs,
        endMs,
        timestampMs: Math.round((startMs + endMs) / 2),
        confidence: 0.5,
      });
    });
  }

  return tokens;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
