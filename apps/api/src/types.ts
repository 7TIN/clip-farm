export type JobStatus =
  | "queued"
  | "saving_upload"
  | "extracting_audio"
  | "transcribing"
  | "generating_clips"
  | "rendering_clips"
  | "complete"
  | "failed";

export type JobState = {
  jobId: string;
  videoId: string;
  status: JobStatus;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: ProcessResult;
};

export type ProcessResult = {
  video: VideoMetadata;
  transcript: TranscriptJson;
  clips: ClipJson[];
};

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

export type ReframeMode = "normal" | "smart";

export type NormalReframeStrategy = "crop" | "blur-background" | "pad";

export type SmartReframeLayout = "single" | "split";

export type ReframeSettings = {
  aspectRatio: AspectRatio;
  mode: ReframeMode;
  normalStrategy: NormalReframeStrategy;
  smartLayout: SmartReframeLayout;
  targetWidth: number;
  targetHeight: number;
};

export type ReframeJobStatus =
  | "queued"
  | "analyzing"
  | "rendering"
  | "complete"
  | "failed";

export type ReframeJobState = {
  jobId: string;
  videoId: string;
  status: ReframeJobStatus;
  progress: number;
  message: string;
  settings: ReframeSettings;
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: ProcessResult;
};

export type SmartCropEntry = {
  timeMs: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
};

export type SmartSplitPanel = {
  label: "primary" | "secondary";
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
};

export type SmartCropMetadata = {
  layout: SmartReframeLayout;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  cropWidth: number;
  cropHeight: number;
  entries: SmartCropEntry[];
  splitOrientation?: "vertical" | "horizontal";
  panels?: SmartSplitPanel[];
};

export type VideoMetadata = {
  id: string;
  originalFilename: string;
  originalPath: string;
  audioPath?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  codec?: string;
  createdAt: string;
};

export type TranscriptJson = {
  videoId: string;
  provider: "smallest-ai-pulse";
  language: string;
  durationMs?: number;
  text: string;
  segments: TranscriptSegment[];
  words: TranscriptWord[];
  rawMetadata?: Record<string, unknown>;
};

export type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerLabel?: string;
};

export type TranscriptWord = {
  word: string;
  startMs: number;
  endMs: number;
  speakerLabel?: string;
};

export type ClipJson = {
  id: string;
  videoId: string;
  title: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  transcriptText: string;
  source: "random_mvp";
  status: "suggested" | "rendered" | "failed";
  outputPath?: string;
  mediaUrl?: string;
  aspectRatio?: AspectRatio;
  reframeMode?: ReframeMode;
  normalStrategy?: NormalReframeStrategy;
  smartLayout?: SmartReframeLayout;
  outputWidth?: number;
  outputHeight?: number;
  renderVersion?: string;
};

export type ReframeJobSummary = {
  jobId: string;
  videoId: string;
  status: ReframeJobStatus;
  progress: number;
  message: string;
  settings: ReframeSettings;
  clipFileCount: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type StoredVideoSummary = {
  id: string;
  title: string;
  status: JobStatus;
  progress: number;
  durationMs?: number;
  clipCount: number;
  hasTranscript: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SmallestPulseResponse = {
  status?: string;
  transcription?: string;
  audio_length?: number;
  words?: Array<{
    start?: number;
    end?: number;
    speaker?: string;
    word?: string;
  }>;
  utterances?: Array<{
    start?: number;
    end?: number;
    speaker?: string;
    text?: string;
    transcript?: string;
  }>;
  metadata?: Record<string, unknown>;
  error?: {
    message?: string;
    code?: string;
  };
};
