"use client";

import { Loader2, UploadCloud } from "lucide-react";
import type { AspectRatio, NormalReframeStrategy, ReframeMode, SmartReframeLayout } from "@/lib/types";

export function ReframeControls({
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
        <span className="mb-2 block text-sm font-medium text-muted-foreground">
          Aspect ratio
        </span>
        <select
          value={aspectRatio}
          onChange={(event) =>
            onAspectRatioChange(event.target.value as AspectRatio)
          }
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="9:16">9:16 Shorts</option>
          <option value="16:9">16:9 Wide</option>
          <option value="1:1">1:1 Square</option>
          <option value="4:5">4:5 Feed</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-muted-foreground">
          Mode
        </span>
        <select
          value={reframeMode}
          onChange={(event) =>
            onReframeModeChange(event.target.value as ReframeMode)
          }
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="normal">Normal FFmpeg</option>
          <option value="smart">AI face center</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-muted-foreground">
          Smart layout
        </span>
        <select
          value={smartLayout}
          onChange={(event) =>
            onSmartLayoutChange(event.target.value as SmartReframeLayout)
          }
          disabled={reframeMode !== "smart"}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm disabled:bg-muted disabled:text-muted-foreground"
        >
          <option value="single">One speaker</option>
          <option value="split">Split both</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-muted-foreground">
          Normal style
        </span>
        <select
          value={normalStrategy}
          onChange={(event) =>
            onNormalStrategyChange(event.target.value as NormalReframeStrategy)
          }
          disabled={reframeMode === "smart"}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm disabled:bg-muted disabled:text-muted-foreground"
        >
          <option value="crop">Crop</option>
          <option value="blur-background">Blur background</option>
          <option value="pad">Pad</option>
        </select>
      </label>
    </div>
  );
}

export function UploadPanel({
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
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <UploadCloud className="size-5 text-emerald-700" />
        <h2 className="text-base font-semibold">Upload</h2>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-muted-foreground">
          Video file
        </span>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-medium text-muted-foreground">
          Transcript language
        </span>
        <select
          value={language}
          onChange={(event) => onLanguageChange(event.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
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
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <UploadCloud className="size-4" />
        )}
        {isUploading ? "Uploading" : "Process video"}
      </button>

      {file ? (
        <p className="mt-3 truncate text-xs text-muted-foreground">
          Selected: {file.name}
        </p>
      ) : null}
    </form>
  );
}
