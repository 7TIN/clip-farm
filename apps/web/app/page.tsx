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
  Trash2,
  UploadCloud,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CaptionPreviewPlayer,
  type CaptionSettings,
} from "./caption-preview";

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
type SmartReframeLayout = "single" | "split";

type ReframeSettings = {
  aspectRatio: AspectRatio;
  mode: ReframeMode;
  normalStrategy: NormalReframeStrategy;
  smartLayout: SmartReframeLayout;
  targetWidth: number;
  targetHeight: number;
};

type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerLabel?: string;
};

type TranscriptWord = {
  word: string;
  startMs: number;
  endMs: number;
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
  smartLayout?: SmartReframeLayout;
  outputWidth?: number;
  outputHeight?: number;
  renderVersion?: string;
  captionedMediaUrl?: string;
  captionStyle?: CaptionSettings["style"];
  captionEffect?: CaptionSettings["effect"];
  captionPosition?: CaptionSettings["position"];
  captionRenderVersion?: string;
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
    words?: TranscriptWord[];
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

type CaptionJobStatus =
  | "queued"
  | "preparing"
  | "rendering"
  | "complete"
  | "failed";

type CaptionJobState = {
  jobId: string;
  videoId: string;
  clipId: string;
  status: CaptionJobStatus;
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

type ReframeJobSummary = {
  jobId: string;
  videoId: string;
  status: ReframeJobStatus;
  progress: number;
  message: string;
  settings: ReframeSettings;
  clipFileCount: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
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
  const [smartLayout, setSmartLayout] = useState<SmartReframeLayout>("single");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [reframeJob, setReframeJob] = useState<ReframeJobState | null>(null);
  const [captionJob, setCaptionJob] = useState<CaptionJobState | null>(null);
  const [reframeJobs, setReframeJobs] = useState<ReframeJobSummary[]>([]);
  const [storedVideos, setStoredVideos] = useState<StoredVideoSummary[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingStoredVideos, setIsLoadingStoredVideos] = useState(false);
  const [isLoadingReframeJobs, setIsLoadingReframeJobs] = useState(false);
  const [isCleaningReframes, setIsCleaningReframes] = useState(false);
  const [isRepairingClips, setIsRepairingClips] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProcessing = Boolean(
    job && job.status !== "complete" && job.status !== "failed",
  );
  const isReframing = Boolean(
    reframeJob &&
    reframeJob.status !== "complete" &&
    reframeJob.status !== "failed",
  );
  const isCaptioning = Boolean(
    captionJob &&
    captionJob.status !== "complete" &&
    captionJob.status !== "failed",
  );
  const isBusy = isProcessing || isReframing || isCaptioning;

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
    const intervalId = window.setInterval(pollStatus, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [videoId, job?.status]);

  useEffect(() => {
    if (!reframeJob?.jobId) {
      return;
    }

    let cancelled = false;

    const pollReframe = async () => {
      while (!cancelled) {
        try {
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

            if (SHOW_DEV_LIBRARY) {
              void loadStoredVideos();
              void loadReframeJobs(payload.videoId);
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

  useEffect(() => {
    if (!captionJob?.jobId) {
      return;
    }

    let cancelled = false;

    const pollCaption = async () => {
      while (!cancelled) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/caption-jobs/${captionJob.jobId}/status`,
          );
          const payload = await response.json();

          if (!response.ok) {
            throw new Error(payload.error || "Could not load caption status.");
          }

          setCaptionJob(payload);

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
          setError(
            pollError instanceof Error
              ? pollError.message
              : "Caption polling failed.",
          );
          break;
        }
      }
    };

    void pollCaption();

    return () => {
      cancelled = true;
    };
  }, [captionJob?.jobId]);

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

  async function loadReframeJobs(selectedVideoId: string) {
    if (!SHOW_DEV_LIBRARY) {
      return;
    }

    setIsLoadingReframeJobs(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/dev/videos/${selectedVideoId}/reframes`,
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not load reframe jobs.");
      }

      setReframeJobs(payload.jobs || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Reframe jobs failed to load.",
      );
    } finally {
      setIsLoadingReframeJobs(false);
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
      void loadReframeJobs(payload.videoId);
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
      body.append("smartLayout", smartLayout);

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
            smartLayout,
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

  async function handleDeleteReframe(settings?: ReframeSettings) {
    if (!job?.videoId) {
      setError("Open a processed video before deleting reframe variants.");
      return;
    }

    setIsCleaningReframes(true);
    setError(null);

    try {
      const selectedSettings = settings || {
        aspectRatio,
        mode: reframeMode,
        normalStrategy,
        smartLayout,
        targetWidth: 0,
        targetHeight: 0,
      };
      const response = await fetch(
        `${API_BASE_URL}/dev/videos/${job.videoId}/reframes`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            aspectRatio: selectedSettings.aspectRatio,
            reframeMode: selectedSettings.mode,
            normalStrategy: selectedSettings.normalStrategy,
            smartLayout: selectedSettings.smartLayout,
          }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete reframe variant.");
      }

      setJob(payload.job);
      await loadReframeJobs(job.videoId);
      if (SHOW_DEV_LIBRARY) {
        void loadStoredVideos();
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Reframe cleanup failed.",
      );
    } finally {
      setIsCleaningReframes(false);
    }
  }

  async function handleRepairClips() {
    if (!job?.videoId) {
      setError("Open a processed video before repairing clip files.");
      return;
    }

    setIsRepairingClips(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/dev/videos/${job.videoId}/repair-clips`,
        {
          method: "POST",
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not repair clip files.");
      }

      setJob(payload.job);
      await loadReframeJobs(job.videoId);
    } catch (repairError) {
      setError(
        repairError instanceof Error
          ? repairError.message
          : "Clip repair failed.",
      );
    } finally {
      setIsRepairingClips(false);
    }
  }

  async function handleRenderCaptions(clip: ClipResult, settings: CaptionSettings) {
    if (!job?.videoId) {
      setError("Open a processed video before rendering captions.");
      return;
    }

    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/videos/${job.videoId}/clips/${clip.id}/captions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            renderVersion: clip.renderVersion,
            ...settings,
          }),
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Could not start caption render.");
      }

      setCaptionJob({
        jobId: payload.jobId,
        videoId: payload.videoId,
        clipId: payload.clipId,
        status: "queued",
        progress: 1,
        message: "Queued caption render.",
      });
    } catch (captionError) {
      setError(
        captionError instanceof Error
          ? captionError.message
          : "Caption render failed to start.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-zinc-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Clip Farm MVP
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Video to transcript clips
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            <span>Polling every 5 seconds</span>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <UploadPanel
              file={file}
              language={language}
              aspectRatio={aspectRatio}
              reframeMode={reframeMode}
              normalStrategy={normalStrategy}
              smartLayout={smartLayout}
              isUploading={isUploading}
              isBusy={isBusy}
              onFileChange={setFile}
              onLanguageChange={setLanguage}
              onAspectRatioChange={setAspectRatio}
              onReframeModeChange={setReframeMode}
              onNormalStrategyChange={setNormalStrategy}
              onSmartLayoutChange={setSmartLayout}
              onSubmit={handleSubmit}
            />
            <PreviewPanel
              job={job}
              originalVideoUrl={originalVideoUrl}
              aspectRatio={aspectRatio}
              reframeMode={reframeMode}
              normalStrategy={normalStrategy}
              smartLayout={smartLayout}
              reframeJobs={reframeJobs}
              isLoadingReframeJobs={isLoadingReframeJobs}
              isReframing={isReframing}
              isCleaningReframes={isCleaningReframes}
              isRepairingClips={isRepairingClips}
              onAspectRatioChange={setAspectRatio}
              onReframeModeChange={setReframeMode}
              onNormalStrategyChange={setNormalStrategy}
              onSmartLayoutChange={setSmartLayout}
              onReframe={handleReframe}
              onRefreshReframeJobs={() =>
                job?.videoId && void loadReframeJobs(job.videoId)
              }
              onDeleteReframe={(settings) => void handleDeleteReframe(settings)}
              onRepairClips={() => void handleRepairClips()}
            />
          </div>
          <div className="flex flex-col gap-4">
            {SHOW_DEV_LIBRARY ? (
              <StoredVideosPanel
                videos={storedVideos}
                activeVideoId={job?.videoId}
                isLoading={isLoadingStoredVideos}
                onRefresh={loadStoredVideos}
                onSelect={loadStoredVideo}
              />
            ) : null}

            <StatusPanel
              job={job}
              reframeJob={reframeJob}
              captionJob={captionJob}
              error={error}
            />
            <TranscriptPanel
              segments={job?.result?.transcript.segments || []}
              className=""
            />
          </div>
        </section>

        <ClipsPanel
          clips={job?.result?.clips || []}
          transcript={job?.result?.transcript}
          activeCaptionJob={captionJob}
          isCaptioning={isCaptioning}
          onRenderCaptions={handleRenderCaptions}
        />
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
  smartLayout,
  isUploading,
  isBusy,
  onFileChange,
  onLanguageChange,
  onAspectRatioChange,
  onReframeModeChange,
  onNormalStrategyChange,
  onSmartLayoutChange,
  onSubmit,
}: {
  file: File | null;
  language: string;
  aspectRatio: AspectRatio;
  reframeMode: ReframeMode;
  normalStrategy: NormalReframeStrategy;
  smartLayout: SmartReframeLayout;
  isUploading: boolean;
  isBusy: boolean;
  onFileChange: (file: File | null) => void;
  onLanguageChange: (language: string) => void;
  onAspectRatioChange: (aspectRatio: AspectRatio) => void;
  onReframeModeChange: (mode: ReframeMode) => void;
  onNormalStrategyChange: (strategy: NormalReframeStrategy) => void;
  onSmartLayoutChange: (layout: SmartReframeLayout) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <UploadCloud className="size-5 text-emerald-700" />
        <h2 className="text-base font-semibold">Upload</h2>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-700">
          Video file
        </span>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-medium text-zinc-700">
          Transcript language
        </span>
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

      <div className="mt-4">
        <ReframeControls
          aspectRatio={aspectRatio}
          reframeMode={reframeMode}
          normalStrategy={normalStrategy}
          smartLayout={smartLayout}
          onAspectRatioChange={onAspectRatioChange}
          onReframeModeChange={onReframeModeChange}
          onNormalStrategyChange={onNormalStrategyChange}
          onSmartLayoutChange={onSmartLayoutChange}
        />
      </div>

      <button
        type="submit"
        disabled={!file || isUploading || isBusy}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UploadCloud className="size-4" />
        )}
        {isUploading ? "Uploading" : "Process video"}
      </button>

      {file ? (
        <p className="mt-3 truncate text-xs text-zinc-500">
          Selected: {file.name}
        </p>
      ) : null}
    </form>
  );
}

function ReframeControls({
  aspectRatio,
  reframeMode,
  normalStrategy,
  smartLayout,
  onAspectRatioChange,
  onReframeModeChange,
  onNormalStrategyChange,
  onSmartLayoutChange,
}: {
  aspectRatio: AspectRatio;
  reframeMode: ReframeMode;
  normalStrategy: NormalReframeStrategy;
  smartLayout: SmartReframeLayout;
  onAspectRatioChange: (aspectRatio: AspectRatio) => void;
  onReframeModeChange: (mode: ReframeMode) => void;
  onNormalStrategyChange: (strategy: NormalReframeStrategy) => void;
  onSmartLayoutChange: (layout: SmartReframeLayout) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-700">
          Aspect ratio
        </span>
        <select
          value={aspectRatio}
          onChange={(event) =>
            onAspectRatioChange(event.target.value as AspectRatio)
          }
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="9:16">9:16 Shorts</option>
          <option value="16:9">16:9 Wide</option>
          <option value="1:1">1:1 Square</option>
          <option value="4:5">4:5 Feed</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-700">
          Mode
        </span>
        <select
          value={reframeMode}
          onChange={(event) =>
            onReframeModeChange(event.target.value as ReframeMode)
          }
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="normal">Normal FFmpeg</option>
          <option value="smart">AI face center</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-700">
          Smart layout
        </span>
        <select
          value={smartLayout}
          onChange={(event) =>
            onSmartLayoutChange(event.target.value as SmartReframeLayout)
          }
          disabled={reframeMode !== "smart"}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm disabled:bg-zinc-100 disabled:text-zinc-500"
        >
          <option value="single">One speaker</option>
          <option value="split">Split both</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-700">
          Normal style
        </span>
        <select
          value={normalStrategy}
          onChange={(event) =>
            onNormalStrategyChange(event.target.value as NormalReframeStrategy)
          }
          disabled={reframeMode === "smart"}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm disabled:bg-zinc-100 disabled:text-zinc-500"
        >
          <option value="crop">Crop</option>
          <option value="blur-background">Blur background</option>
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
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
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
              activeVideoId === video.id
                ? "border-emerald-600"
                : "border-emerald-200"
            }`}
          >
            <span className="block truncate text-sm font-medium text-zinc-900">
              {video.title}
            </span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
              <span>{video.status.replaceAll("_", " ")}</span>
              <span>{video.clipCount} clips</span>
              {video.durationMs ? (
                <span>{formatTime(video.durationMs)}</span>
              ) : null}
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
  captionJob,
  error,
}: {
  job: JobState | null;
  reframeJob: ReframeJobState | null;
  captionJob: CaptionJobState | null;
  error: string | null;
}) {
  const active =
    captionJob && captionJob.status !== "complete"
      ? captionJob
      : reframeJob && reframeJob.status !== "complete"
        ? reframeJob
        : job;

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
  smartLayout,
  reframeJobs,
  isLoadingReframeJobs,
  isReframing,
  isCleaningReframes,
  isRepairingClips,
  onAspectRatioChange,
  onReframeModeChange,
  onNormalStrategyChange,
  onSmartLayoutChange,
  onReframe,
  onRefreshReframeJobs,
  onDeleteReframe,
  onRepairClips,
}: {
  job: JobState | null;
  originalVideoUrl?: string;
  aspectRatio: AspectRatio;
  reframeMode: ReframeMode;
  normalStrategy: NormalReframeStrategy;
  smartLayout: SmartReframeLayout;
  reframeJobs: ReframeJobSummary[];
  isLoadingReframeJobs: boolean;
  isReframing: boolean;
  isCleaningReframes: boolean;
  isRepairingClips: boolean;
  onAspectRatioChange: (aspectRatio: AspectRatio) => void;
  onReframeModeChange: (mode: ReframeMode) => void;
  onNormalStrategyChange: (strategy: NormalReframeStrategy) => void;
  onSmartLayoutChange: (layout: SmartReframeLayout) => void;
  onReframe: () => void;
  onRefreshReframeJobs: () => void;
  onDeleteReframe: (settings?: ReframeSettings) => void;
  onRepairClips: () => void;
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const firstClip = job?.result?.clips[0];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Film className="size-5 text-sky-700" />
          <h2 className="text-base font-semibold">Preview</h2>
        </div>
        <div className="flex items-center gap-2">
          {job?.result?.transcript.durationMs ? (
            <span className="text-xs text-zinc-500">
              {formatTime(job.result.transcript.durationMs)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setIsSettingsOpen((value) => !value)}
            disabled={!job?.result}
            title="Update clip framing"
            className="inline-flex size-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Settings2 className="size-4" />
          </button>
        </div>
      </div>

      {originalVideoUrl ? (
        <video
          src={originalVideoUrl}
          controls
          className="aspect-video w-full rounded-md bg-black"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-500">
          Upload a video or open a stored one.
        </div>
      )}

      {isSettingsOpen && job?.result ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-sky-700" />
            <p className="text-sm font-semibold">Update rendered clips</p>
          </div>
          <ReframeControls
            aspectRatio={aspectRatio}
            reframeMode={reframeMode}
            normalStrategy={normalStrategy}
            smartLayout={smartLayout}
            onAspectRatioChange={onAspectRatioChange}
            onReframeModeChange={onReframeModeChange}
            onNormalStrategyChange={onNormalStrategyChange}
            onSmartLayoutChange={onSmartLayoutChange}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReframe}
              disabled={isReframing}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isReframing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Update clips
            </button>
            <button
              type="button"
              onClick={() => onDeleteReframe()}
              disabled={isCleaningReframes}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCleaningReframes ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete selected
            </button>
            <button
              type="button"
              onClick={onRepairClips}
              disabled={isRepairingClips}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRepairingClips ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wrench className="size-4" />
              )}
              Repair files
            </button>
          </div>
          <ReframeJobsList
            jobs={reframeJobs}
            isLoading={isLoadingReframeJobs}
            isDeleting={isCleaningReframes}
            onRefresh={onRefreshReframeJobs}
            onDelete={onDeleteReframe}
          />
        </div>
      ) : null}

      {job?.result?.video ? (
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-600 sm:grid-cols-4">
          <MetaChip
            label="File"
            value={job.result.video.originalFilename || job.videoId}
          />
          <MetaChip
            label="Source size"
            value={
              job.result.video.width && job.result.video.height
                ? `${job.result.video.width}x${job.result.video.height}`
                : "Unknown"
            }
          />
          <MetaChip label="Codec" value={job.result.video.codec || "Unknown"} />
          <MetaChip
            label="Clip render"
            value={
              firstClip?.outputWidth && firstClip.outputHeight
                ? `${firstClip.outputWidth}x${firstClip.outputHeight}`
                : "Original"
            }
          />
        </div>
      ) : null}
    </section>
  );
}

function ReframeJobsList({
  jobs,
  isLoading,
  isDeleting,
  onRefresh,
  onDelete,
}: {
  jobs: ReframeJobSummary[];
  isLoading: boolean;
  isDeleting: boolean;
  onRefresh: () => void;
  onDelete: (settings: ReframeSettings) => void;
}) {
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Reframe jobs</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Refresh
        </button>
      </div>

      <div className="max-h-48 space-y-2 overflow-auto pr-1">
        {jobs.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
            No saved reframe jobs for this video.
          </p>
        ) : null}

        {jobs.map((job) => (
          <div
            key={job.jobId}
            className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">
                {formatSettings(job.settings)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {job.status} - {job.clipFileCount} files
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(job.settings)}
              disabled={isDeleting}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              title="Delete this reframe variant"
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
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
        "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <FileText className="size-5 text-violet-700" />
        <h2 className="text-base font-semibold">Transcript</h2>
      </div>

      <div className="max-h-[420px] space-y-3 overflow-auto pr-1 ">
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
  const layoutClass =
    clip.aspectRatio === "9:16"
      ? "lg:grid-cols-[260px_1fr]"
      : clip.aspectRatio === "4:5"
        ? "lg:grid-cols-[340px_1fr]"
        : clip.aspectRatio === "1:1"
          ? "lg:grid-cols-[420px_1fr]"
          : "lg:grid-cols-[minmax(320px,620px)_1fr]";

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

      {/* <div className="grid gap-4 lg:grid-cols-[minmax(320px,620px)_1fr]"> */}
      <div className={`grid gap-4 ${layoutClass}`}>
        <div className={`w-fit`}>
          {mediaUrl ? (
            <video
              src={mediaUrl}
              controls
              className={`aspect-auto w-full rounded-md bg-black ${clip.aspectRatio === "16:9" ? "w-full" : ""} ${clip.aspectRatio === "9:16" ? "max-w-60 " : ""} ${clip.aspectRatio === "4:5" ? "max-w-sm" : ""} ${clip.aspectRatio === "1:1" ? "max-w-120" : ""}`}
            />
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
            <MetaChip label="Ratio" value={clip.aspectRatio || "Original"} />
            <MetaChip label="Mode" value={formatMode(clip)} />
            <MetaChip
              label="Output"
              value={
                clip.outputWidth && clip.outputHeight
                  ? `${clip.outputWidth}x${clip.outputHeight}`
                  : "MP4"
              }
            />
          </div>

          <p className="rounded-md bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
            {segments[0]?.text ||
              clip.transcriptText ||
              "Transcript unavailable."}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
      >
        {isExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        Clip transcript
      </button>

      {isExpanded ? (
        <div className="mt-3 max-h-80 space-y-2 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
          {segments.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No timestamped transcript rows found for this clip.
            </p>
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
      <p className="text-[11px] font-medium uppercase tracking-normal text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-zinc-900">{value}</p>
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
    return clip.smartLayout === "split" ? "AI split" : "AI face";
  }

  return clip.normalStrategy?.replace("-", " ") || "Normal";
}

function formatSettings(settings: ReframeSettings) {
  if (settings.mode === "smart") {
    return `${settings.aspectRatio} smart ${settings.smartLayout}`;
  }

  return `${settings.aspectRatio} ${settings.normalStrategy.replace("-", " ")}`;
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