import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  activeCaptionPage,
  activeTokenIndex,
  createCaptionPages,
} from "./caption-pages";
import type { CaptionPage, CaptionedClipProps } from "./types";
import { Video } from "@remotion/media";

export function CaptionedClip({
  clipSrc,
  captions,
  style,
  effect,
  position,
  maxWordsPerPage,
  maxPageDurationMs,
}: CaptionedClipProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;
  const pages = useMemo(
    () => createCaptionPages(captions, maxWordsPerPage, maxPageDurationMs),
    [captions, maxPageDurationMs, maxWordsPerPage],
  );
  const page = activeCaptionPage(pages, currentMs);
  const activeIndex = activeTokenIndex(page, currentMs);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Video src={clipSrc} />
      <AbsoluteFill style={positionStyle(position)}>
        {page ? (
          <CaptionBox
            page={page}
            activeIndex={activeIndex}
            styleName={style}
            effect={effect}
          />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function CaptionBox({
  page,
  activeIndex,
  styleName,
  effect,
}: {
  page: CaptionPage;
  activeIndex: number;
  styleName: CaptionedClipProps["style"];
  effect: CaptionedClipProps["effect"];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance =
    effect === "magic"
      ? spring({
          frame: frame % Math.round(fps * 2),
          fps,
          config: { damping: 16 },
        })
      : 1;
  const opacity =
    effect === "magic" ? interpolate(entrance, [0, 1], [0, 1]) : 1;
  const scale =
    effect === "magic" ? interpolate(entrance, [0, 1], [0.88, 1]) : 1;

  return (
    <div
      style={{ ...boxStyle(styleName), opacity, transform: `scale(${scale})` }}
    >
      {page.tokens.map((token, index) => (
        <span
          key={`${page.id}-${index}`}
          style={tokenStyle(styleName, index === activeIndex)}
        >
          {token.text}
        </span>
      ))}
    </div>
  );
}

function positionStyle(
  position: CaptionedClipProps["position"],
): React.CSSProperties {
  const base: React.CSSProperties = {
    alignItems: "center",
    padding: "96px 72px",
  };

  if (position === "top") {
    return { ...base, justifyContent: "flex-start" };
  }

  if (position === "center") {
    return { ...base, justifyContent: "center" };
  }

  return { ...base, justifyContent: "flex-end" };
}

function boxStyle(styleName: CaptionedClipProps["style"]): React.CSSProperties {
  const base: React.CSSProperties = {
    maxWidth: "88%",
    textAlign: "center",
    lineHeight: 1.08,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 64,
    fontWeight: 900,
    letterSpacing: 0,
    textShadow: "0 4px 18px rgba(0,0,0,0.8)",
  };

  if (styleName === "hormozi") {
    return {
      ...base,
      color: "white",
      textTransform: "uppercase",
      background: "rgba(0,0,0,0.82)",
      borderRadius: 14,
      padding: "16px 28px",
    };
  }

  if (styleName === "bubbly") {
    return {
      ...base,
      color: "#222",
      fontSize: 58,
      textShadow: "none",
    };
  }

  return base;
}

function tokenStyle(
  styleName: CaptionedClipProps["style"],
  active: boolean,
): React.CSSProperties {
  if (styleName === "hormozi") {
    return {
      color: active ? "#ffd400" : "white",
    };
  }

  if (styleName === "bubbly") {
    return {
      display: "inline-block",
      margin: "6px",
      padding: "8px 18px",
      borderRadius: 999,
      color: active ? "white" : "#222",
      background: active ? "#ff4f6d" : "rgba(255,255,255,0.92)",
      transform: active ? "scale(1.08)" : "scale(1)",
    };
  }

  return {
    color: active ? "#ffd400" : "white",
  };
}
