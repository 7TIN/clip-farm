"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/api";
import type { TranscriptSegment } from "@/lib/types";

export function TranscriptRow({ segment }: { segment: TranscriptSegment }) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-3">
      <p className="mb-2 font-mono text-xs text-zinc-500">
        {formatTime(segment.startMs)} - {formatTime(segment.endMs)}
      </p>
      <p className="text-sm leading-6 text-zinc-800">{segment.text}</p>
    </article>
  );
}

export function TranscriptPanel({
  segments,
  className = "",
}: {
  segments: TranscriptSegment[];
  className?: string;
}) {
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
