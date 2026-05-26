import type { CaptionWord, ClipJson, TranscriptJson } from "./types";

export function wordsForClip(transcript: TranscriptJson, clip: ClipJson): CaptionWord[] {
  const words = transcript.words?.length ? transcript.words : undefined;

  if (words) {
    return words
      .filter((word) => word.endMs > clip.startMs && word.startMs < clip.endMs)
      .map((word, index) => ({
        text: index === 0 ? word.word : ` ${word.word}`,
        startMs: Math.max(0, word.startMs - clip.startMs),
        endMs: Math.max(0, word.endMs - clip.startMs),
        timestampMs: Math.max(0, (word.startMs + word.endMs) / 2 - clip.startMs),
        confidence: 1,
      }));
  }

  return fallbackWordsForClip(transcript, clip);
}

function fallbackWordsForClip(transcript: TranscriptJson, clip: ClipJson): CaptionWord[] {
  const segments = transcript.segments || [];
  const clipSegments = segments.filter(
    (seg) => seg.endMs > clip.startMs && seg.startMs < clip.endMs,
  );

  if (!clipSegments.length) {
    return [];
  }

  const words: CaptionWord[] = [];
  const avgWordDurationMs = 200;
  const minGapMs = 80;

  for (const segment of clipSegments) {
    const segmentStart = Math.max(0, segment.startMs - clip.startMs);
    const segmentEnd = Math.max(0, segment.endMs - clip.startMs);
    const segmentText = segment.text || "";
    const textTokens = segmentText.split(/\s+/).filter(Boolean);
    const availableMs = segmentEnd - segmentStart;
    const wordDuration = Math.max(avgWordDurationMs, availableMs / textTokens.length);

    for (const [tokenIndex, token] of textTokens.entries()) {
      const wordStartMs = segmentStart + tokenIndex * wordDuration;
      const wordEndMs = Math.min(segmentEnd, wordStartMs + wordDuration - minGapMs);

      words.push({
        text: words.length === 0 ? token : ` ${token}`,
        startMs: wordStartMs,
        endMs: wordEndMs,
        timestampMs: (wordStartMs + wordEndMs) / 2,
        confidence: 0.5,
      });
    }
  }

  return words;
}
