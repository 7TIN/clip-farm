import type { CaptionEffect, CaptionPosition, CaptionStylePreset } from "../../types";

export type CaptionToken = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number;
  confidence: number;
  index: number;
};

export type CaptionPage = {
  id: string;
  startMs: number;
  endMs: number;
  tokens: CaptionToken[];
};

export type CaptionedClipProps = {
  clipSrc: string;
  captions: CaptionToken[];
  style: CaptionStylePreset;
  effect: CaptionEffect;
  position: CaptionPosition;
  fps: number;
  width: number;
  height: number;
  maxWordsPerPage: number;
  maxPageDurationMs: number;
};
