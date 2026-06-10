import type { TextBehindWord } from "../../../types";
import type { CaptionToken } from "./types";

export function pickTextBehindWords(
  captions: CaptionToken[],
  durationMs: number,
  count: number = 2,
): TextBehindWord[] {
  const unique = captions.filter(
    (c, i, arr) => arr.findIndex((x) => x.text.trim() === c.text.trim()) === i,
  );
  const words = unique.filter((c) => c.text.trim().length > 1);

  if (words.length === 0) return [];

  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, words.length));

  const minGap = durationMs / (count + 1);

  return selected.map((word, index) => {
    const centerMs = minGap * (index + 1);
    const halfDuration = Math.min(800, durationMs * 0.1);
    const startMs = Math.max(0, centerMs - halfDuration / 2);
    const endMs = Math.min(durationMs, centerMs + halfDuration / 2);

    return {
      text: word.text.trim(),
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
    };
  });
}
