import { Hono } from "hono";
import { cors } from "hono/cors";
import path from "path";

import {
  createVideoRecord,
  findCaptionJob,
  findReframeJob,
  getClipById,
  listStoredVideos,
  readCaptionJob,
  readJob,
  readJsonFile,
  readStoredVideoJob,
  videoPaths,
} from "./storage";
import { startProcessing } from "./processor";
import { startCaptionJob } from "./caption-jobs";
import {
  deleteReframeVariant,
  listReframeJobs,
  repairMissingClipFiles,
} from "./reframe-maintenance";
import { resolveCaptionSettings } from "./caption-settings";
import { resolveReframeSettings } from "./reframe-settings";
import { startReframeJob } from "./reframe";
import { resolveCaptionSettings } from "./caption-settings";
import { startCaptionJob } from "./caption-jobs";
import type {
  CaptionJobState,
  ClipJson,
  JobState,
  ReframeJobState,
  TranscriptJson,
} from "./types";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  }),
);

app.get("/", (c) =>
  c.json({
    name: "clip-farm-api",
    status: "ok",
  }),
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
  }),
);

app.get("/dev/videos", async (c) => {
  if (!isDevelopmentMode()) {
    return c.json({ error: "Development video library is disabled." }, 404);
  }

  const videos = await listStoredVideos();
  return c.json({ videos });
});

app.get("/dev/videos/:videoId", async (c) => {
  if (!isDevelopmentMode()) {
    return c.json({ error: "Development video library is disabled." }, 404);
  }

  const videoId = c.req.param("videoId");
  const job = await readStoredVideoJob(videoId);

  if (!job) {
    return c.json({ error: "Stored video not found." }, 404);
  }

  return c.json(withPublicUrls(job));
});

app.get("/dev/videos/:videoId/reframes", async (c) => {
  if (!isDevelopmentMode()) {
    return c.json({ error: "Development reframe library is disabled." }, 404);
  }

  const videoId = c.req.param("videoId");
  const jobs = await listReframeJobs(videoId);
  return c.json({ jobs });
});

app.delete("/dev/videos/:videoId/reframes", async (c) => {
  if (!isDevelopmentMode()) {
    return c.json({ error: "Development reframe cleanup is disabled." }, 404);
  }

  const videoId = c.req.param("videoId");
  const body = await c.req.json().catch(() => ({}));
  const settings = resolveReframeSettings(body);
  const result = await deleteReframeVariant(videoId, settings);

  return c.json({
    ...result,
    job: withPublicUrls(result.job),
  });
});

app.post("/dev/videos/:videoId/repair-clips", async (c) => {
  if (!isDevelopmentMode()) {
    return c.json({ error: "Development clip repair is disabled." }, 404);
  }

  const videoId = c.req.param("videoId");
  const result = await repairMissingClipFiles(videoId);

  return c.json({
    ...result,
    job: withPublicUrls(result.job),
  });
});

app.post("/videos/process", async (c) => {
  const form = await c.req.formData();
  const video = form.get("video");
  const language = String(form.get("language") || "en");
  const reframeSettings = resolveReframeSettings({
    aspectRatio: form.get("aspectRatio"),
    reframeMode: form.get("reframeMode"),
    normalStrategy: form.get("normalStrategy"),
    smartLayout: form.get("smartLayout"),
  });

  if (!(video instanceof File)) {
    return c.json(
      { error: "Upload a video file using the `video` form field." },
      400,
    );
  }

  const record = await createVideoRecord(video);
  const job = await startProcessing(record.videoId, {
    language,
    reframeSettings,
  });

  return c.json(
    {
      videoId: record.videoId,
      jobId: job.jobId,
      statusUrl: `/videos/${record.videoId}/status`,
    },
    202,
  );
});

app.post("/videos/:videoId/reframe", async (c) => {
  const videoId = c.req.param("videoId");
  const body = await c.req.json().catch(() => ({}));
  const existingJob = await readStoredVideoJob(videoId);

  if (!existingJob?.result) {
    return c.json(
      { error: "Video must be processed before it can be reframed." },
      404,
    );
  }

  const settings = resolveReframeSettings(body);
  const job = await startReframeJob(videoId, settings);

  return c.json(
    {
      videoId,
      jobId: job.jobId,
      statusUrl: `/reframes/${job.jobId}/status`,
    },
    202,
  );
});

