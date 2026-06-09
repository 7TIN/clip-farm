"use client";

import { useState } from "react";
import { Film, Loader2, RefreshCw, Settings2, Sparkles, Trash2, Wrench } from "lucide-react";
import { formatTime } from "@/lib/api";
import type { AspectRatio, JobState, NormalReframeStrategy, ReframeJobState, ReframeJobSummary, ReframeMode, ReframeSettings, SmartReframeLayout } from "@/lib/types";
import { MetaChip } from "./meta-chip";
import { ReframeControls } from "./upload-panel";

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

function formatSettings(settings: ReframeSettings) {
  if (settings.mode === "smart") {
    return `${settings.aspectRatio} smart ${settings.smartLayout}`;
  }

  return `${settings.aspectRatio} ${settings.normalStrategy.replace("-", " ")}`;
}

export function PreviewPanel({
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
