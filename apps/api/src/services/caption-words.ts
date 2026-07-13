import type {
  CaptionToken,
  ClipJson,
  TranscriptJson,
  TranscriptSegment,
  TranscriptWord,
} from "../types";

export function wordsForClip(
  transcript: TranscriptJson,
  clip: ClipJson,
): CaptionToken[] {
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

export function captionSegmentsForClip(
  transcript: TranscriptJson,
  clip: ClipJson,
): TranscriptSegment[] {
  const clippedWords = transcript.words
    .filter((word) => word.endMs > clip.startMs && word.startMs < clip.endMs)
    .map((word) => ({
      ...word,
      startMs: clamp(word.startMs - clip.startMs, 0, clip.durationMs),
      endMs: clamp(word.endMs - clip.startMs, 1, clip.durationMs),
    }))
    .filter((word) => word.endMs > word.startMs);

  if (clippedWords.length > 0) {
    return groupWordsForCaptions(clippedWords);
  }

  return approximateSegmentsForClip(transcript.segments, clip);
}

function groupWordsForCaptions(words: TranscriptWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: TranscriptWord[] = [];
  let segmentStart = words[0]?.startMs || 0;

  words.forEach((word, index) => {
    const next = words[index + 1];

    if (current.length === 0) {
      segmentStart = word.startMs;
    }

    current.push(word);

    const duration = word.endMs - segmentStart;
    const nextGap = next ? next.startMs - word.endMs : 0;
    const shouldBreak =
      current.length >= 3 ||
      duration >= 1800 ||
      duration >= 1250 ||
      /[.!?]$/.test(word.word) ||
      nextGap >= 420;

    if (shouldBreak) {
      segments.push(wordsToSegment(current, segments.length));
      current = [];
    }
  });

  if (current.length > 0) {
    segments.push(wordsToSegment(current, segments.length));
  }

  return segments;
}

function approximateWordsFromSegments(
  segments: TranscriptSegment[],
  clip: ClipJson,
) {
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

function approximateSegmentsForClip(
  segments: TranscriptSegment[],
  clip: ClipJson,
): TranscriptSegment[] {
  const output: TranscriptSegment[] = [];

  for (const segment of segments) {
    if (segment.endMs <= clip.startMs || segment.startMs >= clip.endMs) {
      continue;
    }

    const startMs = clamp(segment.startMs - clip.startMs, 0, clip.durationMs);
    const endMs = clamp(segment.endMs - clip.startMs, startMs + 1, clip.durationMs);
    output.push({
      id: `caption_seg_${String(output.length + 1).padStart(4, "0")}`,
      startMs,
      endMs,
      text: segment.text,
      speakerLabel: segment.speakerLabel,
    });
  }

  return output;
}

function wordsToSegment(words: TranscriptWord[], index: number): TranscriptSegment {
  const first = words[0];
  const last = words[words.length - 1];

  return {
    id: `caption_seg_${String(index + 1).padStart(4, "0")}`,
    startMs: first?.startMs || 0,
    endMs: last?.endMs || first?.startMs || 0,
    text: words.map((word) => word.word).join(" "),
    speakerLabel: first?.speakerLabel,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
