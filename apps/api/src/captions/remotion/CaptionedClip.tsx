import React from "react";
import { AbsoluteFill, Video } from "remotion";
import type { CaptionEffect, CaptionPosition, CaptionStylePreset } from "../../types";
import type { CaptionToken } from "./types";
import { CaptionLayer } from "./CaptionLayer";

type CaptionedClipProps = {
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

export function CaptionedClip({
  clipSrc,
  captions,
  style,
  effect,
  position,
  maxWordsPerPage,
  maxPageDurationMs,
}: CaptionedClipProps) {
  return (
    <AbsoluteFill>
      <Video src={clipSrc} />
      <CaptionLayer
        captions={captions}
        style={style}
        effect={effect}
        position={position}
        maxWordsPerPage={maxWordsPerPage}
        maxPageDurationMs={maxPageDurationMs}
      />
    </AbsoluteFill>
  );
}
