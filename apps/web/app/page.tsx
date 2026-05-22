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
  Settings2,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";

type JobStatus =
  | "queued"
  | "saving_upload"
  | "extracting_audio"
  | "transcribing"
  | "generating_clips"
  | "rendering_clips"
  | "complete"
  | "failed";

type ReframeJobStatus =
  | "queued"
  | "analyzing"
  | "rendering"
  | "complete"
  | "failed";
type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
type ReframeMode = "normal" | "smart";
type NormalReframeStrategy = "crop" | "blur-background" | "pad";

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
  aspectRatio?: AspectRatio;
  reframeMode?: ReframeMode;
  normalStrategy?: NormalReframeStrategy;
  outputWidth?: number;
  outputHeight?: number;
  renderVersion?: string;
};

type ProcessResult = {
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

type JobState = {
  jobId: string;
  videoId: string;
  status: JobStatus;
  progress: number;
  message: string;
  error?: string;
  result?: ProcessResult;
};

type ReframeJobState = {
  jobId: string;
  videoId: string;
  status: ReframeJobStatus;
  progress: number;
  message: string;
  error?: string;
  result?: ProcessResult;
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
  process.env.NEXT_PUBLIC_APP_ENV === "dev" ||
  process.env.NODE_ENV === "development";
const POLL_INTERVAL_MS = 5_000;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("en");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [reframeMode, setReframeMode] = useState<ReframeMode>("normal");
  const [normalStrategy, setNormalStrategy] =
    useState<NormalReframeStrategy>("crop");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [reframeJob, setReframeJob] = useState<ReframeJobState | null>(null);
  const [storedVideos, setStoredVideos] = useState<StoredVideoSummary[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingStoredVideos, setIsLoadingStoredVideos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProcessing = Boolean(
    job && job.status !== "complete" && job.status !== "failed",
  );
  const isReframing = Boolean(
    reframeJob &&
    reframeJob.status !== "complete" &&
    reframeJob.status !== "failed",
  );
  const isBusy = isProcessing || isReframing;

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

    console.log("normal video process");

    const pollStatus = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/videos/${videoId}/status`,
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Could not load processing status.");
        }

        setJob(payload);
      } catch (pollError) {
        setError(
          pollError instanceof Error
            ? pollError.message
            : "Status polling failed.",
        );
      }
    };

    void pollStatus();
    console.log("normal video process checks done");
    const intervalId = window.setInterval(pollStatus, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [videoId, job?.status]);

  // useEffect(() => {
  //   if (!reframeJob || reframeJob.status === "complete" || reframeJob.status === "failed") {
  //     return;
  //   }
  //   console.log("reframe video process");

  //   const pollReframe = async () => {
  //     try {
  //       const response = await fetch(`${API_BASE_URL}/reframes/${reframeJob.jobId}/status`);
  //       const payload = await response.json();

  //       if (!response.ok) {
  //         throw new Error(payload.error || "Could not load reframe status.");
  //       }

  //       setReframeJob(payload);

  //       if (payload.status === "complete" && payload.result) {
  //         setJob({
  //           jobId: `cached_${payload.videoId}`,
  //           videoId: payload.videoId,
  //           status: "complete",
  //           progress: 100,
  //           message: "Processing complete.",
  //           result: payload.result,
  //         });
  //         if (SHOW_DEV_LIBRARY) {
  //           void loadStoredVideos();
  //         }
  //       }
  //     } catch (pollError) {
  //       setError(pollError instanceof Error ? pollError.message : "Reframe polling failed.");
  //     }
  //   };

  //   void pollReframe();
  //   const intervalId = window.setInterval(pollReframe, POLL_INTERVAL_MS);
  //  console.log("reframe video process checks done");

  //   return () => window.clearInterval(intervalId);
  // }, [reframeJob]);

  useEffect(() => {
    if (!reframeJob?.jobId) {
      return;
    }

    let cancelled = false;

    const pollReframe = async () => {
      while (!cancelled) {
        try {
          console.log("reframe polling");

          const response = await fetch(
            `${API_BASE_URL}/reframes/${reframeJob.jobId}/status`,
          );

          // handle non-json server crashes
          const text = await response.text();

          let payload;

          try {
            payload = text ? JSON.parse(text) : {};
          } catch {
            throw new Error("Server returned invalid JSON.");
          }

          if (!response.ok) {
            throw new Error(payload.error || "Could not load reframe status.");
          }

          setReframeJob(payload);

          if (payload.status === "complete") {
            if (payload.result) {
              setJob({
                jobId: `cached_${payload.videoId}`,
                videoId: payload.videoId,
                status: "complete",
                progress: 100,
                message: "Processing complete.",
                result: payload.result,
              });
            }

            break;
          }

          if (payload.status === "failed") {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (pollError) {
          console.error(pollError);

          setError(
            pollError instanceof Error
              ? pollError.message
              : "Reframe polling failed.",
          );

          break;
        }
      }
    };

    void pollReframe();

    return () => {
      cancelled = true;
    };
  }, [reframeJob?.jobId]);

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
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Stored videos failed to load.",
      );
    } finally {
      setIsLoadingStoredVideos(false);
    }
  }

  async function loadStoredVideo(selectedVideoId: string) {
    setError(null);
    setIsLoadingStoredVideos(true);
    setReframeJob(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/dev/videos/${selectedVideoId}`,
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not open stored video.");
      }

      setFile(null);
      setVideoId(payload.videoId);
      setJob(payload);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Stored video failed to load.",
      );
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
    setReframeJob(null);

    try {
      const body = new FormData();
      body.append("video", file);
      body.append("language", language);
      body.append("aspectRatio", aspectRatio);
      body.append("reframeMode", reframeMode);
      body.append("normalStrategy", normalStrategy);

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
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleReframe() {
    if (!job?.videoId || !job.result) {
      setError("Open a processed video before updating clip framing.");
      return;
    }

    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/videos/${job.videoId}/reframe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            aspectRatio,
            reframeMode,
            normalStrategy,
          }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not start reframe.");
      }

      setReframeJob({
        jobId: payload.jobId,
        videoId: payload.videoId,
        status: "queued",
        progress: 1,
        message: "Queued reframe render.",
      });
    } catch (reframeError) {
      setError(
        reframeError instanceof Error
          ? reframeError.message
          : "Reframe failed to start.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <header className="border-b border-zinc-100 px-6 py-8 sm:py-10">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-blue-600">
              Video Clip Generator
            </p>
            <h1 className="text-4xl font-bold tracking-tight">
              Transform Videos Into Clips
            </h1>
            <p className="text-base text-zinc-600 mt-2">
              Upload your video, extract perfect clips for any platform, and
              auto-generate transcripts
            </p>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-col gap-8 px-6 py-8">
          {/* Status Bar */}

          {/* Upload & Preview Section */}
          <section className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Upload & Settings */}
            <div className="lg:col-span-1">
              <UploadPanel
                file={file}
                language={language}
                aspectRatio={aspectRatio}
                reframeMode={reframeMode}
                normalStrategy={normalStrategy}
                isUploading={isUploading}
                isBusy={isBusy}
                onFileChange={setFile}
                onLanguageChange={setLanguage}
                onAspectRatioChange={setAspectRatio}
                onReframeModeChange={setReframeMode}
                onNormalStrategyChange={setNormalStrategy}
                onSubmit={handleSubmit}
              />
            </div>

            {/* Middle Column - Preview */}
            <div className="lg:col-span-2 space-y-2">
              <PreviewPanel
                job={job}
                originalVideoUrl={originalVideoUrl}
                aspectRatio={aspectRatio}
                reframeMode={reframeMode}
                normalStrategy={normalStrategy}
                isReframing={isReframing}
                onAspectRatioChange={setAspectRatio}
                onReframeModeChange={setReframeMode}
                onNormalStrategyChange={setNormalStrategy}
                onReframe={handleReframe}
              />

              {(job || reframeJob) && (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        {isBusy ? (
                          <Loader2 className="size-5 animate-spin text-blue-600" />
                        ) : (
                          <RefreshCw className="size-5 text-green-600" />
                        )}
                        <p className="font-medium text-zinc-900">
                          {isBusy ? "Processing" : "Complete"}
                        </p>
                      </div>
                      <p className="text-sm text-zinc-600 mb-4">
                        {error ||
                          job?.error ||
                          job?.message ||
                          "Ready to start"}
                      </p>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{
                            width: `${job?.progress || reframeJob?.progress || 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-2xl font-semibold text-zinc-900 min-w-fit">
                      {job?.progress || reframeJob?.progress || 0}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Transcript & Stored Videos */}
          <section className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TranscriptPanel
                segments={job?.result?.transcript.segments || []}
                className=""
              />
            </div>
            {SHOW_DEV_LIBRARY ? (
              <div className="lg:col-span-1">
                <StoredVideosPanel
                  videos={storedVideos}
                  activeVideoId={job?.videoId}
                  isLoading={isLoadingStoredVideos}
                  onRefresh={loadStoredVideos}
                  onSelect={loadStoredVideo}
                />
              </div>
            ) : null}
          </section>

          {/* Clips Section */}
          {job?.result?.clips && job.result.clips.length > 0 && (
            <section>
              <ClipsPanel
                clips={job.result.clips}
                segments={job?.result?.transcript.segments || []}
              />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function UploadPanel({
  file,
  language,
  aspectRatio,
  reframeMode,
  normalStrategy,
  isUploading,
  isBusy,
  onFileChange,
  onLanguageChange,
  onAspectRatioChange,
  onReframeModeChange,
  onNormalStrategyChange,
  onSubmit,
}: {
  file: File | null;
  language: string;
  aspectRatio: AspectRatio;
  reframeMode: ReframeMode;
  normalStrategy: NormalReframeStrategy;
  isUploading: boolean;
  isBusy: boolean;
  onFileChange: (file: File | null) => void;
  onLanguageChange: (language: string) => void;
  onAspectRatioChange: (aspectRatio: AspectRatio) => void;
  onReframeModeChange: (mode: ReframeMode) => void;
  onNormalStrategyChange: (strategy: NormalReframeStrategy) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-zinc-200 bg-white p-6"
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-950">Upload Video</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Choose your video and configure clip settings
        </p>
      </div>

      {/* Upload Area */}
      <label className="block mb-6">
        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-8 text-center hover:border-blue-300 hover:bg-blue-50/30 transition cursor-pointer">
          <UploadCloud className="size-8 text-blue-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-900">
            {file ? file.name : "Click to upload or drag and drop"}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            MP4, MOV, or WebM • Max 2GB
          </p>
        </div>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          className="hidden"
        />
      </label>

      {/* Language Selection */}
      <div className="mb-6">
        <label className="block mb-2">
          <span className="text-sm font-medium text-zinc-900">
            Transcript Language
          </span>
        </label>
        <select
          value={language}
          onChange={(event) => onLanguageChange(event.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="multi-indic">Auto Indic</option>
          <option value="multi">Auto multilingual</option>
        </select>
      </div>

      {/* Reframe Controls */}
      <div className="mb-6 pb-6 border-b border-zinc-100">
        <p className="text-sm font-medium text-zinc-900 mb-4">Clip Settings</p>
        <ReframeControls
          aspectRatio={aspectRatio}
          reframeMode={reframeMode}
          normalStrategy={normalStrategy}
          onAspectRatioChange={onAspectRatioChange}
          onReframeModeChange={onReframeModeChange}
          onNormalStrategyChange={onNormalStrategyChange}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!file || isUploading || isBusy}
        className="w-full h-11 rounded-lg bg-blue-600 text-white font-medium text-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UploadCloud className="size-4" />
        )}
        {isUploading ? "Uploading..." : "Process Video"}
      </button>
    </form>
  );
}

function ReframeControls({
  aspectRatio,
  reframeMode,
  normalStrategy,
  onAspectRatioChange,
  onReframeModeChange,
  onNormalStrategyChange,
}: {
  aspectRatio: AspectRatio;
  reframeMode: ReframeMode;
  normalStrategy: NormalReframeStrategy;
  onAspectRatioChange: (aspectRatio: AspectRatio) => void;
  onReframeModeChange: (mode: ReframeMode) => void;
  onNormalStrategyChange: (strategy: NormalReframeStrategy) => void;
}) {
  return (
    <div className="grid gap-4 grid-cols-1">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-900">
          Aspect Ratio
        </span>
        <select
          value={aspectRatio}
          onChange={(event) =>
            onAspectRatioChange(event.target.value as AspectRatio)
          }
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
        >
          <option value="9:16">9:16 Shorts</option>
          <option value="16:9">16:9 Wide</option>
          <option value="1:1">1:1 Square</option>
          <option value="4:5">4:5 Feed</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-900">
          Processing Mode
        </span>
        <select
          value={reframeMode}
          onChange={(event) =>
            onReframeModeChange(event.target.value as ReframeMode)
          }
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
        >
          <option value="normal">Normal FFmpeg</option>
          <option value="smart">AI Face Center</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-900">
          Scaling Strategy
        </span>
        <select
          value={normalStrategy}
          onChange={(event) =>
            onNormalStrategyChange(event.target.value as NormalReframeStrategy)
          }
          disabled={reframeMode === "smart"}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition disabled:bg-zinc-50 disabled:text-zinc-400 cursor-pointer disabled:cursor-not-allowed"
        >
          <option value="crop">Crop</option>
          <option value="blur-background">Blur Background</option>
          <option value="pad">Pad</option>
        </select>
      </label>
    </div>
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
    <section className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Library</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {videos.length} processed video{videos.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:border-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Refresh
        </button>
      </div>

      <div className="max-h-80 space-y-2 overflow-auto pr-2">
        {videos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500">
            <Database className="size-5 mx-auto mb-2 opacity-40" />
            <p>No processed videos yet</p>
          </div>
        ) : null}

        {videos.map((video) => (
          <button
            key={video.id}
            type="button"
            onClick={() => onSelect(video.id)}
            className={`w-full rounded-lg border p-3 text-left transition ${
              activeVideoId === video.id
                ? "border-blue-300 bg-blue-50"
                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <span className="block truncate text-sm font-medium text-zinc-900">
              {video.title}
            </span>
            <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
              <span className="capitalize">
                {video.status.replaceAll("_", " ")}
              </span>
              <span>·</span>
              <span>
                {video.clipCount} clip{video.clipCount !== 1 ? "s" : ""}
              </span>
              {video.durationMs && (
                <>
                  <span>·</span>
                  <span>{formatTime(video.durationMs)}</span>
                </>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function StatusPanel({
  job,
  reframeJob,
  error,
}: {
  job: JobState | null;
  reframeJob: ReframeJobState | null;
  error: string | null;
}) {
  const active =
    reframeJob && reframeJob.status !== "complete" ? reframeJob : job;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <RefreshCw className="size-5 text-amber-700" />
        <h2 className="text-base font-semibold">Status</h2>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${active?.progress || 0}%` }}
        />
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium capitalize text-zinc-800">
            {active?.status?.replaceAll("_", " ") || "Idle"}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {error || active?.error || active?.message || "Waiting for upload."}
          </p>
        </div>
        <span className="text-sm font-medium text-zinc-500">
          {active?.progress || 0}%
        </span>
      </div>
    </section>
  );
}

function PreviewPanel({
  job,
  originalVideoUrl,
  aspectRatio,
  reframeMode,
  normalStrategy,
  isReframing,
  onAspectRatioChange,
  onReframeModeChange,
  onNormalStrategyChange,
  onReframe,
}: {
  job: JobState | null;
  originalVideoUrl?: string;
  aspectRatio: AspectRatio;
  reframeMode: ReframeMode;
  normalStrategy: NormalReframeStrategy;
  isReframing: boolean;
  onAspectRatioChange: (aspectRatio: AspectRatio) => void;
  onReframeModeChange: (mode: ReframeMode) => void;
  onNormalStrategyChange: (strategy: NormalReframeStrategy) => void;
  onReframe: () => void;
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const firstClip = job?.result?.clips[0];

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Source Video</h2>
          {job?.result?.transcript.durationMs && (
            <p className="text-sm text-zinc-500 mt-1">
              Duration: {formatTime(job.result.transcript.durationMs)}
            </p>
          )}
        </div>
        {job?.result && (
          <button
            type="button"
            onClick={() => setIsSettingsOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 hover:border-blue-300"
            title="Update clip framing"
          >
            <Settings2 className="size-5" />
          </button>
        )}
      </div>

      {/* Video Preview */}
      <div className="mb-6 rounded-lg overflow-hidden bg-black">
        {originalVideoUrl ? (
          <video
            src={originalVideoUrl}
            controls
            className="aspect-video w-full"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            Upload a video to see preview
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {isSettingsOpen && job?.result ? (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="size-5 text-blue-600" />
            <p className="font-medium text-zinc-950">Update Clip Settings</p>
          </div>
          <ReframeControls
            aspectRatio={aspectRatio}
            reframeMode={reframeMode}
            normalStrategy={normalStrategy}
            onAspectRatioChange={onAspectRatioChange}
            onReframeModeChange={onReframeModeChange}
            onNormalStrategyChange={onNormalStrategyChange}
          />
          <button
            type="button"
            onClick={onReframe}
            disabled={isReframing}
            className="mt-4 w-full h-10 rounded-lg bg-blue-600 text-white font-medium text-sm transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isReframing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Re-render Clips
          </button>
        </div>
      ) : null}

      {/* Video Metadata */}
      {job?.result?.video ? (
        <div className="rounded-lg bg-zinc-50 p-4">
          <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wide mb-3">
            Video Information
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetaChip
              label="Filename"
              value={job.result.video.originalFilename || job.videoId}
            />
            <MetaChip
              label="Resolution"
              value={
                job.result.video.width && job.result.video.height
                  ? `${job.result.video.width}×${job.result.video.height}`
                  : "Unknown"
              }
            />
            <MetaChip
              label="Codec"
              value={job.result.video.codec || "Unknown"}
            />
            <MetaChip
              label="Output"
              value={
                firstClip?.outputWidth && firstClip.outputHeight
                  ? `${firstClip.outputWidth}×${firstClip.outputHeight}`
                  : "Original"
              }
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  className?: string; // optional
}

function TranscriptPanel({ segments, className = "" }: TranscriptPanelProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-6",
        className,
      )}
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-950">Transcript</h2>
        <p className="text-sm text-zinc-500 mt-1">
          {segments.length} segments found
        </p>
      </div>

      <div className="max-h-[500px] space-y-3 overflow-auto pr-2">
        {segments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
            <FileText className="size-6 mx-auto mb-2 opacity-40" />
            <p>Transcript segments will appear after processing</p>
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
  const [expandedClipIds, setExpandedClipIds] = useState<Set<string>>(
    new Set(),
  );

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
    <section className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-950">Generated Clips</h2>
        <p className="text-sm text-zinc-500 mt-1">
          {clips.length} clip{clips.length !== 1 ? "s" : ""} ready for download
        </p>
      </div>

      <div className="space-y-4">
        {clips.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
            <Scissors className="size-8 mx-auto mb-3 text-zinc-400" />
            <p className="text-sm text-zinc-500">
              Process a video to generate clips
            </p>
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

  // Responsive grid that adapts to aspect ratio
  const getGridClass = () => {
    if (clip.aspectRatio === "16:9") {
      return "lg:grid-cols-[1fr_320px]"; // Full width video, compact sidebar
    } else if (clip.aspectRatio === "9:16") {
      return "lg:grid-cols-[280px_1fr]"; // Vertical video, full width content
    } else if (clip.aspectRatio === "4:5") {
      return "lg:grid-cols-[360px_1fr]"; // Portrait video, full width content
    } else if (clip.aspectRatio === "1:1") {
      return "lg:grid-cols-[360px_1fr]"; // Square video, full width content
    }
    return "lg:grid-cols-[1fr_320px]";
  };

  const getVideoClass = () => {
    switch (clip.aspectRatio) {
      case "9:16":
        return "max-w-sm"; // Max 24rem width
      case "4:5":
        return "max-w-md"; // Max 28rem width
      case "1:1":
        return "max-w-md"; // Max 28rem width
      case "16:9":
      default:
        return "w-full"; // Full width
    }
  };

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-6 overflow-hidden hover:border-zinc-300 transition">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Clip {index + 1}
          </p>
          <h3 className="text-base font-semibold text-zinc-950 mt-1">
            {clip.title}
          </h3>
        </div>
        <span
          className={`w-fit px-3 py-1.5 rounded-full text-xs font-medium ${
            clip.status === "rendered"
              ? "bg-green-100 text-green-700"
              : clip.status === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
          }`}
        >
          {clip.status}
        </span>
      </div>

      {/* Video & Metadata Layout */}
      <div className={`grid gap-5 ${getGridClass()}`}>
        {/* Video Player */}
        <div
          className={`rounded-lg overflow-hidden bg-black flex items-center justify-center ${getVideoClass() === "w-full" ? "w-full" : ""}`}
        >
          {mediaUrl ? (
            <video
              src={mediaUrl}
              controls
              className={`aspect-auto rounded-lg ${getVideoClass()}`}
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
              Rendering...
            </div>
          )}
        </div>

        {/* Metadata & Transcript */}
        <div className="grid content-start gap-4 min-w-0">
          {/* Meta Grid */}
          <div
            className={`grid gap-2 text-xs ${
              clip.aspectRatio === "16:9"
                ? "grid-cols-2 md:grid-cols-3"
                : "grid-cols-2 lg:grid-cols-2"
            }`}
          >
            <MetaChip label="Start" value={formatTime(clip.startMs)} />
            <MetaChip label="End" value={formatTime(clip.endMs)} />
            <MetaChip label="Duration" value={formatTime(clip.durationMs)} />
            <MetaChip label="Ratio" value={clip.aspectRatio || "Original"} />
            <MetaChip label="Mode" value={formatMode(clip)} />
            <MetaChip
              label="Output"
              value={
                clip.outputWidth && clip.outputHeight
                  ? `${clip.outputWidth}×${clip.outputHeight}`
                  : "MP4"
              }
            />
          </div>

          {/* Transcript Preview */}
          <div className="rounded-lg bg-blue-50 p-3 border border-blue-100">
            <p className="text-sm leading-6 text-zinc-800 line-clamp-3">
              {segments[0]?.text ||
                clip.transcriptText ||
                "Transcript unavailable."}
            </p>
          </div>

          {/* Expand Button */}
          {segments.length > 0 && (
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:border-zinc-300"
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Full Transcript
            </button>
          )}
        </div>
      </div>

      {/* Expanded Transcript */}
      {isExpanded && segments.length > 0 ? (
        <div className="mt-5 pt-5 border-t border-zinc-100">
          <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wide mb-3">
            Clip Segments ({segments.length})
          </p>
          <div className="max-h-80 space-y-2 overflow-auto pr-2">
            {segments.map((segment) => (
              <TranscriptRow
                key={`${clip.id}-${segment.id}`}
                segment={segment}
              />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function TranscriptRow({ segment }: { segment: TranscriptSegment }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 hover:bg-blue-50/30 transition">
      <p className="font-mono text-xs font-medium text-blue-600 mb-2">
        {formatTime(segment.startMs)} – {formatTime(segment.endMs)}
      </p>
      <p className="text-sm leading-6 text-zinc-800">{segment.text}</p>
    </article>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1.5 truncate text-sm font-semibold text-zinc-900">
        {value}
      </p>
    </div>
  );
}

function getClipSegments(clip: ClipResult, segments: TranscriptSegment[]) {
  return segments.filter(
    (segment) => segment.endMs > clip.startMs && segment.startMs < clip.endMs,
  );
}

function formatMode(clip: ClipResult) {
  if (!clip.reframeMode) {
    return "Original";
  }

  if (clip.reframeMode === "smart") {
    return "AI face";
  }

  return clip.normalStrategy?.replace("-", " ") || "Normal";
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
