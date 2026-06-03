import type {
  CaptionEffect,
  CaptionPosition,
  CaptionSettings,
  CaptionStylePreset,
} from "./types";

const styles: CaptionStylePreset[] = ["basic", "hormozi", "bubbly"];
const effects: CaptionEffect[] = ["none", "magic"];
const positions: CaptionPosition[] = ["top", "center", "bottom"];

export const defaultCaptionSettings = resolveCaptionSettings({});

export function resolveCaptionSettings(input: Record<string, unknown>): CaptionSettings {
  return {
    style: coerceChoice(input.style, styles, "hormozi"),
    effect: coerceChoice(input.effect, effects, "magic"),
    position: coerceChoice(input.position, positions, "bottom"),
    maxWordsPerPage: coerceNumber(input.maxWordsPerPage, 6, 2, 10),
    maxPageDurationMs: coerceNumber(input.maxPageDurationMs, 1800, 700, 3500),
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
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}