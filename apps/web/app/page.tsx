"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Film,
  Loader2,
  RefreshCw,
  Scissors,
  UploadCloud,
} from "lucide-react";

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
  source: "random_mvp";
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
    video?: {
      originalFilename?: string;
      width?: number;
      height?: number;
      codec?: string;
      durationMs?: number;
    };
    transcript: {
      text: string;
      segments: TranscriptSegment[];
      durationMs?: number;
    };
    clips: ClipResult[];
  };
};

type StoredVideoSummary = {
  id: string;
  title: string;
  status: JobStatus;
  progress: number;
  durationMs?: number;
  clipCount: number;
  hasTranscript: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const SHOW_DEV_LIBRARY =
  process.env.NEXT_PUBLIC_APP_ENV === "dev" || process.env.NODE_ENV === "development";
const POLL_INTERVAL_MS = 5_000;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("en");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [storedVideos, setStoredVideos] = useState<StoredVideoSummary[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingStoredVideos, setIsLoadingStoredVideos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProcessing = Boolean(
    job && job.status !== "complete" && job.status !== "failed",
  );

  const originalVideoUrl = useMemo(
    () => absoluteApiUrl(job?.result?.originalVideoUrl),
    [job?.result?.originalVideoUrl],
  );

  useEffect(() => {
    if (!SHOW_DEV_LIBRARY) {
      return;
    }

    void loadStoredVideos();
  }, []);

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

  async function loadStoredVideos() {
    setIsLoadingStoredVideos(true);

    try {
      const response = await fetch(`${API_BASE_URL}/dev/videos`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not load stored videos.");
      }

      setStoredVideos(payload.videos || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Stored videos failed to load.");
    } finally {
      setIsLoadingStoredVideos(false);
    }
  }

  async function loadStoredVideo(selectedVideoId: string) {
    setError(null);
    setIsLoadingStoredVideos(true);

    try {
      const response = await fetch(`${API_BASE_URL}/dev/videos/${selectedVideoId}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not open stored video.");
      }

      setFile(null);
      setVideoId(payload.videoId);
      setJob(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Stored video failed to load.");
    } finally {
      setIsLoadingStoredVideos(false);
    }
  }

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

      if (SHOW_DEV_LIBRARY) {
        void loadStoredVideos();
      }
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

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <UploadPanel
              file={file}
              language={language}
              isUploading={isUploading}
              isProcessing={isProcessing}
              onFileChange={setFile}
              onLanguageChange={setLanguage}
              onSubmit={handleSubmit}
            />

            {SHOW_DEV_LIBRARY ? (
              <StoredVideosPanel
                videos={storedVideos}
                activeVideoId={job?.videoId}
                isLoading={isLoadingStoredVideos}
                onRefresh={loadStoredVideos}
                onSelect={loadStoredVideo}
              />
            ) : null}

            <StatusPanel job={job} error={error} />
          </div>

          <PreviewPanel job={job} originalVideoUrl={originalVideoUrl} />
        </section>

        <TranscriptPanel segments={job?.result?.transcript.segments || []} />

        <ClipsPanel
          clips={job?.result?.clips || []}
          segments={job?.result?.transcript.segments || []}
        />
      </div>
    </main>
  );
}

function UploadPanel({
  file,
  language,
  isUploading,
  isProcessing,
  onFileChange,
  onLanguageChange,
  onSubmit,
}: {
  file: File | null;
  language: string;
  isUploading: boolean;
  isProcessing: boolean;
  onFileChange: (file: File | null) => void;
  onLanguageChange: (language: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <UploadCloud className="size-5 text-emerald-700" />
        <h2 className="text-base font-semibold">Upload</h2>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-700">Video file</span>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-medium text-zinc-700">Transcript language</span>
        <select
          value={language}
          onChange={(event) => onLanguageChange(event.target.value)}
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
        <p className="mt-3 truncate text-xs text-zinc-500">Selected: {file.name}</p>
      ) : null}
    </form>
  );
}

function StoredVideosPanel({
  videos,
  activeVideoId,
  isLoading,
  onRefresh,
  onSelect,
}: {
  videos: StoredVideoSummary[];
  activeVideoId?: string;
  isLoading: boolean;
  onRefresh: () => void;
  onSelect: (videoId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-emerald-700" />
          <h2 className="text-base font-semibold">Stored videos</h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-2.5 text-xs font-medium text-emerald-800 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Refresh
        </button>
      </div>

      <div className="max-h-56 space-y-2 overflow-auto pr-1">
        {videos.length === 0 ? (
          <p className="rounded-md border border-emerald-200 bg-white p-3 text-sm text-emerald-800">
            No processed videos found in local storage yet.
          </p>
        ) : null}

        {videos.map((video) => (
          <button
            key={video.id}
            type="button"
            onClick={() => onSelect(video.id)}
            className={`w-full rounded-md border bg-white p-3 text-left transition hover:border-emerald-500 ${
              activeVideoId === video.id ? "border-emerald-600" : "border-emerald-200"
            }`}
          >
            <span className="block truncate text-sm font-medium text-zinc-900">{video.title}</span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
              <span>{video.status.replaceAll("_", " ")}</span>
              <span>{video.clipCount} clips</span>
              {video.durationMs ? <span>{formatTime(video.durationMs)}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </section>
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

function PreviewPanel({
  job,
  originalVideoUrl,
}: {
  job: JobState | null;
  originalVideoUrl?: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="size-5 text-sky-700" />
          <h2 className="text-base font-semibold">Preview</h2>
        </div>
        {job?.result?.transcript.durationMs ? (
          <span className="text-xs text-zinc-500">{formatTime(job.result.transcript.durationMs)}</span>
        ) : null}
      </div>

      {originalVideoUrl ? (
        <video src={originalVideoUrl} controls className="aspect-video w-full rounded-md bg-black" />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
          Upload a video or open a stored one.
        </div>
      )}

      {job?.result?.video ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600 sm:grid-cols-4">
          <MetaChip label="File" value={job.result.video.originalFilename || job.videoId} />
          <MetaChip
            label="Size"
            value={
              job.result.video.width && job.result.video.height
                ? `${job.result.video.width}x${job.result.video.height}`
                : "Unknown"
            }
          />
          <MetaChip label="Codec" value={job.result.video.codec || "Unknown"} />
          <MetaChip label="Clips" value={String(job.result.clips.length)} />
        </div>
      ) : null}
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
          <TranscriptRow key={segment.id} segment={segment} />
        ))}
      </div>
    </section>
  );
}

function ClipsPanel({
  clips,
  segments,
}: {
  clips: ClipResult[];
  segments: TranscriptSegment[];
}) {
  const [expandedClipIds, setExpandedClipIds] = useState<Set<string>>(new Set());

  function toggleClip(clipId: string) {
    setExpandedClipIds((current) => {
      const next = new Set(current);

      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }

      return next;
    });
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Scissors className="size-5 text-rose-700" />
        <h2 className="text-base font-semibold">Clips</h2>
      </div>

      <div className="flex max-h-[900px] flex-col gap-4 overflow-auto pr-1">
        {clips.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
            Generated clips will appear here.
          </div>
        ) : null}

        {clips.map((clip, index) => {
          const clipSegments = getClipSegments(clip, segments);

          return (
            <ClipCard
              key={clip.id}
              clip={clip}
              index={index}
              segments={clipSegments}
              isExpanded={expandedClipIds.has(clip.id)}
              onToggle={() => toggleClip(clip.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

function ClipCard({
  clip,
  index,
  segments,
  isExpanded,
  onToggle,
}: {
  clip: ClipResult;
  index: number;
  segments: TranscriptSegment[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const mediaUrl = absoluteApiUrl(clip.mediaUrl);

  return (
    <article className="rounded-lg border border-zinc-200 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-rose-700">Clip {index + 1}</p>
          <h3 className="text-base font-semibold leading-6">{clip.title}</h3>
        </div>
        <span className="w-fit rounded-md bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
          {clip.status}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,620px)_1fr]">
        <div className="w-full max-w-2xl">
          {mediaUrl ? (
            <video src={mediaUrl} controls className="aspect-video w-full rounded-md bg-black" />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
              Clip video not rendered yet.
            </div>
          )}
        </div>

        <div className="grid content-start gap-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            <MetaChip label="Start" value={formatTime(clip.startMs)} />
            <MetaChip label="End" value={formatTime(clip.endMs)} />
            <MetaChip label="Duration" value={formatTime(clip.durationMs)} />
            <MetaChip label="Source" value="Random MVP" />
            <MetaChip label="Transcript" value={`${segments.length} rows`} />
            <MetaChip label="Format" value="MP4" />
          </div>

          <p className="rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
            {segments[0]?.text || clip.transcriptText || "Transcript unavailable."}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
      >
        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        Clip transcript
      </button>

      {isExpanded ? (
        <div className="mt-3 max-h-80 space-y-2 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
          {segments.length === 0 ? (
            <p className="text-sm text-zinc-500">No timestamped transcript rows found for this clip.</p>
          ) : null}

          {segments.map((segment) => (
            <TranscriptRow key={`${clip.id}-${segment.id}`} segment={segment} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function TranscriptRow({ segment }: { segment: TranscriptSegment }) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-3">
      <p className="mb-2 font-mono text-xs text-zinc-500">
        {formatTime(segment.startMs)} - {formatTime(segment.endMs)}
      </p>
      <p className="text-sm leading-6 text-zinc-800">{segment.text}</p>
    </article>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-normal text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function getClipSegments(clip: ClipResult, segments: TranscriptSegment[]) {
  return segments.filter((segment) => segment.endMs > clip.startMs && segment.startMs < clip.endMs);
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
