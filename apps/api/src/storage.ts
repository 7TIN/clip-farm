import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import type {
  ClipJson,
  JobState,
  StoredVideoSummary,
  TranscriptJson,
  VideoMetadata,
} from "./types";

const rootDir = path.resolve(import.meta.dir, "../../..");
export const storageRoot = path.join(rootDir, "storage");

export function videoPaths(videoId: string) {
  const baseDir = path.join(storageRoot, "videos", videoId);
  const clipsDir = path.join(baseDir, "clips");

  return {
    baseDir,
    clipsDir,
    originalVideo: path.join(baseDir, "original.mp4"),
    audio: path.join(baseDir, "audio.wav"),
    metadataJson: path.join(baseDir, "metadata.json"),
    jobJson: path.join(baseDir, "job.json"),
    transcriptJson: path.join(baseDir, "transcript.json"),
    clipsJson: path.join(baseDir, "clips.json"),
  };
}

export async function ensureVideoDirs(videoId: string) {
  const paths = videoPaths(videoId);
  await mkdir(paths.clipsDir, { recursive: true });
  return paths;
}

export async function createVideoRecord(video: File) {
  const videoId = `vid_${crypto.randomUUID()}`;
  const paths = await ensureVideoDirs(videoId);
  const originalFilename = video.name || "original.mp4";
  const extension = sanitizeExtension(path.extname(originalFilename));
  const originalPath = path.join(paths.baseDir, `original${extension}`);

  await Bun.write(originalPath, video);

  const metadata: VideoMetadata = {
    id: videoId,
    originalFilename,
    originalPath,
    createdAt: new Date().toISOString(),
  };

  await writeJsonFile(paths.metadataJson, metadata);

  return {
    videoId,
    paths,
    metadata,
  };
}

function sanitizeExtension(extension: string) {
  if (/^\.[a-z0-9]{1,8}$/i.test(extension)) {
    return extension.toLowerCase();
  }

  return ".mp4";
}

export async function readVideoMetadata(videoId: string) {
  const paths = videoPaths(videoId);
  return readJsonFile<VideoMetadata>(paths.metadataJson);
}

export async function saveVideoMetadata(metadata: VideoMetadata) {
  const paths = videoPaths(metadata.id);
  await writeJsonFile(paths.metadataJson, metadata);
}

export async function readJob(videoId: string) {
  const paths = videoPaths(videoId);
  return readJsonFile<JobState>(paths.jobJson);
}

export async function saveJob(job: JobState) {
  const paths = await ensureVideoDirs(job.videoId);
  await writeJsonFile(paths.jobJson, job);
}

export async function getClipById(videoId: string, clipId: string) {
  const paths = videoPaths(videoId);
  const clips = await readJsonFile<ClipJson[]>(paths.clipsJson);
  return clips?.find((clip) => clip.id === clipId);
}

export async function listStoredVideos(): Promise<StoredVideoSummary[]> {
  const videosRoot = path.join(storageRoot, "videos");
  const entries = await readdir(videosRoot, { withFileTypes: true }).catch(() => []);
  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const videoId = entry.name;
        const paths = videoPaths(videoId);
        const [metadata, job, transcript, clips] = await Promise.all([
          readJsonFile<VideoMetadata>(paths.metadataJson),
          readJsonFile<JobState>(paths.jobJson),
          readJsonFile<TranscriptJson>(paths.transcriptJson),
          readJsonFile<ClipJson[]>(paths.clipsJson),
        ]);

        return {
          id: videoId,
          title: metadata?.originalFilename || videoId,
          status: job?.status || (transcript && clips ? "complete" : "failed"),
          progress: job?.progress || (transcript && clips ? 100 : 0),
          durationMs: metadata?.durationMs || transcript?.durationMs,
          clipCount: clips?.length || 0,
          hasTranscript: Boolean(transcript),
          createdAt: metadata?.createdAt || job?.createdAt,
          updatedAt: job?.updatedAt,
        } satisfies StoredVideoSummary;
      }),
  );

  return summaries.sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt || "");
    const bTime = Date.parse(b.updatedAt || b.createdAt || "");
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

export async function readStoredVideoJob(videoId: string): Promise<JobState | undefined> {
  const paths = videoPaths(videoId);
  const [metadata, job, transcript, clips] = await Promise.all([
    readJsonFile<VideoMetadata>(paths.metadataJson),
    readJsonFile<JobState>(paths.jobJson),
    readJsonFile<TranscriptJson>(paths.transcriptJson),
    readJsonFile<ClipJson[]>(paths.clipsJson),
  ]);

  if (!metadata && !job) {
    return undefined;
  }

  if (job?.result) {
    return job;
  }

  const now = new Date().toISOString();

  return {
    jobId: job?.jobId || `cached_${videoId}`,
    videoId,
    status: job?.status || (transcript && clips ? "complete" : "failed"),
    progress: job?.progress || (transcript && clips ? 100 : 0),
    message: transcript && clips ? "Loaded from local development storage." : "Cached video is incomplete.",
    createdAt: job?.createdAt || metadata?.createdAt || now,
    updatedAt: job?.updatedAt || now,
    error: job?.error,
    result:
      metadata && transcript && clips
        ? {
            video: metadata,
            transcript,
            clips,
          }
        : undefined,
  };
}

export async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return undefined;
  }

  return file.json() as Promise<T>;
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await Bun.write(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
