import React from "react";
import { Composition, registerRoot } from "remotion";
import { CaptionedClip } from "./CaptionedClip";
import type { CaptionedClipProps } from "./types";

const defaultProps: CaptionedClipProps = {
  clipSrc: "",
  captions: [],
  style: "hormozi",
  effect: "magic",
  position: "bottom",
  maxWordsPerPage: 6,
  maxPageDurationMs: 1800,
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 30,
};

const Root: React.FC = () => (
  <Composition
    id="CaptionedClip"
    component={CaptionedClip}
    defaultProps={defaultProps}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30}
    calculateMetadata={({ props }) => ({
      width: props.width,
      height: props.height,
      fps: props.fps,
      durationInFrames: props.durationInFrames,
    })}
  />
);

registerRoot(Root);
