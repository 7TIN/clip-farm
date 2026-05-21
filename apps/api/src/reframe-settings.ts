import type {
  AspectRatio,
  NormalReframeStrategy,
  ReframeMode,
  ReframeSettings,
} from "./types";

const dimensionsByRatio: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

const aspectRatios = Object.keys(dimensionsByRatio) as AspectRatio[];
const modes: ReframeMode[] = ["normal", "smart"];
const normalStrategies: NormalReframeStrategy[] = ["crop", "blur-background", "pad"];

export const defaultReframeSettings = resolveReframeSettings({});

export function resolveReframeSettings(input: Record<string, unknown>): ReframeSettings {
  const aspectRatio = coerceChoice(input.aspectRatio, aspectRatios, "16:9");
  const mode = coerceChoice(input.reframeMode || input.mode, modes, "normal");
  const normalStrategy = coerceChoice(
    input.normalStrategy,
    normalStrategies,
    "crop",
  );
  const dimensions = dimensionsByRatio[aspectRatio];

  return {
    aspectRatio,
    mode,
    normalStrategy,
    targetWidth: dimensions.width,
    targetHeight: dimensions.height,
  };
}

export function settingsSlug(settings: ReframeSettings) {
  const ratio = settings.aspectRatio.replace(":", "x");
  const mode = settings.mode === "normal" ? `normal-${settings.normalStrategy}` : "smart-face";
  return `${ratio}-${mode}`;
}

function coerceChoice<T extends string>(value: unknown, choices: T[], fallback: T): T {
  if (typeof value === "string" && choices.includes(value as T)) {
    return value as T;
  }

  return fallback;
}
