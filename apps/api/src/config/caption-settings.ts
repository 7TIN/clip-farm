import type {
  CaptionEffect,
  CaptionPosition,
  CaptionSettings,
  CaptionStylePreset,
  TextBehindSettings,
} from "../types";

const styles: CaptionStylePreset[] = ["basic", "hormozi", "bubbly"];
const effects: CaptionEffect[] = ["none", "magic"];
const positions: CaptionPosition[] = ["top", "center", "bottom"];

export const defaultCaptionSettings = resolveCaptionSettings({});

function defaultTextBehind(): TextBehindSettings {
  return {
    enabled: false,
    color: "#ffffff",
    fontFamily: "Inter",
    words: [],
  };
}

export function resolveCaptionSettings(input: Record<string, unknown>): CaptionSettings {
  const rawTextBehind = input.textBehind as Record<string, unknown> | undefined;
  return {
    style: coerceChoice(input.style, styles, "hormozi"),
    effect: coerceChoice(input.effect, effects, "magic"),
    position: coerceChoice(input.position, positions, "bottom"),
    maxWordsPerPage: coerceNumber(input.maxWordsPerPage, 6, 2, 10),
    maxPageDurationMs: coerceNumber(input.maxPageDurationMs, 1800, 700, 3500),
    textBehind: rawTextBehind
      ? {
          enabled: coerceBoolean(rawTextBehind.enabled, false),
          color: coerceString(rawTextBehind.color, "#ffffff"),
          fontFamily: coerceString(rawTextBehind.fontFamily, "Inter"),
          words: Array.isArray(rawTextBehind.words) ? rawTextBehind.words : [],
        }
      : defaultTextBehind(),
  };
}

export function captionSettingsSlug(settings: CaptionSettings) {
  const tb = settings.textBehind.enabled ? `-tb` : "";
  return `${settings.style}-${settings.effect}-${settings.position}${tb}`;
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

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function coerceString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.length > 0) return value;
  return fallback;
}