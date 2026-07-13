import type {
  CaptionEffect,
  CaptionPosition,
  CaptionSettings,
  CaptionStylePreset,
} from "../types";

const styles: CaptionStylePreset[] = [
  "basic",
  "hormozi",
  "bubbly",
  "aesthetic",
  "editorial",
  "punchy",
  "minimal",
];
const effects: CaptionEffect[] = ["none", "magic"];
const positions: CaptionPosition[] = [
  "top",
  "center",
  "bottom",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export const defaultCaptionSettings = resolveCaptionSettings({});

export function resolveCaptionSettings(input: Record<string, unknown>): CaptionSettings {
  return {
    style: coerceChoice(input.style, styles, "aesthetic"),
    effect: coerceChoice(input.effect, effects, "none"),
    position: coerceChoice(input.position, positions, "center"),
    maxWordsPerPage: coerceNumber(input.maxWordsPerPage, 6, 2, 10),
    maxPageDurationMs: coerceNumber(input.maxPageDurationMs, 1800, 700, 3500),
    specialFontColor: coerceString(input.specialFontColor, "yellow-300"),
    normalColor: coerceString(input.normalColor, "#ffffff"),
    mutedColor: coerceString(input.mutedColor, "#e4e4e7"),
    stylishFrequency: coerceNumber(input.stylishFrequency, 0.22, 0, 0.6, 100),
    verticalFrequency: coerceNumber(input.verticalFrequency, 0.34, 0, 0.8, 100),
    boldFrequency: coerceNumber(input.boldFrequency, 0.18, 0, 0.6, 100),
    maxWordsPerScene: Number(
      coerceChoice(String(input.maxWordsPerScene), ["2", "3", "4"], "3"),
    ) as 2 | 3 | 4,
    normalFontSize: coerceNumber(input.normalFontSize, 72, 48, 96),
    stylishFontSize: coerceNumber(input.stylishFontSize, 88, 56, 112),
    formalFontSize: coerceNumber(input.formalFontSize, 64, 44, 96),
    boldFontSize: coerceNumber(input.boldFontSize, 118, 72, 156),
    normalFontWeight: coerceNumber(input.normalFontWeight, 760, 300, 900, 10),
    formalFontWeight: coerceNumber(input.formalFontWeight, 430, 300, 900, 10),
    boldFontWeight: coerceNumber(input.boldFontWeight, 900, 600, 900, 10),
  };
}

export function captionSettingsSlug(settings: CaptionSettings) {
  const color = settings.specialFontColor.replace(/[^a-z0-9-]/gi, "");
  return [
    settings.style,
    settings.position,
    color,
    settings.maxWordsPerScene,
    Math.round(settings.stylishFrequency * 100),
    Math.round(settings.verticalFrequency * 100),
    Math.round(settings.boldFrequency * 100),
  ].join("-");
}

function coerceChoice<T extends string>(value: unknown, choices: T[], fallback: T): T {
  if (typeof value === "string" && choices.includes(value as T)) {
    return value as T;
  }

  return fallback;
}

function coerceNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  roundTo = 1,
) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const clamped = Math.min(max, Math.max(min, parsed));
  return Math.round(clamped * roundTo) / roundTo;
}

function coerceString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
