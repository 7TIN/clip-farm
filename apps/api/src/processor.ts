import { createRandomClips } from "./clips";
import { renderClipsForVideo } from "./clip-renderer";
import { extractAudio, readVideoDetails } from "./ffmpeg";
import { defaultReframeSettings } from "./reframe-settings";
import {
  readJob,
  readVideoMetadata,
  saveJob,
  saveVideoMetadata,
  videoPaths,
  writeJsonFile,
} from "./storage";
import { transcribeAudio } from "./transcription";
import type {
  ClipJson,
  JobState,
  JobStatus,
  ReframeSettings,
  TranscriptJson,
  VideoMetadata,
} from "./types";

type ProcessingOptions = {
  language: string;
  reframeSettings?: ReframeSettings;
};

export async function startProcessing(videoId: string, options: ProcessingOptions) {
  const now = new Date().toISOString();
  const job: JobState = {
    jobId: `job_${crypto.randomUUID()}`,
    videoId,
    status: "queued",
    progress: 1,
    message: "Queued for processing.",
    createdAt: now,
    updatedAt: now,
  };

  await saveJob(job);
  queueMicrotask(() => {
    void processVideo(job, options);
  });

  return job;
}

async function processVideo(job: JobState, options: ProcessingOptions) {
  const paths = videoPaths(job.videoId);

  try {
    await updateJob(job.videoId, "extracting_audio", 10, "Reading video metadata.");

    const metadata = await loadMetadata(job.videoId);
    const videoDetails = await readVideoDetails(metadata.originalPath);
    const updatedMetadata: VideoMetadata = {
      ...metadata,
      ...videoDetails,
    };
    await saveVideoMetadata(updatedMetadata);

    await updateJob(job.videoId, "extracting_audio", 25, "Extracting mono 16 kHz audio with FFmpeg.");
    await extractAudio(metadata.originalPath, paths.audio);

    await saveVideoMetadata({
      ...updatedMetadata,
      audioPath: paths.audio,
    });

    await updateJob(job.videoId, "transcribing", 45, "Transcribing audio with Smallest.ai Pulse.");
    const transcript = await transcribeAudio(paths.audio, job.videoId, options.language);
    await writeJsonFile(paths.transcriptJson, transcript);

    await updateJob(job.videoId, "generating_clips", 70, "Creating random transcript-aware clips.");
    const suggestedClips = createRandomClips(transcript);
    await writeJsonFile(paths.clipsJson, suggestedClips);

    await updateJob(job.videoId, "rendering_clips", 78, "Rendering clips with FFmpeg.");
    const settings = options.reframeSettings || defaultReframeSettings;
    const renderedClips: ClipJson[] = await renderClipsForVideo(
      job.videoId,
      metadata.originalPath,
      suggestedClips,
      settings,
      async (index, total, clip) => {
        const progress = 78 + Math.round(((index + 1) / total) * 17);
        await updateJob(job.videoId, "rendering_clips", progress, `Rendering ${clip.title}.`);
      },
    );

    const finalMetadata = (await readVideoMetadata(job.videoId)) || updatedMetadata;
    await writeJsonFile(paths.clipsJson, renderedClips);

    await completeJob(job.videoId, finalMetadata, transcript, renderedClips);
  } catch (error) {
    await failJob(job.videoId, error);
  }
}

async function loadMetadata(videoId: string) {
  const metadata = await readVideoMetadata(videoId);

  if (!metadata) {
    throw new Error("Video metadata was not found.");
  }

  return metadata;
}

async function updateJob(videoId: string, status: JobStatus, progress: number, message: string) {
  const job = await readJob(videoId);

  if (!job) {
    throw new Error("Video job was not found.");
  }

  await saveJob({
    ...job,
    status,
    progress,
    message,
    updatedAt: new Date().toISOString(),
  });
}

async function completeJob(
  videoId: string,
  video: VideoMetadata,
  transcript: TranscriptJson,
  clips: ClipJson[],
) {
  const job = await readJob(videoId);

  if (!job) {
    throw new Error("Video job was not found.");
  }

  await saveJob({
    ...job,
    status: "complete",
    progress: 100,
    message: "Processing complete.",
    updatedAt: new Date().toISOString(),
    result: {
      video,
      transcript,
      clips,
    },
  });
}

async function failJob(videoId: string, error: unknown) {
  const job = await readJob(videoId);
  const message = error instanceof Error ? error.message : "Unknown processing error.";

  if (!job) {
    return;
  }

  await saveJob({
    ...job,
    status: "failed",
    progress: Math.max(job.progress, 1),
    message: "Processing failed.",
    error: message,
    updatedAt: new Date().toISOString(),
  });
}
