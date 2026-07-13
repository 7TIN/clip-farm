"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { absoluteApiUrl } from "@/lib/api";
import type { CaptionJobState, ClipResult, TranscriptSegment, TranscriptWord } from "@/lib/types";
import { CaptionPreviewPlayer, type CaptionSettings } from "@/components/caption-preview";
import { CaptionControls, defaultCaptionSettings } from "./caption-controls";
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
    ...defaultCaptionSettings,
    style: clip.captionStyle || defaultCaptionSettings.style,
    effect: clip.captionEffect || defaultCaptionSettings.effect,
    position: clip.captionPosition || defaultCaptionSettings.position,
  });
  const [viewMode, setViewMode] = useState<"original" | "preview">("original");
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
    <article className="rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-rose-700">Clip {index + 1}</p>
          <h3 className="text-base font-semibold leading-6">{clip.title}</h3>
        </div>
        <span className="w-fit rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {clip.status}
        </span>
      </div>

      <div className={`grid gap-4 ${layoutClass}`}>
        <div>
          {mediaUrl && viewMode === "preview" ? (
            <div
              className={`overflow-hidden w-full rounded-md bg-black ${clip.aspectRatio === "9:16" ? "max-w-60 aspect-[9/16]" : ""} ${clip.aspectRatio === "4:5" ? "max-w-sm aspect-[4/5]" : ""} ${clip.aspectRatio === "1:1" ? "max-w-120 aspect-square" : ""} ${clip.aspectRatio === "16:9" ? "aspect-video" : ""}`}
            >
              <CaptionPreviewPlayer
                clipSrc={mediaUrl}
                clip={clip}
                words={transcriptWords}
                settings={captionSettings}
              />
            </div>
          ) : mediaUrl ? (
            <video
              src={captionedMediaUrl || mediaUrl}
              controls
              className={`aspect-auto w-full rounded-md bg-black ${clip.aspectRatio === "16:9" ? "w-full" : ""} ${clip.aspectRatio === "9:16" ? "max-w-60 " : ""} ${clip.aspectRatio === "4:5" ? "max-w-sm" : ""} ${clip.aspectRatio === "1:1" ? "max-w-120" : ""}`}
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-border bg-muted text-sm text-muted-foreground">
              Clip video not rendered yet.
            </div>
          )}
        </div>

        <div className="grid content-start gap-10">
          <CaptionControls
            clip={clip}
            mediaUrl={mediaUrl}
            captionedMediaUrl={captionedMediaUrl}
            transcriptWords={transcriptWords}
            settings={captionSettings}
            viewMode={viewMode}
            isRendering={isThisCaptioning}
            onSettingsChange={setCaptionSettings}
            onSetOriginal={() => setViewMode("original")}
            onSetPreview={() => setViewMode("preview")}
            onRender={() => onRenderCaptions(clip, captionSettings)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
      >
        {isExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        Clip transcript
      </button>

      {isExpanded ? (
        <div className="mt-3 max-h-80 space-y-2 overflow-auto rounded-md border border-border bg-muted p-3">
          {segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
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
