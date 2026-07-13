"use client";

import { Check, Loader2, Palette, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import type { CaptionSettings, ClipResult, TranscriptWord } from "@/lib/types";

const presets: CaptionSettings["style"][] = [
  "aesthetic",
  "editorial",
  "punchy",
  "minimal",
  "hormozi",
  "basic",
  "bubbly",
];

const positions: CaptionSettings["position"][] = [
  "center",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "top",
  "bottom",
];

const specialColors = [
  { label: "Yellow", value: "yellow-300", hex: "#fde047" },
  { label: "Amber", value: "amber-300", hex: "#fcd34d" },
  { label: "Emerald", value: "emerald-300", hex: "#6ee7b7" },
  { label: "Teal", value: "teal-300", hex: "#5eead4" },
  { label: "Cyan", value: "cyan-300", hex: "#67e8f9" },
  { label: "Sky", value: "sky-300", hex: "#7dd3fc" },
  { label: "Rose", value: "rose-400", hex: "#fb7185" },
  { label: "White", value: "white", hex: "#ffffff" },
];

const textColors = [
  { label: "White", value: "#ffffff", hex: "#ffffff" },
  { label: "Zinc", value: "#e4e4e7", hex: "#e4e4e7" },
  { label: "Slate", value: "#cbd5e1", hex: "#cbd5e1" },
  { label: "Stone", value: "#d6d3d1", hex: "#d6d3d1" },
  { label: "Amber", value: "#fef3c7", hex: "#fef3c7" },
  { label: "Rose", value: "#ffe4e6", hex: "#ffe4e6" },
  { label: "Sky", value: "#e0f2fe", hex: "#e0f2fe" },
  { label: "Black", value: "#000000", hex: "#000000" },
];

export const defaultCaptionSettings: CaptionSettings = {
  style: "aesthetic",
  effect: "none",
  position: "center",
  maxWordsPerPage: 6,
  maxPageDurationMs: 1800,
  specialFontColor: "yellow-300",
  normalColor: "#ffffff",
  mutedColor: "#e4e4e7",
  stylishFrequency: 0.22,
  verticalFrequency: 0.34,
  boldFrequency: 0.18,
  maxWordsPerScene: 3,
  normalFontSize: 72,
  stylishFontSize: 88,
  formalFontSize: 64,
  boldFontSize: 118,
  normalFontWeight: 760,
  formalFontWeight: 430,
  boldFontWeight: 900,
};

export function CaptionControls({
  clip,
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
  const canPreview = transcriptWords.length > 0;
  const update = <Key extends keyof CaptionSettings>(
    key: Key,
    value: CaptionSettings[Key],
  ) => onSettingsChange({ ...settings, [key]: value });

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">Captions</p>
          <p className="text-xs text-zinc-500">
            {captionedMediaUrl ? "Captioned export ready" : `${clip.durationMs ? Math.round(clip.durationMs / 1000) : 0}s clip`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSettingsChange({ ...defaultCaptionSettings, style: settings.style })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 transition hover:bg-zinc-50"
            aria-label="Reset caption controls"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={onTogglePreview}
            disabled={!canPreview}
            className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreviewOpen ? "Original" : "Preview"}
          </button>
          <button
            type="button"
            onClick={onRender}
            disabled={isRendering}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRendering ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Render
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        <ControlGroup icon={<Palette size={15} />} title="Look">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectControl
              label="Preset"
              value={settings.style}
              options={presets}
              onChange={(value) => update("style", value as CaptionSettings["style"])}
            />
            <SelectControl
              label="Position"
              value={settings.position}
              options={positions}
              onChange={(value) => update("position", value as CaptionSettings["position"])}
            />
          </div>
          <ColorPicker
            label="Special"
            value={settings.specialFontColor}
            options={specialColors}
            onChange={(value) => update("specialFontColor", value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <ColorPicker
              label="Normal"
              value={settings.normalColor}
              options={textColors}
              onChange={(value) => update("normalColor", value)}
            />
            <ColorPicker
              label="Soft"
              value={settings.mutedColor}
              options={textColors}
              onChange={(value) => update("mutedColor", value)}
            />
          </div>
        </ControlGroup>

        <ControlGroup icon={<SlidersHorizontal size={15} />} title="Mix">
          <RangeControl
            label="Stylish"
            value={settings.stylishFrequency}
            min={0}
            max={0.6}
            step={0.01}
            valueLabel={formatPercent(settings.stylishFrequency)}
            onChange={(value) => update("stylishFrequency", Number(value))}
          />
          <RangeControl
            label="Vertical"
            value={settings.verticalFrequency}
            min={0}
            max={0.8}
            step={0.01}
            valueLabel={formatPercent(settings.verticalFrequency)}
            onChange={(value) => update("verticalFrequency", Number(value))}
          />
          <RangeControl
            label="Bold"
            value={settings.boldFrequency}
            min={0}
            max={0.6}
            step={0.01}
            valueLabel={formatPercent(settings.boldFrequency)}
            onChange={(value) => update("boldFrequency", Number(value))}
          />
          <SelectControl
            label="Words"
            value={String(settings.maxWordsPerScene)}
            options={["2", "3", "4"]}
            onChange={(value) => update("maxWordsPerScene", Number(value) as 2 | 3 | 4)}
          />
        </ControlGroup>

        <ControlGroup icon={<SlidersHorizontal size={15} />} title="Type">
          <div className="grid gap-3 sm:grid-cols-2">
            <RangeControl
              label="Normal"
              value={settings.normalFontSize}
              min={48}
              max={96}
              step={1}
              valueLabel={`${settings.normalFontSize}px`}
              onChange={(value) => update("normalFontSize", Number(value))}
            />
            <RangeControl
              label="Bold"
              value={settings.boldFontSize}
              min={72}
              max={156}
              step={1}
              valueLabel={`${settings.boldFontSize}px`}
              onChange={(value) => update("boldFontSize", Number(value))}
            />
            <RangeControl
              label="Stylish"
              value={settings.stylishFontSize}
              min={56}
              max={112}
              step={1}
              valueLabel={`${settings.stylishFontSize}px`}
              onChange={(value) => update("stylishFontSize", Number(value))}
            />
            <RangeControl
              label="Formal"
              value={settings.formalFontSize}
              min={44}
              max={96}
              step={1}
              valueLabel={`${settings.formalFontSize}px`}
              onChange={(value) => update("formalFontSize", Number(value))}
            />
          </div>
        </ControlGroup>
      </div>
    </div>
  );
}

function ControlGroup({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-zinc-600">
        {icon}
        {title}
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function SelectControl({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-zinc-600">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-950 outline-none focus:border-zinc-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ColorPicker({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string; hex: string }>;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs font-medium text-zinc-600">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-zinc-500">{value}</span>
      </div>
      <div className="grid grid-cols-8 gap-2">
        {options.map((color) => {
          const selected = value === color.value;
          return (
            <button
              key={`${label}-${color.value}`}
              type="button"
              onClick={() => onChange(color.value)}
              className="relative h-7 rounded-md border border-zinc-200 ring-offset-2 transition hover:scale-105"
              style={{ backgroundColor: color.hex }}
              aria-label={`${label}: ${color.label}`}
            >
              {selected ? (
                <span className="absolute inset-0 flex items-center justify-center text-zinc-950">
                  <Check size={14} strokeWidth={3} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  step,
  value,
  valueLabel,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: string) => void;
  step: number;
  value: number;
  valueLabel: string;
}) {
  return (
    <label className="grid gap-2 text-xs font-medium text-zinc-600">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-zinc-500">{valueLabel}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-2 w-full accent-zinc-950"
      />
    </label>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
