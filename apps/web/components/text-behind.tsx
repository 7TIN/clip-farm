"use client";

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { TextBehindSettings, TextBehindWord } from "@/lib/types";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadDancing } from "@remotion/google-fonts/DancingScript";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadMerriweather } from "@remotion/google-fonts/Merriweather";
import { loadFont as loadPacifico } from "@remotion/google-fonts/Pacifico";

const fontMap: Record<string, string> = {
  Inter: loadInter().fontFamily,
  "Playfair Display": loadPlayfair().fontFamily,
  "Dancing Script": loadDancing().fontFamily,
  Oswald: loadOswald().fontFamily,
  Merriweather: loadMerriweather().fontFamily,
  Pacifico: loadPacifico().fontFamily,
};

function resolveFontFamily(displayName: string): string {
  return fontMap[displayName] ?? fontMap.Inter;
}

function activeTextBehindWord(
  words: TextBehindWord[],
  currentMs: number,
): TextBehindWord | null {
  return words.find(
    (word) => currentMs >= word.startMs && currentMs < word.endMs,
  ) ?? null;
}

export function TextBehind({
  textBehind,
}: {
  textBehind: TextBehindSettings;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!textBehind.enabled || textBehind.words.length === 0) return null;

  const currentMs = (frame / fps) * 1000;
  const activeWord = activeTextBehindWord(textBehind.words, currentMs);

  if (!activeWord) return null;

  const wordStartMs = activeWord.startMs;
  const wordEndMs = activeWord.endMs;
  const wordDurationMs = wordEndMs - wordStartMs;
  const wordStartFrame = (wordStartMs / 1000) * fps;
  const wordRelativeFrame = frame - wordStartFrame;

  const entrance = spring({
    frame: wordRelativeFrame,
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const exitFrame = (wordDurationMs / 1000) * fps - Math.round(fps * 0.3);
  const exitProgress = wordRelativeFrame > exitFrame
    ? interpolate(
        wordRelativeFrame,
        [exitFrame, exitFrame + Math.round(fps * 0.3)],
        [1, 0],
        { extrapolateRight: "clamp" },
      )
    : 1;

  const opacity = interpolate(entrance, [0, 1], [0, 1]) * exitProgress;
  const scale = interpolate(entrance, [0, 1], [0.3, 1]) * (0.8 + exitProgress * 0.2);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: resolveFontFamily(textBehind.fontFamily),
          fontSize: 140,
          fontWeight: 900,
          color: textBehind.color,
          opacity,
          transform: `scale(${scale})`,
          textAlign: "center",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          textShadow: `0 0 40px ${textBehind.color}40, 0 0 80px ${textBehind.color}20`,
          maxWidth: "90%",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {activeWord.text}
      </div>
    </AbsoluteFill>
  );
}
