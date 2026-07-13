"use client";

import React, { useMemo } from "react";
import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import type { CaptionSettings, TranscriptSegment, TranscriptWord } from "@/lib/types";
export type { CaptionSettings };

type ClipPreview = {
  startMs: number;
  endMs?: number;
  durationMs: number;
  outputWidth?: number;
  outputHeight?: number;
};

type CaptionedClipProps = CaptionSettings & {
  clipSrc: string;
  transcript: TranscriptSegment[];
};

type WordNode = {
  type: "word";
  text: string;
  style: React.CSSProperties;
};

type GroupNode = {
  type: "group";
  direction: "horizontal" | "vertical";
  children: KineticNode[];
  gap?: number;
  alignItems?: "center" | "flex-start" | "flex-end";
};

type KineticNode = WordNode | GroupNode;

type KineticScene = {
  id: string;
  layout: GroupNode;
  position: CaptionSettings["position"];
  startFrame: number;
  endFrame: number;
  stagger: number;
  entranceFrom: "left" | "right" | "top" | "bottom";
};

type ResolvedStyle = {
  primaryFont: string;
  secondaryFont: string;
  emotionFont: string;
  formalFont: string;
  boldFont: string;
  color: string;
  mutedColor: string;
  accentColor: string;
  normalFontSize: number;
  stylishFontSize: number;
  formalFontSize: number;
  boldFontSize: number;
  normalFontWeight: number;
  formalFontWeight: number;
  boldFontWeight: number;
  stylishFrequency: number;
  verticalFrequency: number;
  boldFrequency: number;
  maxWordsPerScene: 2 | 3 | 4;
};

const fontInter = "Inter, Arial, Helvetica, sans-serif";
const fontMono = "Geist Mono, JetBrains Mono, Consolas, monospace";
const fontFormal = "Merriweather, Georgia, serif";
const fontChill = "Edu AU VIC WA NT Hand, Apple Garamond, Georgia, serif";
const fontOswald = "Oswald, Impact, Arial Narrow Bold, sans-serif";
const fontImpact = "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif";

const connectors = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "for",
  "from",
  "i",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "so",
  "the",
  "to",
  "was",
  "were",
  "with",
  "you",
]);

const emotionWords = new Set([
  "amazing",
  "beautiful",
  "best",
  "crazy",
  "deep",
  "fast",
  "found",
  "huge",
  "important",
  "insane",
  "love",
  "massive",
  "never",
  "new",
  "quickly",
  "rare",
  "real",
  "really",
  "scrolling",
  "secret",
  "viral",
  "wild",
]);

const brandWords = new Set([
  "ai",
  "apple",
  "chatgpt",
  "google",
  "instagram",
  "meta",
  "openai",
  "tiktok",
  "twitter",
  "x",
  "youtube",
]);

const colors: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  "yellow-300": "#fde047",
  "amber-300": "#fcd34d",
  "emerald-300": "#6ee7b7",
  "teal-300": "#5eead4",
  "cyan-300": "#67e8f9",
  "sky-300": "#7dd3fc",
  "rose-400": "#fb7185",
  "zinc-100": "#f4f4f5",
  "zinc-200": "#e4e4e7",
  "zinc-300": "#d4d4d8",
  "zinc-400": "#a1a1aa",
  "slate-100": "#f1f5f9",
  "slate-200": "#e2e8f0",
  "slate-300": "#cbd5e1",
  "stone-100": "#f5f5f4",
  "stone-200": "#e7e5e4",
  "amber-100": "#fef3c7",
  "rose-100": "#ffe4e6",
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
  const transcript = useMemo(() => captionSegmentsForClip(words, clip), [clip, words]);
  const width = clip.outputWidth || 1080;
  const height = clip.outputHeight || 1920;
  const fps = 30;
  const durationInFrames = Math.max(1, Math.ceil((clip.durationMs / 1000) * fps));

  return (
    <Player
      component={CaptionedClip}
      inputProps={{ clipSrc, transcript, ...settings }}
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

function CaptionedClip(props: CaptionedClipProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scenes = useMemo(() => buildScenes(props, fps), [props, fps]);
  const active = scenes
    .filter((scene) => frame >= scene.startFrame && frame < scene.endFrame)
    .sort((a, b) => b.startFrame - a.startFrame)[0];

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Video src={props.clipSrc} />
      {active ? <Scene scene={active} frame={frame} fps={fps} /> : null}
    </AbsoluteFill>
  );
}

