import { createReadStream, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

import { captionSettingsSlug } from "../config/caption-settings";
import { wordsForClip } from "./caption-words";
import { readClipMediaDetails } from "../lib/ffmpeg";
import { videoPaths } from "../lib/storage";
import type { CaptionSettings, ClipJson, TranscriptJson } from "../types";

type RenderProgress = (progress: number, message: string) => Promise<void> | void;

type RenderCaptionedClipInput = {
  videoId: string;
  clip: ClipJson;
  transcript: TranscriptJson;
  settings: CaptionSettings;
  onProgress?: RenderProgress;
};

let bundleLocationPromise: Promise<string> | undefined;

export async function renderCaptionedClip({
  videoId,
  clip,
  transcript,
  settings,
  onProgress,
}: RenderCaptionedClipInput) {
  if (!clip.outputPath) {
    throw new Error("Clip file is missing. Render or repair the clip before adding captions.");
  }

  if (!(await Bun.file(clip.outputPath).exists())) {
    throw new Error("Clip output file is missing on disk. Use Repair files before adding captions.");
  }

  await onProgress?.(8, "Reading clip media details.");
  const media = await readClipMediaDetails(clip.outputPath);
  const captions = wordsForClip(transcript, clip);

  if (captions.length === 0) {
    throw new Error("No timestamped words were found for this clip.");
  }

  await onProgress?.(15, "Preparing Remotion bundle.");
  const serveUrl = await getBundleLocation();
  const fileServer = await serveFile(clip.outputPath);
  const paths = videoPaths(videoId);
  const captionSlug = captionSettingsSlug(settings);
  const clipSlug = clip.renderVersion || "base";
  const outputPath = path.join(paths.captionsDir, `${clip.id}_${clipSlug}_${captionSlug}.mp4`);

  await mkdir(paths.captionsDir, { recursive: true });

  try {
    const inputProps = {
      clipSrc: fileServer.url,
      captions,
      style: settings.style,
      effect: settings.effect,
      position: settings.position,
      maxWordsPerPage: settings.maxWordsPerPage,
      maxPageDurationMs: settings.maxPageDurationMs,
      width: media.width,
      height: media.height,
      fps: media.fps,
      durationInFrames: media.durationInFrames,
    };

    const composition = await selectComposition({
      serveUrl,
      id: "CaptionedClip",
      inputProps,
    });

    await onProgress?.(25, "Rendering captioned video with Remotion.");
    await renderMedia({
      imageFormat: "jpeg",
      jpegQuality: 90,
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      // concurrency: Math.max(1, Math.min(4, navigatorHardwareConcurrency())),
      concurrency: 4,
      onProgress: ({ progress }) =>
        onProgress?.(25 + Math.round(progress * 70), "Rendering captioned video."),
    });

    return {
      outputPath,
      width: media.width,
      height: media.height,
      fps: media.fps,
      durationMs: media.durationMs,
      captionRenderVersion: captionSlug,
    };
  } finally {
    fileServer.close();
  }
}

function getBundleLocation() {
  if (!bundleLocationPromise) {
    bundleLocationPromise = bundle({
      entryPoint: path.resolve(import.meta.dir, "captions/remotion/index.tsx"),
    });
  }

  return bundleLocationPromise;
}

function serveFile(filePath: string): Promise<{ url: string; close: () => void }> {
  const { size } = statSync(filePath);

  function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    const range = req.headers.range;

    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : size - 1;
        res.writeHead(206, {
          ...corsHeaders,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Type": "video/mp4",
          "Content-Length": end - start + 1,
        });
        createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.writeHead(200, {
      ...corsHeaders,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Length": size,
    });
    createReadStream(filePath).pipe(res);
  }

  return new Promise((resolve) => {
    const server: Server = createServer(handleRequest);
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}/clip.mp4`,
        close: () => server.close(),
      });
    });
  });
}

function navigatorHardwareConcurrency() {
  return Number(process.env.REMOTION_CONCURRENCY || os.cpus().length || 2);
}
