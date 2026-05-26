import React from "react";
import { Composition } from "remotion";
import { CaptionedClip } from "./CaptionedClip";
import type { CaptionedClipProps } from "./types";

const defaultProps: CaptionedClipProps = {
  clipSrc: "",
  captions: [],
  style: "hormozi",
  effect: "magic",
  position: "bottom",
  fps: 30,
  width: 1080,
  height: 1920,
  maxWordsPerPage: 5,
  maxPageDurationMs: 1800,
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="CaptionedClip"
      component={CaptionedClip}
      durationInFrames={1}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
    />
  );
};
