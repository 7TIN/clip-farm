import React from "react";
import { Composition, registerRoot } from "remotion";
import { CaptionedClip } from "./CaptionedClip";
import type { CaptionedClipProps } from "./types";

const defaultProps: CaptionedClipProps = {
  clipSrc: "",
  transcript: [],
  style: "aesthetic",
  effect: "none",
  position: "center",
  maxWordsPerPage: 6,
  maxPageDurationMs: 1800,
  specialFontColor: "yellow-300",
  normalColor: "#ffffff",
  mutedColor: "#e4e4e7",
  stylishFrequency: 0.22,
  verticalFrequency: 0.34,
  boldFrequency: 0.18,
  maxWordsPerScene: 3,
  normalFontSize: 72,
  stylishFontSize: 88,
  formalFontSize: 64,
  boldFontSize: 118,
  normalFontWeight: 760,
  formalFontWeight: 430,
  boldFontWeight: 900,
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
