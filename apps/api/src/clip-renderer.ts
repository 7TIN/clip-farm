import path from "node:path";

import { renderClip } from "./ffmpeg";
import { settingsSlug } from "./reframe-settings";
import { analyzeSmartCrop } from "./smart-reframe";
import { videoPaths, writeJsonFile } from "./storage";
import type { ClipJson, ReframeSettings, SmartCropMetadata } from "./types";

type RenderProgress = (index: number, total: number, clip: ClipJson) => Promise<void> | void;

export async function renderClipsForVideo(
  videoId: string,
  inputPath: string,
  clips: ClipJson[],
  settings: ReframeSettings,
  onProgress?: RenderProgress,
) {
  const paths = videoPaths(videoId);
  const smartCrop =
    settings.mode === "smart" ? await analyzeAndSaveSmartCrop(videoId, inputPath, settings) : undefined;
  const renderedClips: ClipJson[] = [];

  for (const [index, clip] of clips.entries()) {
    await onProgress?.(index, clips.length, clip);

    const outputPath = await renderClip(inputPath, clip, paths.clipsDir, settings, smartCrop);
    renderedClips.push({
      ...clip,
      outputPath,
      status: "rendered",
      aspectRatio: settings.aspectRatio,
      reframeMode: settings.mode,
      normalStrategy: settings.normalStrategy,
      smartLayout: settings.smartLayout,
      outputWidth: settings.targetWidth,
      outputHeight: settings.targetHeight,
      renderVersion: settingsSlug(settings),
    });
  }

  return renderedClips;
}

async function analyzeAndSaveSmartCrop(
  videoId: string,
  inputPath: string,
  settings: ReframeSettings,
): Promise<SmartCropMetadata> {
  const paths = videoPaths(videoId);
  const metadata = await analyzeSmartCrop(inputPath, settings);
  const metadataPath = path.join(paths.reframesDir, `${settingsSlug(settings)}.crop.json`);
  await writeJsonFile(metadataPath, metadata);
  return metadata;
}
