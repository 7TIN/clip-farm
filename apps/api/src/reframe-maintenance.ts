import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { renderClipsForVideo } from "./clip-renderer";
import { renderClip } from "./ffmpeg";
import { resolveReframeSettings, settingsSlug } from "./reframe-settings";
import {
  readJob,
  readJsonFile,
  saveJob,
  videoPaths,
  writeJsonFile,
} from "./storage";
import type {
  ClipJson,
  JobState,
  ReframeJobState,
  ReframeJobSummary,
  ReframeSettings,
  TranscriptJson,
  VideoMetadata,
} from "./types";

export async function listReframeJobs(videoId: string): Promise<ReframeJobSummary[]> {
  const paths = videoPaths(videoId);
  const entries = await readdir(paths.reframeJobsDir, { withFileTypes: true }).catch(() => []);
  const jobs = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readJsonFile<ReframeJobState>(path.join(paths.reframeJobsDir, entry.name))),
  );
  const files = await readdir(paths.clipsDir).catch(() => []);

  return jobs
    .filter((job): job is ReframeJobState => Boolean(job))
    .map((job) => {
      const settings = resolveReframeSettings(job.settings);
      const slug = settingsSlug(settings);
      return {
        jobId: job.jobId,
        videoId: job.videoId,
        status: job.status,
        progress: job.progress,
        message: job.message,
        settings,
        clipFileCount: files.filter((file) => file.includes(`_${slug}.`)).length,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        error: job.error,
      };
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function deleteReframeVariant(videoId: string, settings: ReframeSettings) {
  const paths = videoPaths(videoId);
  const slug = settingsSlug(settings);
  const [metadata, transcript, clips] = await Promise.all([
    readJsonFile<VideoMetadata>(paths.metadataJson),
    readJsonFile<TranscriptJson>(paths.transcriptJson),
    readJsonFile<ClipJson[]>(paths.clipsJson),
  ]);

  if (!metadata || !transcript || !clips) {
    throw new Error("Video metadata, transcript, or clips JSON is missing.");
  }

  const deletedClipFiles = await deleteClipFilesForSlug(paths.clipsDir, slug);
  const deletedCropMetadata = await deleteFileIfExists(path.join(paths.reframesDir, `${slug}.crop.json`));
  const deletedJobs = await deleteReframeJobsForSlug(paths.reframeJobsDir, slug);
  const restoredClips = await restoreBaseClipsAfterVariantDelete(metadata.originalPath, paths.clipsDir, clips, slug);

  await writeJsonFile(paths.clipsJson, restoredClips);
  const mainJob = await writeMainJob(videoId, metadata, transcript, restoredClips);

  return {
    deletedClipFiles,
    deletedCropMetadata,
    deletedJobs,
    restoredClipCount: restoredClips.length,
    job: mainJob,
  };
}

export async function repairMissingClipFiles(videoId: string) {
  const paths = videoPaths(videoId);
  const [metadata, transcript, clips] = await Promise.all([
    readJsonFile<VideoMetadata>(paths.metadataJson),
    readJsonFile<TranscriptJson>(paths.transcriptJson),
    readJsonFile<ClipJson[]>(paths.clipsJson),
  ]);

  if (!metadata || !transcript || !clips) {
    throw new Error("Video metadata, transcript, or clips JSON is missing.");
  }

  const repaired = [...clips];
  const missingGroups = new Map<string, { settings?: ReframeSettings; clips: ClipJson[] }>();

  for (const clip of repaired) {
    const outputPath = clip.outputPath || path.join(paths.clipsDir, `${clip.id}.mp4`);
    if (await fileExists(outputPath)) {
      continue;
    }

    const settings = settingsFromClip(clip);
    const groupKey = settings ? settingsSlug(settings) : "base";
    const group = missingGroups.get(groupKey) || { settings, clips: [] };
    group.clips.push({
      ...clip,
      outputPath,
    });
    missingGroups.set(groupKey, group);
  }

  let repairedCount = 0;
  for (const group of missingGroups.values()) {
    if (group.settings) {
      const rendered = await renderClipsForVideo(videoId, metadata.originalPath, group.clips, group.settings);
      for (const renderedClip of rendered) {
        replaceClip(repaired, renderedClip);
      }
      repairedCount += rendered.length;
      continue;
    }

    for (const clip of group.clips) {
      const outputPath = await renderClip(metadata.originalPath, stripReframeFields(clip), paths.clipsDir);
      replaceClip(repaired, {
        ...stripReframeFields(clip),
        outputPath,
        status: "rendered",
      });
      repairedCount += 1;
    }
  }

  await writeJsonFile(paths.clipsJson, repaired);
  const mainJob = await writeMainJob(videoId, metadata, transcript, repaired);

  return {
    repairedCount,
    job: mainJob,
  };
}

async function restoreBaseClipsAfterVariantDelete(
  inputPath: string,
  clipsDir: string,
  clips: ClipJson[],
  slug: string,
) {
  const kept = clips.filter((clip) => !isClipForSlug(clip, slug));
  const removed = clips.filter((clip) => isClipForSlug(clip, slug));
  const hasBaseClip = (clipId: string) =>
    kept.some((clip) => clip.id === clipId && !clip.renderVersion && !clip.aspectRatio);
  const restored = [...kept];

  for (const clip of removed) {
    if (hasBaseClip(clip.id) || restored.some((item) => item.id === clip.id && !item.renderVersion)) {
      continue;
    }

    const baseClip = stripReframeFields(clip);
    const baseOutputPath = path.join(clipsDir, `${clip.id}.mp4`);
    const outputPath = (await fileExists(baseOutputPath))
      ? baseOutputPath
      : await renderClip(inputPath, baseClip, clipsDir);

    restored.push({
      ...baseClip,
      outputPath,
      status: "rendered",
    });
  }

  return restored;
}

async function deleteClipFilesForSlug(clipsDir: string, slug: string) {
  const files = await readdir(clipsDir).catch(() => []);
  let deleted = 0;

  for (const file of files) {
    if (!file.includes(`_${slug}.`)) {
      continue;
    }

    if (await deleteFileIfExists(path.join(clipsDir, file))) {
      deleted += 1;
    }
  }

  return deleted;
}

async function deleteReframeJobsForSlug(reframeJobsDir: string, slug: string) {
  const entries = await readdir(reframeJobsDir, { withFileTypes: true }).catch(() => []);
  let deleted = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(reframeJobsDir, entry.name);
    const job = await readJsonFile<ReframeJobState>(filePath);
    if (!job || settingsSlug(job.settings) !== slug) {
      continue;
    }

    if (await deleteFileIfExists(filePath)) {
      deleted += 1;
    }
  }

  return deleted;
}

async function writeMainJob(
  videoId: string,
  video: VideoMetadata,
  transcript: TranscriptJson,
  clips: ClipJson[],
): Promise<JobState> {
  const existingJob = await readJob(videoId);
  const now = new Date().toISOString();
  const mainJob: JobState = {
    jobId: existingJob?.jobId || `cached_${videoId}`,
    videoId,
    status: "complete",
    progress: 100,
    message: "Processing complete.",
    createdAt: existingJob?.createdAt || video.createdAt || now,
    updatedAt: now,
    result: {
      video,
      transcript,
      clips,
    },
  };
  await saveJob(mainJob);
  return mainJob;
}

function isClipForSlug(clip: ClipJson, slug: string) {
  return clip.renderVersion === slug || Boolean(clip.outputPath?.includes(`_${slug}.`));
}

function stripReframeFields(clip: ClipJson): ClipJson {
  const {
    aspectRatio,
    reframeMode,
    normalStrategy,
    smartLayout,
    outputWidth,
    outputHeight,
    renderVersion,
    mediaUrl,
    ...baseClip
  } = clip;

  return {
    ...baseClip,
    outputPath: path.join(videoPaths(clip.videoId).clipsDir, `${clip.id}.mp4`),
  };
}

function settingsFromClip(clip: ClipJson) {
  if (!clip.aspectRatio || !clip.reframeMode) {
    return undefined;
  }

  return resolveReframeSettings({
    aspectRatio: clip.aspectRatio,
    reframeMode: clip.reframeMode,
    normalStrategy: clip.normalStrategy,
    smartLayout: clip.smartLayout,
  });
}

function replaceClip(clips: ClipJson[], replacement: ClipJson) {
  const index = clips.findIndex((clip) => clip.id === replacement.id && clip.renderVersion === replacement.renderVersion);

  if (index >= 0) {
    clips[index] = replacement;
    return;
  }

  const byId = clips.findIndex((clip) => clip.id === replacement.id);
  if (byId >= 0) {
    clips[byId] = replacement;
    return;
  }

  clips.push(replacement);
}

async function fileExists(filePath: string) {
  return Bun.file(filePath).exists();
}

async function deleteFileIfExists(filePath: string) {
  if (!(await fileExists(filePath))) {
    return false;
  }

  await rm(filePath, { force: true });
  return true;
}
