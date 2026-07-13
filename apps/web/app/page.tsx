"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { API_BASE_URL, SHOW_DEV_LIBRARY, POLL_INTERVAL_MS, absoluteApiUrl } from "@/lib/api";
import type {
  AspectRatio,
  NormalReframeStrategy,
  ReframeMode,
  SmartReframeLayout,
  JobState,
  ReframeJobState,
  CaptionJobState,
  ReframeJobSummary,
  ReframeSettings,
  StoredVideoSummary,
  ClipResult,
} from "@/lib/types";
import type { CaptionSettings } from "@/components/caption-preview";
import { UploadPanel } from "@/components/upload-panel";
import { StoredVideosPanel } from "@/components/stored-videos-panel";
import { StatusPanel } from "@/components/status-panel";
import { PreviewPanel } from "@/components/preview-panel";
import { TranscriptPanel } from "@/components/transcript-panel";
import { ClipsPanel } from "@/components/clips-panel";

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
        console.error("Status polling error (retrying):", pollError);
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
          console.error("Reframe polling error (retrying):", pollError);
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
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

          const text = await response.text();
          let payload;
          try {
            payload = text ? JSON.parse(text) : {};
          } catch {
            throw new Error("Server returned invalid JSON.");
          }

          if (!response.ok) {
            throw new Error(payload.error || "Could not load caption status.");
          }

          setCaptionJob(payload);

          if (payload.status === "complete") {
            if (payload.result?.clip) {
              setJob((current) => {
                if (!current?.result) {
                  return current;
                }

                return {
                  ...current,
                  result: {
                    ...current.result,
                    clips: current.result.clips.map((clip) =>
                      clip.id === payload.result.clip.id &&
                      clip.renderVersion === payload.result.clip.renderVersion
                        ? payload.result.clip
                        : clip,
                    ),
                  },
                };
              });
            }
            break;
          }

          if (payload.status === "failed") {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (pollError) {
          console.error("Caption polling error (retrying):", pollError);
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Clip Farm MVP
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              Video to transcript clips
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
              segments={job?.result?.transcript?.segments || []}
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
