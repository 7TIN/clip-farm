import { Hono } from "hono";
import { cors } from "hono/cors";

import { createVideoRecord, getClipById, readJob, readJsonFile, videoPaths } from "./storage";
import { startProcessing } from "./processor";
import type { ClipJson, JobState, TranscriptJson } from "./types";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
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

app.post("/videos/process", async (c) => {
  const form = await c.req.formData();
  const video = form.get("video");
  const language = String(form.get("language") || "en");

  if (!(video instanceof File)) {
    return c.json({ error: "Upload a video file using the `video` form field." }, 400);
  }

  const record = await createVideoRecord(video);
  const job = await startProcessing(record.videoId, { language });

  return c.json(
    {
      videoId: record.videoId,
      jobId: job.jobId,
      statusUrl: `/videos/${record.videoId}/status`,
    },
    202,
  );
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
  const metadata = await readJsonFile<{ originalPath: string }>(videoPaths(videoId).metadataJson);

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
  const clip = await getClipById(videoId, clipId);

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
  return {
    ...clip,
    mediaUrl: clip.outputPath ? `/videos/${videoId}/clips/${clip.id}/file` : undefined,
  };
}

const port = Number(process.env.PORT || 3001);

Bun.serve({
  port,
  fetch: app.fetch,
  maxRequestBodySize: 1024 * 1024 * 512,
});

console.log(`Clip Farm API running on http://localhost:${port}`);
