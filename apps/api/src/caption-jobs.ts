import {
  findCaptionJob,
  readCaptionJob,
  readJsonFile,
  readStoredVideoJob,
  saveCaptionJob,
  saveJob,
  updateClipCaptionResult,
  videoPaths,
} from "./storage";
import { renderCaptionedClip } from "./caption-renderer";
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
    await updateCaptionJob(job.videoId, job.jobId, "preparing", 5, "Loading saved video data.");

    const [metadata, transcript, clips] = await Promise.all([
      readJsonFile<VideoMetadata>(paths.metadataJson),
      readJsonFile<TranscriptJson>(paths.transcriptJson),
      readJsonFile<ClipJson[]>(paths.clipsJson),
    ]);

    if (!metadata) {
      throw new Error("Video metadata was not found.");
    }

    if (!transcript) {
      throw new Error("Transcript was not found. Caption render does not call transcription again.");
    }

    if (!clips?.length) {
      throw new Error("No clips were found.");
    }

    const clip = job.renderVersion
      ? clips.find((c) => c.id === job.clipId && c.renderVersion === job.renderVersion)
      : clips.find((c) => c.id === job.clipId);

    if (!clip) {
      throw new Error(`Clip ${job.clipId} was not found.`);
    }

    if (!clip.outputPath) {
      throw new Error(`Clip ${job.clipId} has no rendered output file. Run repair clips first.`);
    }

    const result = await renderCaptionedClip({
      videoId: job.videoId,
      clip,
      transcript,
      settings: job.settings,
      onProgress: async (progress, message) => {
        await updateCaptionJob(job.videoId, job.jobId, "rendering_frames", progress, message);
      },
    });

    await updateCaptionJob(job.videoId, job.jobId, "encoding", 95, "Updating JSON records.");

    await updateClipCaptionResult(job.videoId, job.clipId, job.renderVersion, {
      ...result,
    });

    const mainJob = await buildUpdatedMainJob(
      job.videoId,
      metadata,
      transcript,
      clips,
    );
    await saveJob(mainJob);

    await completeCaptionJob(job.videoId, job.jobId, result);
  } catch (error) {
    await failCaptionJob(job.videoId, job.jobId, error);
  }
}

async function buildUpdatedMainJob(
  videoId: string,
  video: VideoMetadata,
  transcript: TranscriptJson,
  clips: ClipJson[],
): Promise<JobState> {
  const existingJob = (await readStoredVideoJob(videoId));
  const now = new Date().toISOString();

  return {
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
}

async function updateCaptionJob(
  videoId: string,
  jobId: string,
  status: CaptionJobStatus,
  progress: number,
  message: string,
) {
  const job = await readCaptionJob(videoId, jobId);

  if (!job) {
    throw new Error("Caption job was not found.");
  }

  await saveCaptionJob({
    ...job,
    status,
    progress,
    message,
    updatedAt: new Date().toISOString(),
  });
}

async function completeCaptionJob(
  videoId: string,
  jobId: string,
  result: NonNullable<CaptionJobState["result"]>,
) {
  const job = await readCaptionJob(videoId, jobId);

  if (!job) {
    throw new Error("Caption job was not found.");
  }

  await saveCaptionJob({
    ...job,
    status: "complete",
    progress: 100,
    message: "Caption render complete.",
    updatedAt: new Date().toISOString(),
    result,
  });
}

async function failCaptionJob(videoId: string, jobId: string, error: unknown) {
  const job = await readCaptionJob(videoId, jobId);
  const message = error instanceof Error ? error.message : "Unknown caption error.";

  if (!job) {
    return;
  }

  await saveCaptionJob({
    ...job,
    status: "failed",
    progress: Math.max(job.progress, 1),
    message: "Caption render failed.",
    error: message,
    updatedAt: new Date().toISOString(),
  });
}
