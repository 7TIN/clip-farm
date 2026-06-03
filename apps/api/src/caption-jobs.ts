import { renderCaptionedClip } from "./caption-renderer";
import {
  readCaptionJob,
  readJob,
  readJsonFile,
  saveCaptionJob,
  saveJob,
  videoPaths,
  writeJsonFile,
} from "./storage";
import type {
  CaptionJobState,
  CaptionJobStatus,
  CaptionSettings,
  ClipJson,
  JobState,
  TranscriptJson,
  VideoMetadata,
} from "./types";

export async function startCaptionJob(
  videoId: string,
  clipId: string,
  renderVersion: string | undefined,
  settings: CaptionSettings,
) {
  const now = new Date().toISOString();
  const job: CaptionJobState = {
    jobId: `caption_${crypto.randomUUID()}`,
    videoId,
    clipId,
    renderVersion,
    status: "queued",
    progress: 1,
    message: "Queued caption render.",
    settings,
    createdAt: now,
    updatedAt: now,
  };

  await saveCaptionJob(job);
  queueMicrotask(() => {
    void processCaptionJob(job);
  });

  return job;
}

async function processCaptionJob(job: CaptionJobState) {
  const paths = videoPaths(job.videoId);

  try {
    await updateCaptionJob(job, "preparing", 5, "Loading saved clip and transcript.");
    const [metadata, transcript, clips] = await Promise.all([
      readJsonFile<VideoMetadata>(paths.metadataJson),
      readJsonFile<TranscriptJson>(paths.transcriptJson),
      readJsonFile<ClipJson[]>(paths.clipsJson),
    ]);

    if (!metadata || !transcript || !clips) {
      throw new Error("Video metadata, transcript, or clips JSON is missing.");
    }

    const clip = findClip(clips, job.clipId, job.renderVersion);
    if (!clip) {
      throw new Error("Clip was not found.");
    }

    const output = await renderCaptionedClip({
      videoId: job.videoId,
      clip,
      transcript,
      settings: job.settings,
      onProgress: (progress, message) => updateCaptionJob(job, "rendering", progress, message),
    });

    await updateCaptionJob(job, "preparing", 96, "Updating clip JSON.");
    const updatedClips = clips.map((item) =>
      isSameClip(item, job.clipId, job.renderVersion)
        ? {
            ...item,
            captionedOutputPath: output.outputPath,
            captionStyle: job.settings.style,
            captionEffect: job.settings.effect,
            captionPosition: job.settings.position,
            captionRenderVersion: output.captionRenderVersion,
          }
        : item,
    );

    await writeJsonFile(paths.clipsJson, updatedClips);
    const mainJob = await writeMainJob(job.videoId, metadata, transcript, updatedClips);
    await completeCaptionJob(job, mainJob);
  } catch (error) {
    await failCaptionJob(job, error);
  }
}

async function updateCaptionJob(
  original: CaptionJobState,
  status: CaptionJobStatus,
  progress: number,
  message: string,
) {
  const existing = await readCaptionJob(original.videoId, original.jobId);
  if (!existing) {
    return;
  }

  await saveCaptionJob({
    ...existing,
    status,
    progress: Math.min(99, Math.max(1, progress)),
    message,
    updatedAt: new Date().toISOString(),
  });
}

async function completeCaptionJob(original: CaptionJobState, mainJob: JobState) {
  const existing = await readCaptionJob(original.videoId, original.jobId);
  if (!existing) {
    return;
  }

  await saveCaptionJob({
    ...existing,
    status: "complete",
    progress: 100,
    message: "Caption render complete.",
    updatedAt: new Date().toISOString(),
    result: mainJob.result,
  });
}

async function failCaptionJob(original: CaptionJobState, error: unknown) {
  const existing = await readCaptionJob(original.videoId, original.jobId);
  if (!existing) {
    return;
  }

  await saveCaptionJob({
    ...existing,
    status: "failed",
    progress: Math.max(existing.progress, 1),
    message: "Caption render failed.",
    error: error instanceof Error ? error.message : "Unknown caption render error.",
    updatedAt: new Date().toISOString(),
  });
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

function findClip(clips: ClipJson[], clipId: string, renderVersion?: string) {
  return clips.find((clip) => isSameClip(clip, clipId, renderVersion));
}

function isSameClip(clip: ClipJson, clipId: string, renderVersion?: string) {
  if (clip.id !== clipId) {
    return false;
  }

  if (renderVersion) {
    return clip.renderVersion === renderVersion;
  }

  return !clip.renderVersion;
}