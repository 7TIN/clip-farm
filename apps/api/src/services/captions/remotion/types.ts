import type { CaptionSettings, TranscriptSegment } from "../../../types";

export type CaptionedClipProps = CaptionSettings & {
  clipSrc: string;
  transcript: TranscriptSegment[];
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

export type CaptionToken = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number;
  confidence: number;
};

export type CaptionPage = {
  id: string;
  startMs: number;
  endMs: number;
  tokens: CaptionToken[];
};
