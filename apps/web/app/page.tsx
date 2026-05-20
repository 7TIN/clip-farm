"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Film, Loader2, RefreshCw, Scissors, UploadCloud } from "lucide-react";

type JobStatus =
  | "queued"
  | "saving_upload"
  | "extracting_audio"
  | "transcribing"
  | "generating_clips"
  | "rendering_clips"
  | "complete"
  | "failed";

type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerLabel?: string;
};

type ClipResult = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  transcriptText: string;
  status: "suggested" | "rendered" | "failed";
  mediaUrl?: string;
};

type JobState = {
  jobId: string;
  videoId: string;
  status: JobStatus;
  progress: number;
  message: string;
  error?: string;
  result?: {
    originalVideoUrl?: string;
    transcript: {
      text: string;
      segments: TranscriptSegment[];
      durationMs?: number;
    };
    clips: ClipResult[];
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const POLL_INTERVAL_MS = 5_000;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("en");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProcessing = Boolean(
    job && job.status !== "complete" && job.status !== "failed",
  );

  const originalVideoUrl = useMemo(
    () => absoluteApiUrl(job?.result?.originalVideoUrl),
    [job?.result?.originalVideoUrl],
  );

  useEffect(() => {
    if (!videoId || job?.status === "complete" || job?.status === "failed") {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/videos/${videoId}/status`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Could not load processing status.");
        }

        setJob(payload);
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : "Status polling failed.");
      }
    };

    void pollStatus();
    const intervalId = window.setInterval(pollStatus, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [videoId, job?.status]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Choose a video file first.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setJob(null);

    try {
      const body = new FormData();
      body.append("video", file);
      body.append("language", language);

      const response = await fetch(`${API_BASE_URL}/videos/process`, {
        method: "POST",
        body,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Upload failed.");
      }

      setVideoId(payload.videoId);
      setJob({
        jobId: payload.jobId,
        videoId: payload.videoId,
        status: "queued",
        progress: 1,
        message: "Queued for processing.",
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Clip Farm MVP</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Video to transcript clips</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            <span>Polling every 5 seconds</span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="flex flex-col gap-4">
            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <UploadCloud className="size-5 text-emerald-700" />
                <h2 className="text-base font-semibold">Upload</h2>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Video file</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
                />
              </label>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Transcript language</span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="multi-indic">Auto Indic</option>
                  <option value="multi">Auto multilingual</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={!file || isUploading || isProcessing}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                {isUploading ? "Uploading" : "Process video"}
              </button>

              {file ? (
                <p className="mt-3 truncate text-xs text-zinc-500">
                  Selected: {file.name}
                </p>
              ) : null}
            </form>

            <StatusPanel job={job} error={error} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Film className="size-5 text-sky-700" />
                  <h2 className="text-base font-semibold">Preview</h2>
                </div>
                {job?.result?.transcript.durationMs ? (
                  <span className="text-xs text-zinc-500">
                    {formatTime(job.result.transcript.durationMs)}
                  </span>
                ) : null}
              </div>

              {originalVideoUrl ? (
                <video
                  src={originalVideoUrl}
                  controls
                  className="aspect-video w-full rounded-md bg-black"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
                  Upload a video to start processing.
                </div>
              )}
            </section>

            <ClipsPanel clips={job?.result?.clips || []} />
          </div>
        </section>

        <TranscriptPanel segments={job?.result?.transcript.segments || []} />
      </div>
    </main>
  );
}

function StatusPanel({ job, error }: { job: JobState | null; error: string | null }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <RefreshCw className="size-5 text-amber-700" />
        <h2 className="text-base font-semibold">Status</h2>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${job?.progress || 0}%` }}
        />
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium capitalize text-zinc-800">
            {job?.status?.replaceAll("_", " ") || "Idle"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {error || job?.error || job?.message || "Waiting for upload."}
          </p>
        </div>
        <span className="text-sm font-medium text-zinc-500">{job?.progress || 0}%</span>
      </div>
    </section>
  );
}

function ClipsPanel({ clips }: { clips: ClipResult[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Scissors className="size-5 text-rose-700" />
        <h2 className="text-base font-semibold">Clips</h2>
      </div>

      <div className="flex max-h-[520px] flex-col gap-3 overflow-auto pr-1">
        {clips.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
            Generated clips will appear here.
          </div>
        ) : null}

        {clips.map((clip) => {
          const mediaUrl = absoluteApiUrl(clip.mediaUrl);

          return (
            <article key={clip.id} className="rounded-md border border-zinc-200 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold leading-5">{clip.title}</h3>
                <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">
                  {formatTime(clip.durationMs)}
                </span>
              </div>

              <p className="mb-2 text-xs text-zinc-500">
                {formatTime(clip.startMs)} - {formatTime(clip.endMs)}
              </p>

              {mediaUrl ? (
                <video src={mediaUrl} controls className="mb-2 aspect-video w-full rounded-md bg-black" />
              ) : null}

              <p className="line-clamp-4 text-sm leading-6 text-zinc-700">{clip.transcriptText}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TranscriptPanel({ segments }: { segments: TranscriptSegment[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="size-5 text-violet-700" />
        <h2 className="text-base font-semibold">Transcript</h2>
      </div>

      <div className="grid max-h-[420px] gap-2 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
        {segments.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
            Timestamped transcript segments will appear here.
          </div>
        ) : null}

        {segments.map((segment) => (
          <article key={segment.id} className="rounded-md border border-zinc-200 p-3">
            <p className="mb-2 font-mono text-xs text-zinc-500">
              {formatTime(segment.startMs)} - {formatTime(segment.endMs)}
            </p>
            <p className="text-sm leading-6 text-zinc-800">{segment.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function absoluteApiUrl(path?: string) {
  if (!path) {
    return undefined;
  }

  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
