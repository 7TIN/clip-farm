"use client";

import { Database, Loader2, RefreshCw } from "lucide-react";
import { formatTime } from "@/lib/api";
import type { StoredVideoSummary } from "@/lib/types";

export function StoredVideosPanel({
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
