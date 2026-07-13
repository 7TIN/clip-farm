"use client";

import { useState } from "react";
import { Scissors } from "lucide-react";
import { getClipSegments } from "@/lib/api";
import type { CaptionJobState, ClipResult, TranscriptSegment, TranscriptWord } from "@/lib/types";
import type { CaptionSettings } from "@/components/caption-preview";
import { ClipCard } from "./clip-card";

export function ClipsPanel({
  clips,
  transcript,
  activeCaptionJob,
  isCaptioning,
  onRenderCaptions,
}: {
  clips: ClipResult[];
  transcript: { text: string; segments: TranscriptSegment[]; words?: TranscriptWord[] | undefined; durationMs?: number | undefined; } | undefined;
  activeCaptionJob: CaptionJobState | null;
  isCaptioning: boolean;
  onRenderCaptions: (clip: ClipResult, settings: CaptionSettings) => Promise<void>;
}) {
  const [expandedClipIds, setExpandedClipIds] = useState<Set<string>>(
    new Set(),
  );
  const segments = transcript?.segments || [];

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
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Scissors className="size-5 text-rose-700" />
        <h2 className="text-base font-semibold">Clips</h2>
      </div>

      <div className="flex max-h-[900px] flex-col gap-4 overflow-auto pr-1">
        {clips.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
            Generated clips will appear here.
          </div>
        ) : null}

        {clips.map((clip, index) => {
          const clipSegments = getClipSegments(clip, segments);

          return (
            <ClipCard
              key={`${clip.id}-${clip.renderVersion || "base"}`}
              clip={clip}
              index={index}
              segments={clipSegments}
              transcriptWords={transcript?.words || []}
              activeCaptionJob={activeCaptionJob}
              isCaptioning={isCaptioning}
              isExpanded={expandedClipIds.has(clip.id)}
              onToggle={() => toggleClip(clip.id)}
              onRenderCaptions={onRenderCaptions}
            />
          );
        })}
      </div>
    </section>
  );
}
