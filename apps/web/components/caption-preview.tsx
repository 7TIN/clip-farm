"use client";

import { useMemo } from "react";
import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import type { CaptionStylePreset, CaptionEffect, CaptionPosition, CaptionSettings, TranscriptWord } from "@/lib/types";
import { TextBehind } from "./text-behind";
export type { CaptionSettings };

type ClipPreview = {
  startMs: number;
  durationMs: number;
  outputWidth?: number;
  outputHeight?: number;
};

type CaptionToken = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number;
  confidence: number;
};

type CaptionPage = {
  id: string;
  startMs: number;
  endMs: number;
  tokens: CaptionToken[];
};

export function CaptionPreviewPlayer({
  clipSrc,
  clip,
  words,
  settings,
}: {
  clipSrc: string;
  clip: ClipPreview;
  words: TranscriptWord[];
  settings: CaptionSettings;
}) {
  const captions = useMemo(() => wordsForClip(words, clip), [clip, words]);
  const width = clip.outputWidth || 1080;
  const height = clip.outputHeight || 1920;
  const fps = 30;
  const durationInFrames = Math.max(1, Math.ceil((clip.durationMs / 1000) * fps));

  return (
    <Player
      component={CaptionedClip}
      inputProps={{
        clipSrc,
        captions,
        ...settings,
      }}
      durationInFrames={durationInFrames}
      compositionWidth={width}
      compositionHeight={height}
      fps={fps}
      controls
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: `${width} / ${height}` }}
    />
  );
}

function pickTextBehindWords(
  captions: CaptionToken[],
  durationMs: number,
  count: number = 2,
): { text: string; startMs: number; endMs: number }[] {
  const unique = captions.filter(
    (c, i, arr) => arr.findIndex((x) => x.text.trim() === c.text.trim()) === i,
  );
  const words = unique.filter((c) => c.text.trim().length > 1);
  if (words.length === 0) return [];
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, words.length));
  const minGap = durationMs / (count + 1);

  return selected.map((word, index) => {
    const centerMs = minGap * (index + 1);
    const halfDuration = Math.min(800, durationMs * 0.1);
    const startMs = Math.max(0, centerMs - halfDuration / 2);
    const endMs = Math.min(durationMs, centerMs + halfDuration / 2);
    return {
      text: word.text.trim(),
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
    };
  });
}

function CaptionedClip({
  clipSrc,
  captions,
  style,
  effect,
  position,
  maxWordsPerPage,
  maxPageDurationMs,
  textBehind,
}: {
  clipSrc: string;
  captions: CaptionToken[];
} & CaptionSettings) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;
  const pages = useMemo(
    () => createCaptionPages(captions, maxWordsPerPage, maxPageDurationMs),
    [captions, maxPageDurationMs, maxWordsPerPage],
  );
  const page = pages.find((item) => currentMs >= item.startMs && currentMs < item.endMs);
  const activeIndex = page?.tokens.findIndex((token) => currentMs >= token.startMs && currentMs < token.endMs) ?? -1;

  const resolvedTextBehind = useMemo(() => {
    if (!textBehind.enabled) return textBehind;
    if (textBehind.words.length > 0) return textBehind;
    const durMs = (durationInFrames / fps) * 1000;
    return {
      ...textBehind,
      words: pickTextBehindWords(captions, durMs, 2),
    };
  }, [textBehind, captions, durationInFrames, fps]);

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
      <TextBehind textBehind={resolvedTextBehind} />
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
  styleName: CaptionStylePreset;
  effect: CaptionEffect;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = effect === "magic"
    ? spring({ frame: frame % Math.round(fps * 2), fps, config: { damping: 16 } })
    : 1;
  const opacity = effect === "magic" ? interpolate(entrance, [0, 1], [0, 1]) : 1;
  const scale = effect === "magic" ? interpolate(entrance, [0, 1], [0.88, 1]) : 1;

  return (
    <div style={{ ...boxStyle(styleName), opacity, transform: `scale(${scale})` }}>
      {page.tokens.map((token, index) => (
        <span key={`${page.id}-${index}`} style={tokenStyle(styleName, index === activeIndex)}>
          {token.text}
        </span>
      ))}
    </div>
  );
}

function createCaptionPages(tokens: CaptionToken[], maxWordsPerPage: number, maxPageDurationMs: number) {
  const pages: CaptionPage[] = [];
  let current: CaptionToken[] = [];

  for (const token of tokens) {
    const first = current[0];
    const tooManyWords = current.length >= maxWordsPerPage;
    const tooLong = first ? token.endMs - first.startMs > maxPageDurationMs : false;
    const sentenceBreak = current.length > 0 && /[.!?]$/.test(current[current.length - 1]!.text.trim());

    if (current.length > 0 && (tooManyWords || tooLong || sentenceBreak)) {
      pages.push(tokensToPage(current, pages.length));
      current = [];
    }

    current.push(token);
  }

  if (current.length > 0) {
    pages.push(tokensToPage(current, pages.length));
  }

  return pages;
}

function wordsForClip(words: TranscriptWord[], clip: ClipPreview): CaptionToken[] {
  return words
    .filter((word) => word.endMs > clip.startMs && word.startMs < clip.startMs + clip.durationMs)
    .map((word, index) => {
      const startMs = clamp(word.startMs - clip.startMs, 0, clip.durationMs);
      const endMs = clamp(word.endMs - clip.startMs, startMs + 1, clip.durationMs);
      return {
        text: index === 0 ? word.word : ` ${word.word}`,
        startMs,
        endMs,
        timestampMs: Math.round((startMs + endMs) / 2),
        confidence: 1,
      };
    });
}

function tokensToPage(tokens: CaptionToken[], index: number): CaptionPage {
  return {
    id: `page_${index}`,
    startMs: tokens[0]?.startMs || 0,
    endMs: tokens[tokens.length - 1]?.endMs || 0,
    tokens,
  };
}

function positionStyle(position: CaptionPosition): React.CSSProperties {
  const base: React.CSSProperties = {
    alignItems: "center",
    padding: "9% 7%",
  };

  if (position === "top") return { ...base, justifyContent: "flex-start" };
  if (position === "center") return { ...base, justifyContent: "center" };
  return { ...base, justifyContent: "flex-end" };
}

function boxStyle(styleName: CaptionStylePreset): React.CSSProperties {
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

function tokenStyle(styleName: CaptionStylePreset, active: boolean): React.CSSProperties {
  if (styleName === "hormozi") {
    return { color: active ? "#ffd400" : "white" };
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

  return { color: active ? "#ffd400" : "white" };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}