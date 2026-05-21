import {
  readJob,
  readJsonFile,
  readReframeJob,
  readStoredVideoJob,
  saveJob,
  saveReframeJob,
  videoPaths,
  writeJsonFile,
} from "./storage";
import { renderClipsForVideo } from "./clip-renderer";
import type {
  ClipJson,
  JobState,
  ReframeJobState,
  ReframeJobStatus,
  ReframeSettings,
  TranscriptJson,
  VideoMetadata,
} from "./types";

export async function startReframeJob(videoId: string, settings: ReframeSettings) {
  const now = new Date().toISOString();
  const job: ReframeJobState = {
    jobId: `reframe_${crypto.randomUUID()}`,
    videoId,
    status: "queued",
    progress: 1,
    message: "Queued reframe render.",
    settings,
    createdAt: now,
    updatedAt: now,
  };

  await saveReframeJob(job);
  queueMicrotask(() => {
    void processReframeJob(job);
  });

  return job;
}

async function processReframeJob(job: ReframeJobState) {
  const paths = videoPaths(job.videoId);

  try {
    await updateReframeJob(job.videoId, job.jobId, "analyzing", 10, "Loading saved video data.");

    const [metadata, transcript, clips] = await Promise.all([
      readJsonFile<VideoMetadata>(paths.metadataJson),
      readJsonFile<TranscriptJson>(paths.transcriptJson),
      readJsonFile<ClipJson[]>(paths.clipsJson),
    ]);

    if (!metadata) {
      throw new Error("Video metadata was not found.");
    }

    if (!transcript) {
      throw new Error("Transcript was not found. Reframe does not call transcription again.");
    }

    if (!clips?.length) {
      throw new Error("No clips were found to re-render.");
    }

    const analyzingMessage =
      job.settings.mode === "smart"
        ? "Analyzing face position with Python smart reframe."
        : "Preparing FFmpeg reframe filters.";
    await updateReframeJob(job.videoId, job.jobId, "analyzing", 25, analyzingMessage);

    const renderedClips = await renderClipsForVideo(
      job.videoId,
      metadata.originalPath,
      clips,
      job.settings,
      async (index, total, clip) => {
        const progress = 35 + Math.round(((index + 1) / total) * 55);
        await updateReframeJob(
          job.videoId,
          job.jobId,
          "rendering",
          progress,
          `Rendering ${clip.title}.`,
        );
      },
    );

    await writeJsonFile(paths.clipsJson, renderedClips);
    const mainJob = await buildUpdatedMainJob(job.videoId, metadata, transcript, renderedClips);
    await saveJob(mainJob);

    await completeReframeJob(job.videoId, job.jobId, mainJob);
  } catch (error) {
    await failReframeJob(job.videoId, job.jobId, error);
  }
}

async function buildUpdatedMainJob(
  videoId: string,
  video: VideoMetadata,
  transcript: TranscriptJson,
  clips: ClipJson[],
): Promise<JobState> {
  const existingJob = (await readJob(videoId)) || (await readStoredVideoJob(videoId));
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

async function updateReframeJob(
  videoId: string,
  jobId: string,
  status: ReframeJobStatus,
  progress: number,
  message: string,
) {
  const job = await readReframeJob(videoId, jobId);

  if (!job) {
    throw new Error("Reframe job was not found.");
  }

  await saveReframeJob({
    ...job,
    status,
    progress,
    message,
    updatedAt: new Date().toISOString(),
  });
}

async function completeReframeJob(videoId: string, jobId: string, mainJob: JobState) {
  const job = await readReframeJob(videoId, jobId);

  if (!job) {
    throw new Error("Reframe job was not found.");
  }

  await saveReframeJob({
    ...job,
    status: "complete",
    progress: 100,
    message: "Reframe complete.",
    updatedAt: new Date().toISOString(),
    result: mainJob.result,
  });
}

async function failReframeJob(videoId: string, jobId: string, error: unknown) {
  const job = await readReframeJob(videoId, jobId);
  const message = error instanceof Error ? error.message : "Unknown reframe error.";

  if (!job) {
    return;
  }

  await saveReframeJob({
    ...job,
    status: "failed",
    progress: Math.max(job.progress, 1),
    message: "Reframe failed.",
    error: message,
    updatedAt: new Date().toISOString(),
  });
}
