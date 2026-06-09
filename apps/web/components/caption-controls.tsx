"use client";

import { Film, Loader2, Sparkles } from "lucide-react";
import type { CaptionSettings } from "@/components/caption-preview";
import { CaptionPreviewPlayer } from "@/components/caption-preview";
import type { ClipResult, TranscriptWord } from "@/lib/types";

export function CaptionControls({
  clip,
  mediaUrl,
  captionedMediaUrl,
  transcriptWords,
  settings,
  isPreviewOpen,
  isRendering,
  onSettingsChange,
  onTogglePreview,
  onRender,
}: {
  clip: ClipResult;
  mediaUrl?: string;
  captionedMediaUrl?: string;
  transcriptWords: TranscriptWord[];
  settings: CaptionSettings;
  isPreviewOpen: boolean;
  isRendering: boolean;
  onSettingsChange: (settings: CaptionSettings) => void;
  onTogglePreview: () => void;
  onRender: () => void;
}) {
  const previewSource = mediaUrl;
  const canPreview = Boolean(mediaUrl && transcriptWords.length > 0);

  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Captions</p>
          <p className="text-xs text-zinc-500">
            {captionedMediaUrl ? "Captioned export is ready." : "Preview uses word timestamps from transcript JSON."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onTogglePreview}
            disabled={!canPreview}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Film className="size-4" />
            {isPreviewOpen ? "Hide preview" : "Caption preview"}
          </button>
          <button
            type="button"
            onClick={onRender}
            disabled={!mediaUrl || isRendering}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRendering ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Render captions
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-600">
            Style
          </span>
          <select
            value={settings.style}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                style: event.target.value as CaptionSettings["style"],
              })
            }
            className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="hormozi">Hormozi</option>
            <option value="basic">Basic</option>
            <option value="bubbly">Bubbly</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-600">
            Effect
          </span>
          <select
            value={settings.effect}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                effect: event.target.value as CaptionSettings["effect"],
              })
            }
            className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="magic">Magic</option>
            <option value="none">None</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-600">
            Position
          </span>
          <select
            value={settings.position}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                position: event.target.value as CaptionSettings["position"],
              })
            }
            className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
          >
            <option value="bottom">Bottom</option>
            <option value="center">Center</option>
            <option value="top">Top</option>
          </select>
        </label>
      </div>

      {isPreviewOpen && previewSource ? (
        <div className="mt-3 max-w-xs overflow-hidden rounded-md bg-black">
          <CaptionPreviewPlayer
            clipSrc={previewSource}
            clip={clip}
            words={transcriptWords}
            settings={settings}
          />
        </div>
      ) : null}
    </div>
  );
}