app.post("/videos/:videoId/clips/:clipId/captions", async (c) => {
  const videoId = c.req.param("videoId");
  const clipId = c.req.param("clipId");
  const body = await c.req.json().catch(() => ({}));
  const existingJob = await readStoredVideoJob(videoId);

  if (!existingJob?.result) {
    return c.json({ error: "Video must be processed before captions can be rendered." }, 404);
  }

  const renderVersion = typeof body.renderVersion === "string" ? body.renderVersion : undefined;
  const clip = existingJob.result.clips.find((item) => {
    if (item.id !== clipId) return false;
    return renderVersion ? item.renderVersion === renderVersion : !item.renderVersion;
  });

  if (!clip?.outputPath) {
    return c.json({ error: "Rendered clip not found. Render or repair the clip first." }, 404);
  }

  const settings = resolveCaptionSettings(body);
  const job = await startCaptionJob(videoId, clipId, renderVersion, settings);

  return c.json(
    {
      videoId,
      clipId,
      jobId: job.jobId,
      statusUrl: `/caption-jobs/${job.jobId}/status`,
    },
    202,
  );
});

app.get("/caption-jobs/:jobId/status", async (c) => {
  const jobId = c.req.param("jobId");
  const job = await findCaptionJob(jobId);

  if (!job) {
    return c.json({ error: "Caption job not found." }, 404);
  }

  return c.json(withCaptionPublicUrls(job));
});

app.get("/reframes/:jobId/status", async (c) => {
  const jobId = c.req.param("jobId");
  const job = await findReframeJob(jobId);

  if (!job) {
    return c.json({ error: "Reframe job not found." }, 404);
  }

  return c.json(withReframePublicUrls(job));
});

app.post("/videos/:videoId/clips/:clipId/captions", async (c) => {
  const videoId = c.req.param("videoId");
  const clipId = c.req.param("clipId");
  const body = await c.req.json().catch(() => ({}));

  const settings = resolveCaptionSettings(body);
  const renderVersion = body.renderVersion as string | undefined;

  const existingJob = await readStoredVideoJob(videoId);

  if (!existingJob?.result) {
    return c.json(
      { error: "Video must be processed before captions can be rendered." },
      404,
    );
  }

  const job = await startCaptionJob(videoId, clipId, renderVersion, settings);

  return c.json(
    {
      videoId,
      clipId,
      jobId: job.jobId,
      statusUrl: `/caption-jobs/${job.jobId}/status`,
    },
    202,
  );
});

app.get("/caption-jobs/:jobId/status", async (c) => {
  const jobId = c.req.param("jobId");
  const job = await findCaptionJob(jobId);

  if (!job) {
    return c.json({ error: "Caption job not found." }, 404);
  }

  return c.json(withCaptionPublicUrls(job));
});

app.get("/videos/:videoId/clips/:clipId/captioned-file", async (c) => {
  const videoId = c.req.param("videoId");
  const clipId = c.req.param("clipId");
  const captionVersion = c.req.query("captionVersion");
  const renderVersion = c.req.query("version");

  const clip = await getClipById(videoId, clipId, renderVersion);

  if (!clip?.captionedOutputPath && !clip?.outputPath) {
    return c.json({ error: "Captioned clip not found." }, 404);
  }

  const filePath = clip.captionedOutputPath || clip.outputPath;

  if (!filePath) {
    return c.json({ error: "Captioned clip file path is missing." }, 404);
  }

  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return c.json({ error: "Captioned clip file is missing." }, 404);
  }

  return new Response(file, {
    headers: {
      "Content-Type": "video/mp4",
    },
  });
});

app.get("/videos/:videoId/status", async (c) => {
  const videoId = c.req.param("videoId");
  const job = await readJob(videoId);

  if (!job) {
    return c.json({ error: "Video job not found." }, 404);
  }

  return c.json(withPublicUrls(job));
});

app.get("/videos/:videoId/transcript", async (c) => {
  const videoId = c.req.param("videoId");
  const paths = videoPaths(videoId);
  const transcript = await readJsonFile<TranscriptJson>(paths.transcriptJson);

  if (!transcript) {
    return c.json({ error: "Transcript not found yet." }, 404);
  }

  return c.json(transcript);
});

app.get("/videos/:videoId/clips", async (c) => {
  const videoId = c.req.param("videoId");
  const paths = videoPaths(videoId);
  const clips = await readJsonFile<ClipJson[]>(paths.clipsJson);

  if (!clips) {
    return c.json({ error: "Clips not found yet." }, 404);
  }

  return c.json(clips.map((clip) => withClipUrl(videoId, clip)));
});

app.get("/videos/:videoId/original", async (c) => {
  const videoId = c.req.param("videoId");
  const metadata = await readJsonFile<{ originalPath: string }>(
    videoPaths(videoId).metadataJson,
  );

  if (!metadata) {
    return c.json({ error: "Original video metadata not found." }, 404);
  }

  const file = Bun.file(metadata.originalPath);

  if (!(await file.exists())) {
    return c.json({ error: "Original video not found." }, 404);
  }

  return new Response(file, {
    headers: {
      "Content-Type": file.type || "video/mp4",
    },
  });
});

