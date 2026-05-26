import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { bundle } from "@remotion/bundler";
import { getCompositions, openBrowser, renderFrames } from "@remotion/renderer";

import { readClipMediaDetails, encodeCaptionFramesToMp4 } from "./ffmpeg";
import { wordsForClip } from "./caption-words";
import { captionSettingsSlug } from "./caption-settings";
import { tmpRoot, videoPaths } from "./storage";
import type { CaptionSettings, CaptionWord, ClipJson, TranscriptJson } from "./types";

export type RenderCaptionedClipInput = {
  videoId: string;
  clip: ClipJson;
  transcript: TranscriptJson;
  settings: CaptionSettings;
  onProgress?: (progress: number, message: string) => Promise<void> | void;
};

export type CaptionRenderResult = {
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
};

export async function renderCaptionedClip({
  videoId,
  clip,
  transcript,
  settings,
  onProgress,
}: RenderCaptionedClipInput): Promise<CaptionRenderResult> {
  const clipPath = clip.outputPath;

  if (!clipPath) {
    throw new Error("Clip output path is missing.");
  }

  await onProgress?.(10, "Probing clip media details.");

  const mediaDetails = await readClipMediaDetails(clipPath);

  await onProgress?.(15, "Converting transcript words for captions.");

  const captionWords = wordsForClip(transcript, clip);

  if (!captionWords.length) {
    throw new Error("No timestamped words available for captions.");
  }

  const paths = videoPaths(videoId);
  const slug = captionSettingsSlug(settings);
  const clipRenderSlug = clip.renderVersion || "original";
  const outputFilename = `${clip.id}_${clipRenderSlug}_${slug}.mp4`;
  const outputPath = path.join(paths.captionsDir, outputFilename);

  const jobTmp = path.join(tmpRoot, `${clip.id}_${slug}`);
  const framesDir = path.join(jobTmp, "frames");

  await mkdir(framesDir, { recursive: true });

  try {
    await onProgress?.(20, "Bundling Remotion composition.");

    const fileUrl = `file:///${clipPath.replace(/\\/g, "/")}`;

    const captionedWords = captionWords.map((word, index) => ({
      text: word.text,
      startMs: word.startMs,
      endMs: word.endMs,
      timestampMs: word.timestampMs,
      confidence: word.confidence,
      index,
    }));

    const bundled = await bundle({
      entryPoint: path.resolve(import.meta.dir, "captions/remotion/index.ts"),
    });

    const inputProps = {
      clipSrc: fileUrl,
      captions: captionedWords,
      style: settings.style,
      effect: settings.effect,
      position: settings.position,
      fps: mediaDetails.fps,
      width: mediaDetails.width,
      height: mediaDetails.height,
      maxWordsPerPage: settings.maxWordsPerPage,
      maxPageDurationMs: settings.maxPageDurationMs,
    };

    const compositions = await getCompositions(bundled, { inputProps });
    const composition = compositions.find((item) => item.id === "CaptionedClip");

    if (!composition) {
      throw new Error("Remotion composition 'CaptionedClip' was not found.");
    }

    const puppeteerInstance = await openBrowser("chrome");

    try {
      await onProgress?.(25, "Rendering caption frames.");

      const totalFrames = mediaDetails.durationInFrames;

      await renderFrames({
        serveUrl: bundled,
        composition: {
          ...composition,
          durationInFrames: totalFrames,
          fps: mediaDetails.fps,
          width: mediaDetails.width,
          height: mediaDetails.height,
        },
        inputProps,
        imageFormat: "png",
        outputDir: framesDir,
        puppeteerInstance,
        onStart: () => {},
        onFrameUpdate: (frame: number) => {
          const progress = 25 + Math.round((frame / totalFrames) * 65);
          void onProgress?.(progress, `Rendering frame ${frame + 1} of ${totalFrames}.`);
        },
      });

      await onProgress?.(90, "Encoding MP4 with FFmpeg.");
      await encodeCaptionFramesToMp4(framesDir, clipPath, outputPath, mediaDetails.fps);

      await onProgress?.(95, "Finalizing output.");
    } finally {
      await puppeteerInstance.close({ silent: true });
    }

    return {
      outputPath,
      width: mediaDetails.width,
      height: mediaDetails.height,
      fps: mediaDetails.fps,
      durationMs: mediaDetails.durationMs,
    };
  } finally {
    await rm(jobTmp, { recursive: true, force: true }).catch(() => {});
  }
}
