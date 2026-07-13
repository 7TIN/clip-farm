"use client";

import { RefreshCw } from "lucide-react";
import type { CaptionJobState, JobState, ReframeJobState } from "@/lib/types";

export function StatusPanel({
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
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <RefreshCw className="size-5 text-amber-700" />
        <h2 className="text-base font-semibold">Status</h2>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${active?.progress || 0}%` }}
        />
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium capitalize text-foreground">
            {active?.status?.replaceAll("_", " ") || "Idle"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error || active?.error || active?.message || "Waiting for upload."}
          </p>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {active?.progress || 0}%
        </span>
      </div>
    </section>
  );
}