app.get("/videos/:videoId/clips/:clipId/file", async (c) => {
  const videoId = c.req.param("videoId");
  const clipId = c.req.param("clipId");
  const renderVersion = c.req.query("version");
  const clip = await getClipById(videoId, clipId, renderVersion);

  if (!clip?.outputPath) {
    return c.json({ error: "Rendered clip not found." }, 404);
  }

  const file = Bun.file(clip.outputPath);
  if (!(await file.exists())) {
    return c.json({ error: "Rendered clip file is missing." }, 404);
  }

  return new Response(file, {
    headers: {
      "Content-Type": "video/mp4",
    },
  });
});

app.get("/videos/:videoId/clips/:clipId/captioned-file", async (c) => {
  const videoId = c.req.param("videoId");
  const clipId = c.req.param("clipId");
  const renderVersion = c.req.query("version");
  const clip = await getClipById(videoId, clipId, renderVersion);

  if (!clip?.captionedOutputPath) {
    return c.json({ error: "Captioned clip not found." }, 404);
  }

  const file = Bun.file(clip.captionedOutputPath);
  if (!(await file.exists())) {
    return c.json({ error: "Captioned clip file is missing." }, 404);
  }

  return new Response(file, {
    headers: {
      "Content-Type": "video/mp4",
    },
  });
});

function withPublicUrls(job: JobState) {
  if (!job.result) {
    return job;
  }

  return {
    ...job,
    result: {
      ...job.result,
      originalVideoUrl: `/videos/${job.videoId}/original`,
      clips: job.result.clips.map((clip) => withClipUrl(job.videoId, clip)),
    },
  };
}

function withClipUrl(videoId: string, clip: ClipJson) {
  const versionQuery = clip.renderVersion
    ? `?version=${encodeURIComponent(clip.renderVersion)}`
    : "";

  const captionVersionQuery =
    clip.captionRenderVersion && clip.renderVersion
      ? `?version=${encodeURIComponent(clip.renderVersion)}&captionVersion=${encodeURIComponent(clip.captionRenderVersion)}`
      : clip.captionRenderVersion
        ? `?captionVersion=${encodeURIComponent(clip.captionRenderVersion)}`
        : "";

  return {
    ...clip,
    mediaUrl: clip.outputPath
      ? `/videos/${videoId}/clips/${clip.id}/file${versionQuery}`
      : undefined,
    captionedMediaUrl: clip.captionedOutputPath
<<<<<<< HEAD
      ? `/videos/${videoId}/clips/${clip.id}/captioned-file${versionQuery}`
=======
      ? `/videos/${videoId}/clips/${clip.id}/captioned-file${captionVersionQuery}`
>>>>>>> origin/main
      : undefined,
  };
}

function withReframePublicUrls(job: ReframeJobState) {
  if (!job.result) {
    return job;
  }

  return {
    ...job,
    result: {
      ...job.result,
      originalVideoUrl: `/videos/${job.videoId}/original`,
      clips: job.result.clips.map((clip) => withClipUrl(job.videoId, clip)),
    },
  };
}

function withCaptionPublicUrls(job: CaptionJobState) {
  if (!job.result) {
    return job;
  }

  return {
    ...job,
    result: {
      ...job.result,
      originalVideoUrl: `/videos/${job.videoId}/original`,
      clips: job.result.clips.map((clip) => withClipUrl(job.videoId, clip)),
    },
  };
}

function isDevelopmentMode() {
  return (
    process.env.APP_ENV === "dev" ||
    process.env.NODE_ENV === "development" ||
    process.env.npm_lifecycle_event === "dev" ||
    process.argv.includes("--watch")
  );
}

async function validatePythonEnvironment() {
  const pythonBin =
    process.env.PYTHON_BIN ||
    path.resolve(process.cwd(), ".venv/Scripts/python.exe");

  const proc = Bun.spawn(
    [
      pythonBin,
      "-c",
      "import cv2, mediapipe.tasks, numpy; print('Python CV OK')",
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Python CV environment invalid:\n${stderr || stdout}`);
  }

  console.log(stdout.trim());
}

const port = Number(process.env.PORT || 3001);

await validatePythonEnvironment();

Bun.serve({
  port,
  fetch: app.fetch,
  maxRequestBodySize: 1024 * 1024 * 512,
});

console.log(`Clip Farm API running on http://localhost:${port}`);
