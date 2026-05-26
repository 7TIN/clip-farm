import type {
  CaptionEffect,
  CaptionPosition,
  CaptionSettings,
  CaptionStylePreset,
} from "./types";

const stylePresets: CaptionStylePreset[] = [
  "basic", "modern", "scribble", "funky", "ali", "classic", "heat",
  "icy", "ghost", "editorial", "tallboy", "elegant", "hormozi", "clean",
  "roundtable", "matrix", "bubbly", "miner",
];

const effects: CaptionEffect[] = ["none", "magic", "squiggle", "scroll"];
const positions: CaptionPosition[] = ["top", "center", "bottom"];

export const defaultCaptionSettings = resolveCaptionSettings({});

export function resolveCaptionSettings(input: Record<string, unknown>): CaptionSettings {
  return {
    style: coerceChoice(input.style, stylePresets, "hormozi"),
    effect: coerceChoice(input.effect, effects, "magic"),
    position: coerceChoice(input.position, positions, "bottom"),
    maxWordsPerPage: coerceNumber(input.maxWordsPerPage, 5, 2, 8),
    maxPageDurationMs: coerceNumber(input.maxPageDurationMs, 1800, 800, 3000),
  };
}

export function captionSettingsSlug(settings: CaptionSettings) {
  return `${settings.style}-${settings.effect}-${settings.position}`;
}

function coerceChoice<T extends string>(value: unknown, choices: T[], fallback: T): T {
  if (typeof value === "string" && choices.includes(value as T)) {
    return value as T;
  }

  return fallback;
}

function coerceNumber(value: unknown, fallback: number, min: number, max: number) {
  const num = typeof value === "number" ? value : Number(value);

  if (Number.isFinite(num)) {
    return Math.max(min, Math.min(max, Math.round(num)));
  }

  return fallback;
}
