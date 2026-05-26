import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionEffect, CaptionPosition, CaptionStylePreset } from "../../types";
import type { CaptionToken } from "./types";
import { groupIntoPages, findActivePage, findActiveToken } from "./caption-pages";
import { presetMap } from "./presets";
import { EffectWrapper } from "./effects";

type CaptionLayerProps = {
  captions: CaptionToken[];
  style: CaptionStylePreset;
  effect: CaptionEffect;
  position: CaptionPosition;
  maxWordsPerPage: number;
  maxPageDurationMs: number;
};

export function CaptionLayer({
  captions,
  style,
  effect,
  position,
  maxWordsPerPage,
  maxPageDurationMs,
}: CaptionLayerProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentTimeMs = (frame / fps) * 1000;

  const pages = useMemo(
    () =>
      groupIntoPages({
        tokens: captions,
        maxWordsPerPage,
        maxPageDurationMs,
      }),
    [captions, maxWordsPerPage, maxPageDurationMs],
  );

  const activePage = findActivePage(pages, currentTimeMs);
  const activeToken = activePage
    ? findActiveToken(activePage.tokens, currentTimeMs)
    : undefined;

  if (!activePage) {
    return null;
  }

  const PresetComponent = presetMap[style];

  if (!PresetComponent) {
    return null;
  }

  return (
    <EffectWrapper
      pageStartMs={activePage.startMs}
      pageEndMs={activePage.endMs}
      fps={fps}
      effect={effect}
    >
      <PresetComponent
        page={activePage}
        activeToken={activeToken}
        position={position}
        effect={effect}
      />
    </EffectWrapper>
  );
}
