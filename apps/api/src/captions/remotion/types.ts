import type { CaptionEffect, CaptionPosition, CaptionStylePreset } from "../../types";

export type CaptionToken = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number;
  confidence: number;
};

export type CaptionedClipProps = {
  clipSrc: string;
  captions: CaptionToken[];
  style: CaptionStylePreset;
  effect: CaptionEffect;
  position: CaptionPosition;
  maxWordsPerPage: number;
  maxPageDurationMs: number;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

export type CaptionPage = {
  id: string;
  startMs: number;
  endMs: number;
  tokens: CaptionToken[];
};