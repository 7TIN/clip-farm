"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { absoluteApiUrl, formatTime, formatMode } from "@/lib/api";
import type { CaptionJobState, ClipResult, TranscriptSegment, TranscriptWord } from "@/lib/types";
import type { CaptionSettings } from "@/components/caption-preview";
import { MetaChip } from "./meta-chip";
import { CaptionControls } from "./caption-controls";
import { TranscriptRow } from "./transcript-panel";

export function ClipCard({
  clip,
  index,
  segments,
  transcriptWords,
  activeCaptionJob,
  isCaptioning,
  isExpanded,
  onToggle,
  onRenderCaptions,
}: {
  clip: ClipResult;
  index: number;
  segments: TranscriptSegment[];
  transcriptWords: TranscriptWord[];
  activeCaptionJob: CaptionJobState | null;
  isCaptioning: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onRenderCaptions: (clip: ClipResult, settings: CaptionSettings) => Promise<void>;
}) {
  const mediaUrl = absoluteApiUrl(clip.mediaUrl);
  const captionedMediaUrl = absoluteApiUrl(clip.captionedMediaUrl);
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>({
    style: clip.captionStyle || "hormozi",
    effect: clip.captionEffect || "magic",
    position: clip.captionPosition || "bottom",
    maxWordsPerPage: 6,
    maxPageDurationMs: 1800,
  });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const isThisCaptioning =
    isCaptioning &&
    activeCaptionJob?.clipId === clip.id &&
    (!activeCaptionJob || activeCaptionJob.status !== "failed");
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

      <CaptionControls
        clip={clip}
        mediaUrl={mediaUrl}
        captionedMediaUrl={captionedMediaUrl}
        transcriptWords={transcriptWords}
        settings={captionSettings}
        isPreviewOpen={isPreviewOpen}
        isRendering={isThisCaptioning}
        onSettingsChange={setCaptionSettings}
        onTogglePreview={() => setIsPreviewOpen((value) => !value)}
        onRender={() => onRenderCaptions(clip, captionSettings)}
      />

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
