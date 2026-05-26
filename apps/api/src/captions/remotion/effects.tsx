import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { CaptionToken } from "./types";

function timeToFrame(timeMs: number, fps: number) {
  return Math.round((timeMs / 1000) * fps);
}

export function NoneEffect({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function MagicEffect({
  children,
  pageStartMs,
  fps,
}: {
  children: React.ReactNode;
  pageStartMs: number;
  fps: number;
}) {
  const frame = useCurrentFrame();
  const pageStartFrame = timeToFrame(pageStartMs, fps);
  const relativeFrame = Math.max(0, frame - pageStartFrame);

  const opacity = interpolate(relativeFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const scale = interpolate(relativeFrame, [0, 10], [0.8, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const translateY = interpolate(relativeFrame, [0, 12], [20, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
      }}
    >
      {children}
    </div>
  );
}

export function SquiggleEffect({
  children,
  pageStartMs,
  fps,
}: {
  children: React.ReactNode;
  pageStartMs: number;
  fps: number;
}) {
  const frame = useCurrentFrame();
  const pageStartFrame = timeToFrame(pageStartMs, fps);
  const relativeFrame = Math.max(0, frame - pageStartFrame);

  const squiggle = interpolate(relativeFrame, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const translateX = Math.sin(relativeFrame * 0.8) * 4 * squiggle;
  const translateY = Math.cos(relativeFrame * 1.2) * 3 * squiggle;
  const rotate = Math.sin(relativeFrame * 0.5) * 1.5 * squiggle;
  const opacity = interpolate(relativeFrame, [0, 4], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotate}deg)`,
      }}
    >
      {children}
    </div>
  );
}

export function ScrollEffect({
  children,
  pageStartMs,
  pageEndMs,
  fps,
}: {
  children: React.ReactNode;
  pageStartMs: number;
  pageEndMs: number;
  fps: number;
}) {
  const frame = useCurrentFrame();
  const pageStartFrame = timeToFrame(pageStartMs, fps);
  const pageEndFrame = timeToFrame(pageEndMs, fps);
  const pageDuration = Math.max(1, pageEndFrame - pageStartFrame);
  const relativeFrame = Math.max(0, frame - pageStartFrame);

  const enterFraction = Math.min(1, relativeFrame / 8);
  const exitFraction = Math.max(0, Math.min(1, (relativeFrame - pageDuration + 6) / 6));

  const translateY = interpolate(enterFraction, [0, 1], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitTranslateY = interpolate(exitFraction, [0, 1], [0, -60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity =
    exitFraction > 0
      ? interpolate(exitFraction, [0, 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(enterFraction, [0, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY + exitTranslateY}px)`,
      }}
    >
      {children}
    </div>
  );
}

export function EffectWrapper({
  children,
  pageStartMs,
  pageEndMs,
  fps,
  effect,
}: {
  children: React.ReactNode;
  pageStartMs: number;
  pageEndMs: number;
  fps: number;
  effect: string;
}) {
  switch (effect) {
    case "magic":
      return (
        <MagicEffect pageStartMs={pageStartMs} fps={fps}>
          {children}
        </MagicEffect>
      );
    case "squiggle":
      return (
        <SquiggleEffect pageStartMs={pageStartMs} fps={fps}>
          {children}
        </SquiggleEffect>
      );
    case "scroll":
      return (
        <ScrollEffect
          pageStartMs={pageStartMs}
          pageEndMs={pageEndMs}
          fps={fps}
        >
          {children}
        </ScrollEffect>
      );
    default:
      return <>{children}</>;
  }
}
