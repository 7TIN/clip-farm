import { mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import type {
  ClipJson,
  JobState,
  CaptionJobState,
  ReframeJobState,
  StoredVideoSummary,
  TranscriptJson,
  VideoMetadata,
} from "./types";

const rootDir = path.resolve(import.meta.dir, "../../..");
export const storageRoot = path.join(rootDir, "storage");
export const tmpRoot = path.join(storageRoot, "tmp");

export function videoPaths(videoId: string) {
  const baseDir = path.join(storageRoot, "videos", videoId);
  const clipsDir = path.join(baseDir, "clips");
  const captionsDir = path.join(baseDir, "captions");
  const captionJobsDir = path.join(baseDir, "caption-jobs");
  const reframesDir = path.join(baseDir, "reframes");
  const reframeJobsDir = path.join(baseDir, "reframe-jobs");

  return {
    baseDir,
    clipsDir,
    captionsDir,
    captionJobsDir,
    reframesDir,
    reframeJobsDir,
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
  await Promise.all([
    mkdir(paths.clipsDir, { recursive: true }),
    mkdir(paths.captionsDir, { recursive: true }),
    mkdir(paths.captionJobsDir, { recursive: true }),
    mkdir(paths.reframesDir, { recursive: true }),
    mkdir(paths.reframeJobsDir, { recursive: true }),
  ]);
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

export async function readReframeJob(videoId: string, jobId: string) {
  const paths = videoPaths(videoId);
  return readJsonFile<ReframeJobState>(
    path.join(paths.reframeJobsDir, `${jobId}.json`),
  );
}

export async function saveReframeJob(job: ReframeJobState) {
  const paths = await ensureVideoDirs(job.videoId);
  await writeJsonFile(
    path.join(paths.reframeJobsDir, `${job.jobId}.json`),
    job,
  );
}

export async function readCaptionJob(videoId: string, jobId: string) {
  const paths = videoPaths(videoId);
  return readJsonFile<CaptionJobState>(
    path.join(paths.captionJobsDir, `${jobId}.json`),
  );
}

export async function saveCaptionJob(job: CaptionJobState) {
  const paths = await ensureVideoDirs(job.videoId);
  await writeJsonFile(
    path.join(paths.captionJobsDir, `${job.jobId}.json`),
    job,
  );
}

export async function findReframeJob(jobId: string) {
  const videosRoot = path.join(storageRoot, "videos");
  const entries = await readdir(videosRoot, { withFileTypes: true }).catch(
    () => [],
  );

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const job = await readReframeJob(entry.name, jobId);
    if (job) {
      return job;
    }
  }

  return undefined;
}

export async function findCaptionJob(jobId: string) {
  const videosRoot = path.join(storageRoot, "videos");
  const entries = await readdir(videosRoot, { withFileTypes: true }).catch(
    () => [],
  );

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const job = await readCaptionJob(entry.name, jobId);
    if (job) {
      return job;
    }
  }

  return undefined;
}

export async function getClipById(
  videoId: string,
  clipId: string,
  renderVersion?: string,
) {
  const paths = videoPaths(videoId);
  const clips = await readJsonFile<ClipJson[]>(paths.clipsJson);

  if (renderVersion) {
    return clips?.find(
      (clip) => clip.id === clipId && clip.renderVersion === renderVersion,
    );
  }

  return (
    clips?.find((clip) => clip.id === clipId && !clip.renderVersion) ||
    clips?.find((clip) => clip.id === clipId)
  );
}

export async function listStoredVideos(): Promise<StoredVideoSummary[]> {
  const videosRoot = path.join(storageRoot, "videos");
  const entries = await readdir(videosRoot, { withFileTypes: true }).catch(
    () => [],
  );
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
    return (
      (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
    );
  });
}

export async function readStoredVideoJob(
  videoId: string,
): Promise<JobState | undefined> {
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
    message:
      transcript && clips
        ? "Loaded from local development storage."
        : "Cached video is incomplete.",
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

export async function readJsonFile<T>(
  filePath: string,
): Promise<T | undefined> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      if (attempt < 9) {
        await delay(50);
        continue;
      }
      return undefined;
    }

    try {
      return (await file.json()) as T;
    } catch (error) {
      if (attempt < 9) {
        await delay(50);
        continue;
      }

      console.error("JSON PARSE FAILED");
      console.error("FILE:", filePath);

      try {
        const text = await file.text();
        console.error("SIZE:", text.length);
        console.error("CONTENT:", text.slice(0, 200));
      } catch (readErr) {
        console.error("Could not read file for debug:", readErr);
      }

      return undefined;
    }
  }

  return undefined;
}

const writeJsonFileQueue = new Map<string, Promise<void>>();

async function serializeWrite(filePath: string, fn: () => Promise<void>) {
  const previous = writeJsonFileQueue.get(filePath) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  writeJsonFileQueue.set(filePath, next);

  try {
    return await next;
  } finally {
    if (writeJsonFileQueue.get(filePath) === next) {
      writeJsonFileQueue.delete(filePath);
    }
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isRetryableRenameError(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "EPERM" || code === "ENOENT";
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });

  await serializeWrite(filePath, async () => {
    const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await Bun.write(tempPath, content);

    try {
      for (let attempt = 1; ; attempt += 1) {
        try {
          await rm(filePath, { force: true });
          await rename(tempPath, filePath);
          return;
        } catch (error) {
          if (attempt >= 5 || !isRetryableRenameError(error)) {
            throw error;
          }
          await delay(attempt * 50);
        }
      }
    } finally {
      try {
        await rm(tempPath, { force: true });
      } catch {
        // Cleanup failure is non-fatal
      }
    }
  });
}
