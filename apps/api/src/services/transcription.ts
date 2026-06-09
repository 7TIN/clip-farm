import type {
  SmallestPulseResponse,
  TranscriptJson,
  TranscriptSegment,
  TranscriptWord,
} from "../types";

export async function transcribeAudio(audioPath: string, videoId: string, language: string) {
  const apiKey = process.env.SMALLEST_API_KEY;

  if (!apiKey) {
    throw new Error("Missing SMALLEST_API_KEY. Add it to your API environment before processing videos.");
  }

  const audio = await Bun.file(audioPath).arrayBuffer();
  const params = new URLSearchParams({
    language,
    word_timestamps: "true",
    diarize: "false",
    format: "true",
    punctuate: "true",
    capitalize: "true",
  });

  const response = await fetch(`https://api.smallest.ai/waves/v1/pulse/get_text?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/octet-stream",
    },
    body: audio,
  });

  const result = (await response.json()) as SmallestPulseResponse;

  if (!response.ok || result.status === "error") {
    const message = result.error?.message || `Smallest.ai transcription failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return normalizeTranscript(result, videoId, language);
}

function normalizeTranscript(
  result: SmallestPulseResponse,
  videoId: string,
  language: string,
): TranscriptJson {
  const words = normalizeWords(result.words);
  const durationMs = result.audio_length ? secondsToMs(result.audio_length) : inferDuration(words);
  const text = result.transcription || words.map((word) => word.word).join(" ");
  const segments = normalizeSegments(result, words, durationMs, text);

  return {
    videoId,
    provider: "smallest-ai-pulse",
    language,
    durationMs,
    text,
    segments,
    words,
    rawMetadata: result.metadata,
  };
}

function normalizeWords(words: SmallestPulseResponse["words"]): TranscriptWord[] {
  return (words || [])
    .filter((word) => word.word && typeof word.start === "number" && typeof word.end === "number")
    .map((word) => ({
      word: String(word.word),
      startMs: secondsToMs(Number(word.start)),
      endMs: secondsToMs(Number(word.end)),
      speakerLabel: word.speaker,
    }));
}

function normalizeSegments(
  result: SmallestPulseResponse,
  words: TranscriptWord[],
  durationMs: number | undefined,
  text: string,
): TranscriptSegment[] {
  const utteranceSegments = (result.utterances || [])
    .filter((utterance) => typeof utterance.start === "number" && typeof utterance.end === "number")
    .map((utterance, index) => ({
      id: `seg_${String(index + 1).padStart(4, "0")}`,
      startMs: secondsToMs(Number(utterance.start)),
      endMs: secondsToMs(Number(utterance.end)),
      text: String(utterance.text || utterance.transcript || "").trim(),
      speakerLabel: utterance.speaker,
    }))
    .filter((segment) => segment.text.length > 0);

  if (utteranceSegments.length > 0) {
    return utteranceSegments;
  }

  if (words.length > 0) {
    return groupWordsIntoSegments(words);
  }

  if (text.trim().length > 0) {
    return [
      {
        id: "seg_0001",
        startMs: 0,
        endMs: durationMs || 0,
        text,
      },
    ];
  }

  return [];
}

function groupWordsIntoSegments(words: TranscriptWord[]) {
  const segments: TranscriptSegment[] = [];
  let current: TranscriptWord[] = [];
  let segmentStart = words[0]?.startMs || 0;

  for (const word of words) {
    if (current.length === 0) {
      segmentStart = word.startMs;
    }

    current.push(word);

    const reachedTargetDuration = word.endMs - segmentStart >= 10_000;
    const reachedSentenceEnd = /[.!?]$/.test(word.word);

    if (reachedTargetDuration && reachedSentenceEnd) {
      segments.push(wordsToSegment(current, segments.length));
      current = [];
    }
  }

  if (current.length > 0) {
    segments.push(wordsToSegment(current, segments.length));
  }

  return segments;
}

function wordsToSegment(words: TranscriptWord[], index: number): TranscriptSegment {
  const first = words[0];
  const last = words[words.length - 1];

  return {
    id: `seg_${String(index + 1).padStart(4, "0")}`,
    startMs: first?.startMs || 0,
    endMs: last?.endMs || first?.startMs || 0,
    text: words.map((word) => word.word).join(" "),
    speakerLabel: first?.speakerLabel,
  };
}

function inferDuration(words: TranscriptWord[]) {
  const lastWord = words[words.length - 1];
  return lastWord?.endMs;
}

function secondsToMs(seconds: number) {
  return Math.round(seconds * 1000);
}