function Scene({ scene, frame, fps }: { scene: KineticScene; frame: number; fps: number }) {
  const { element } = renderNode(
    scene.layout,
    frame - scene.startFrame,
    fps,
    scene.stagger,
    0,
    scene.layout.direction,
    scene.entranceFrom,
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        padding: "10%",
        boxSizing: "border-box",
        pointerEvents: "none",
        ...positionStyle(scene.position),
      }}
    >
      {element}
    </AbsoluteFill>
  );
}

function renderNode(
  node: KineticNode,
  frame: number,
  fps: number,
  stagger: number,
  sequence: number,
  parentDirection: "horizontal" | "vertical",
  entranceFrom: "left" | "right" | "top" | "bottom",
): { element: React.ReactNode; next: number } {
  if (node.type === "word") {
    return {
      element: (
        <AnimatedWord
          key={`${sequence}-${node.text}`}
          text={node.text}
          style={node.style}
          frame={frame - sequence * stagger}
          fps={fps}
          entranceFrom={entranceFrom}
        />
      ),
      next: sequence + 1,
    };
  }

  const children: React.ReactNode[] = [];
  let next = sequence;
  node.children.forEach((child, index) => {
    const rendered = renderNode(
      child,
      frame,
      fps,
      stagger,
      next,
      node.direction,
      entranceFrom || (parentDirection === "horizontal" ? "left" : "top"),
    );
    children.push(<React.Fragment key={index}>{rendered.element}</React.Fragment>);
    next = rendered.next;
  });

  return {
    element: (
      <div
        style={{
          display: "flex",
          flexDirection: node.direction === "horizontal" ? "row" : "column",
          gap: node.gap ?? (node.direction === "horizontal" ? 14 : 8),
          alignItems:
            node.alignItems ??
            (node.direction === "vertical" ? "flex-start" : "center"),
        }}
      >
        {children}
      </div>
    ),
    next,
  };
}

function AnimatedWord({
  text,
  style,
  frame,
  fps,
  entranceFrom,
}: {
  text: string;
  style: React.CSSProperties;
  frame: number;
  fps: number;
  entranceFrom: "left" | "right" | "top" | "bottom";
}) {
  const progress = spring({
    frame: Math.max(0, frame),
    fps,
    config: { damping: 14, stiffness: 220, mass: 0.55 },
  });
  const opacity = interpolate(progress, [0, 0.25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const horizontal = entranceFrom === "left" || entranceFrom === "right";
  const from =
    entranceFrom === "right" || entranceFrom === "bottom"
      ? 58
      : horizontal
        ? -70
        : -48;
  const translate = interpolate(progress, [0, 1], [from, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(progress, [0, 1], [0.88, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `${horizontal ? "translateX" : "translateY"}(${translate}px) scale(${scale})`,
        whiteSpace: "nowrap",
        willChange: "transform, opacity",
        lineHeight: 1.1,
        color: "#ffffff",
        textShadow: "0 2px 12px rgba(0,0,0,0.7), 0 0 24px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      {text}
    </span>
  );
}

function buildScenes(props: CaptionedClipProps, fps: number): KineticScene[] {
  if (props.style === "basic" || props.style === "hormozi" || props.style === "bubbly") {
    return buildClassicScenes(props, fps);
  }

  const style = resolveStyle(props);
  const scenes: KineticScene[] = [];

  props.transcript.forEach((segment) => {
    const words = segment.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    const startFrame = Math.floor((segment.startMs / 1000) * fps);
    const endFrame = Math.max(startFrame + 4, Math.ceil((segment.endMs / 1000) * fps));
    const chunks = splitChunks(words, `${props.style}:${segment.id}`, style.maxWordsPerScene);
    const chunkFrames = Math.max(8, Math.floor((endFrame - startFrame) / chunks.length));

    chunks.forEach((chunk, index) => {
      const seed = `${props.style}:${segment.id}:${index}:${chunk.join(" ")}`;
      const vertical =
        chunk.some(isBrandOrName) || chance(`${seed}:vertical`, style.verticalFrequency);
      const entrances: KineticScene["entranceFrom"][] = vertical
        ? ["top", "left", "right"]
        : ["left", "right"];
      const sceneStart = startFrame + index * chunkFrames;

      scenes.push({
        id: `${segment.id}_${index}`,
        startFrame: sceneStart,
        endFrame: Math.min(sceneStart + chunkFrames, endFrame),
        position: props.position,
        stagger: vertical ? 3 : 2,
        entranceFrom: entrances[hashString(`${seed}:entrance`) % entrances.length],
        layout: vertical
          ? buildVerticalLayout(chunk, style, seed)
          : buildHorizontalLayout(chunk, style, seed),
      });
    });
  });

  return scenes;
}

function buildClassicScenes(props: CaptionedClipProps, fps: number): KineticScene[] {
  return props.transcript.map((segment) => {
    const words = segment.text.trim().split(/\s+/).filter(Boolean);
    const startFrame = Math.floor((segment.startMs / 1000) * fps);
    return {
      id: segment.id,
      startFrame,
      endFrame: Math.max(startFrame + 4, Math.ceil((segment.endMs / 1000) * fps)),
      position: props.position,
      stagger: props.style === "bubbly" ? 2 : 1,
      entranceFrom: "bottom" as const,
      layout: {
        type: "group" as const,
        direction: "horizontal" as const,
        gap: props.style === "bubbly" ? 8 : 6,
        alignItems: "center" as const,
        children: words.map((word, index) => ({
          type: "word" as const,
          text: word,
          style: classicWordStyle(props, index === words.length - 1),
        })),
      },
    };
  });
}

function classicWordStyle(props: CaptionedClipProps, active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: fontInter,
    fontSize: 64,
    fontWeight: 900,
    letterSpacing: 0,
    textAlign: "center",
    color: active ? "#ffd400" : "#ffffff",
    textShadow: "0 4px 18px rgba(0,0,0,0.8)",
  };

  if (props.style === "hormozi") {
    return {
      ...base,
      textTransform: "uppercase",
      background: "rgba(0,0,0,0.82)",
      borderRadius: 14,
      padding: "10px 14px",
    };
  }

  if (props.style === "bubbly") {
    return {
      ...base,
      fontSize: 58,
      color: active ? "#ffffff" : "#222222",
      background: active ? "#ff4f6d" : "rgba(255,255,255,0.92)",
      borderRadius: 999,
      padding: "8px 18px",
      textShadow: "none",
    };
  }

  return base;
}

function resolveStyle(props: CaptionedClipProps): ResolvedStyle {
  const preset = props.style;
  const base: ResolvedStyle =
    preset === "editorial"
      ? presetStyle(fontFormal, fontInter, "Apple Garamond, Georgia, serif", fontFormal, fontOswald, "#b8f7ff", 68, 78, 70, 108, 650, 700, 800, 0.16, 0.28, 0.12, 3, "#e7ded1")
      : preset === "punchy"
        ? presetStyle(fontInter, fontMono, fontChill, fontFormal, fontImpact, "#ffef5c", 76, 94, 62, 132, 900, 500, 900, 0.18, 0.45, 0.3, 2, "#f7f7f7")
        : preset === "minimal"
          ? presetStyle(fontInter, fontFormal, "Apple Garamond, Georgia, serif", fontFormal, fontOswald, "#ffffff", 62, 68, 58, 92, 600, 400, 700, 0.08, 0.22, 0.08, 3, "#d8d8d8")
          : presetStyle(fontInter, fontMono, fontChill, fontFormal, fontImpact, "#f1efe9", 72, 88, 64, 118, 760, 430, 900, 0.22, 0.34, 0.18, 3, "#f1efe9");

  return {
    ...base,
    color: resolveColor(props.normalColor) || base.color,
    mutedColor: resolveColor(props.mutedColor) || base.mutedColor,
    accentColor: resolveColor(props.specialFontColor) || base.accentColor,
    normalFontSize: props.normalFontSize,
    stylishFontSize: props.stylishFontSize,
    formalFontSize: props.formalFontSize,
    boldFontSize: props.boldFontSize,
    normalFontWeight: props.normalFontWeight,
    formalFontWeight: props.formalFontWeight,
    boldFontWeight: props.boldFontWeight,
    stylishFrequency: props.stylishFrequency,
    verticalFrequency: props.verticalFrequency,
    boldFrequency: props.boldFrequency,
    maxWordsPerScene: props.maxWordsPerScene,
  };
}

function presetStyle(
  primaryFont: string,
  secondaryFont: string,
  emotionFont: string,
  formalFont: string,
  boldFont: string,
  accentColor: string,
  normalFontSize: number,
  stylishFontSize: number,
  formalFontSize: number,
  boldFontSize: number,
  normalFontWeight: number,
  formalFontWeight: number,
  boldFontWeight: number,
  stylishFrequency: number,
  verticalFrequency: number,
  boldFrequency: number,
  maxWordsPerScene: 2 | 3 | 4,
  mutedColor: string,
): ResolvedStyle {
  return {
    primaryFont,
    secondaryFont,
    emotionFont,
    formalFont,
    boldFont,
    color: "#ffffff",
    mutedColor,
    accentColor,
    normalFontSize,
    stylishFontSize,
    formalFontSize,
    boldFontSize,
    normalFontWeight,
    formalFontWeight,
    boldFontWeight,
    stylishFrequency,
    verticalFrequency,
    boldFrequency,
    maxWordsPerScene,
  };
}

function buildVerticalLayout(chunk: string[], style: ResolvedStyle, seed: string): GroupNode {
  const children: KineticNode[] = [];
  let index = 0;

  while (index < chunk.length) {
    const word = chunk[index]!;
    const bold = isBrandOrName(word) || chance(`${seed}:${index}:bold`, style.boldFrequency);

    if (bold) {
      children.push({ type: "word", text: word, style: getWordStyle(word, style, `${seed}:${index}`, true) });
      index += 1;
      continue;
    }

    const next = chunk[index + 1];
    if (next && !isBrandOrName(next) && chance(`${seed}:${index}:pair`, 0.34)) {
      children.push({
        type: "group",
        direction: "horizontal",
        gap: 12,
        alignItems: "center",
        children: [
          { type: "word", text: word, style: getWordStyle(word, style, `${seed}:${index}`, false) },
          { type: "word", text: next, style: getWordStyle(next, style, `${seed}:${index + 1}`, false) },
        ],
      });
      index += 2;
      continue;
    }

    children.push({ type: "word", text: word, style: getWordStyle(word, style, `${seed}:${index}`, false) });
    index += 1;
  }

  return {
    type: "group",
    direction: "vertical",
    gap: 8,
    alignItems: chance(`${seed}:align-end`, 0.32) ? "flex-end" : "flex-start",
    children,
  };
}

function buildHorizontalLayout(chunk: string[], style: ResolvedStyle, seed: string): GroupNode {
  return {
    type: "group",
    direction: "horizontal",
    gap: 14,
    alignItems: "center",
    children: chunk.map((word, index) => ({
      type: "word",
      text: word,
      style: getWordStyle(word, style, `${seed}:${index}`, false),
    })),
  };
}

function getWordStyle(
  word: string,
  style: ResolvedStyle,
  seed: string,
  forceBold: boolean,
): React.CSSProperties {
  const cleaned = cleanWord(word);
  const connector = connectors.has(cleaned);
  const emotion =
    emotionWords.has(cleaned) || /ing$|ly$|ful$|ous$|ive$/.test(cleaned);
  const stylish = !forceBold && emotion && chance(`${seed}:stylish`, style.stylishFrequency);
  const formal = !forceBold && (connector || chance(`${seed}:formal`, 0.34));

  if (forceBold) {
    return {
      fontFamily: style.boldFont,
      fontSize: style.boldFontSize,
      fontWeight: style.boldFontWeight,
      color: style.accentColor,
      letterSpacing: 0,
      textTransform: "uppercase",
      textShadow: "0 8px 26px rgba(0,0,0,0.72), 0 0 34px rgba(0,0,0,0.4)",
    };
  }

  if (stylish) {
    return {
      fontFamily: style.emotionFont,
      fontSize: style.stylishFontSize,
      fontWeight: 500,
      fontStyle: "italic",
      color: style.mutedColor,
      letterSpacing: 0,
    };
  }

  if (formal) {
    return {
      fontFamily: style.formalFont,
      fontSize: style.formalFontSize,
      fontWeight: connector ? style.formalFontWeight : 700,
      fontStyle: cleaned === "i" ? "italic" : "normal",
      color: style.mutedColor,
      letterSpacing: 0,
    };
  }

  return {
    fontFamily: chance(`${seed}:secondary`, 0.28)
      ? style.secondaryFont
      : style.primaryFont,
    fontSize: style.normalFontSize,
    fontWeight: style.normalFontWeight,
    color: style.color,
    letterSpacing: 0,
  };
}

function captionSegmentsForClip(words: TranscriptWord[], clip: ClipPreview): TranscriptSegment[] {
  const clippedWords = words
    .filter((word) => word.endMs > clip.startMs && word.startMs < clip.startMs + clip.durationMs)
    .map((word) => ({
      ...word,
      startMs: clamp(word.startMs - clip.startMs, 0, clip.durationMs),
      endMs: clamp(word.endMs - clip.startMs, 1, clip.durationMs),
    }))
    .filter((word) => word.endMs > word.startMs);
  const segments: TranscriptSegment[] = [];
  let current: TranscriptWord[] = [];
  let segmentStart = clippedWords[0]?.startMs || 0;

  clippedWords.forEach((word, index) => {
    const next = clippedWords[index + 1];
    if (current.length === 0) segmentStart = word.startMs;
    current.push(word);

    const duration = word.endMs - segmentStart;
    const nextGap = next ? next.startMs - word.endMs : 0;
    if (
      current.length >= 3 ||
      duration >= 1800 ||
      duration >= 1250 ||
      /[.!?]$/.test(word.word) ||
      nextGap >= 420
    ) {
      segments.push(wordsToSegment(current, segments.length));
      current = [];
    }
  });

  if (current.length > 0) segments.push(wordsToSegment(current, segments.length));
  return segments;
}

function wordsToSegment(words: TranscriptWord[], index: number): TranscriptSegment {
  const first = words[0];
  const last = words[words.length - 1];
  return {
    id: `caption_seg_${String(index + 1).padStart(4, "0")}`,
    startMs: first?.startMs || 0,
    endMs: last?.endMs || first?.startMs || 0,
    text: words.map((word) => word.word).join(" "),
    speakerLabel: first?.speakerLabel,
  };
}

function splitChunks(words: string[], seed: string, maxWords: 2 | 3 | 4): string[][] {
  const chunks: string[][] = [];
  let index = 0;

  while (index < words.length) {
    const remaining = words.length - index;
    if (remaining <= maxWords) {
      chunks.push(words.slice(index));
      break;
    }

    const size =
      maxWords === 4 && chance(`${seed}:${index}:4`, 0.12)
        ? 4
        : maxWords >= 3 && chance(`${seed}:${index}:3`, 0.38)
          ? 3
          : 2;
    chunks.push(words.slice(index, index + Math.min(size, remaining)));
    index += size;
  }

  return chunks;
}

function positionStyle(position: CaptionSettings["position"]): React.CSSProperties {
  if (position === "top" || position === "top-left") return { justifyContent: "flex-start", alignItems: "flex-start" };
  if (position === "top-right") return { justifyContent: "flex-start", alignItems: "flex-end" };
  if (position === "bottom" || position === "bottom-left") return { justifyContent: "flex-end", alignItems: "flex-start" };
  if (position === "bottom-right") return { justifyContent: "flex-end", alignItems: "flex-end" };
  return { justifyContent: "center", alignItems: "center" };
}

function resolveColor(color: string | undefined) {
  if (!color) return undefined;
  return colors[color.trim().replace(/^text-/, "").toLowerCase()] || color;
}

function isBrandOrName(word: string) {
  const cleaned = cleanWord(word);
  return brandWords.has(cleaned) || /^[A-Z0-9]{2,}$/.test(word.replace(/[^\w]/g, "")) || /\d/.test(word);
}

function cleanWord(word: string) {
  return word.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, "");
}

function chance(seed: string, frequency: number) {
  return (hashString(seed) % 1000) / 1000 < frequency;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
