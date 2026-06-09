export type JobStatus =
  | "queued"
  | "saving_upload"
  | "extracting_audio"
  | "transcribing"
  | "generating_clips"
  | "rendering_clips"
  | "complete"
  | "failed";

export type ReframeJobStatus =
  | "queued"
  | "analyzing"
  | "rendering"
  | "complete"
  | "failed";

export type CaptionJobStatus =
  | "queued"
  | "preparing"
  | "rendering"
  | "complete"
  | "failed";

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
export type ReframeMode = "normal" | "smart";
export type NormalReframeStrategy = "crop" | "blur-background" | "pad";
export type SmartReframeLayout = "single" | "split";
export type CaptionStylePreset = "basic" | "hormozi" | "bubbly";
export type CaptionEffect = "none" | "magic";
export type CaptionPosition = "top" | "center" | "bottom";

export type ReframeSettings = {
  aspectRatio: AspectRatio;
  mode: ReframeMode;
  normalStrategy: NormalReframeStrategy;
  smartLayout: SmartReframeLayout;
  targetWidth: number;
  targetHeight: number;
};

export type CaptionSettings = {
  style: CaptionStylePreset;
  effect: CaptionEffect;
  position: CaptionPosition;
  maxWordsPerPage: number;
  maxPageDurationMs: number;
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

export type ClipResult = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  transcriptText: string;
  source: "random_mvp";
  status: "suggested" | "rendered" | "failed";
  mediaUrl?: string;
  aspectRatio?: AspectRatio;
  reframeMode?: ReframeMode;
  normalStrategy?: NormalReframeStrategy;
  smartLayout?: SmartReframeLayout;
  outputWidth?: number;
  outputHeight?: number;
  renderVersion?: string;
  captionedMediaUrl?: string;
  captionStyle?: CaptionStylePreset;
  captionEffect?: CaptionEffect;
  captionPosition?: CaptionPosition;
  captionRenderVersion?: string;
};

export type ProcessResult = {
  originalVideoUrl?: string;
  video?: {
    originalFilename?: string;
    width?: number;
    height?: number;
    codec?: string;
    durationMs?: number;
  };
  transcript: {
    text: string;
    segments: TranscriptSegment[];
    words?: TranscriptWord[];
    durationMs?: number;
  };
  clips: ClipResult[];
};

export type JobState = {
  jobId: string;
  videoId: string;
  status: JobStatus;
  progress: number;
  message: string;
  error?: string;
  result?: ProcessResult;
};

export type ReframeJobState = {
  jobId: string;
  videoId: string;
  status: ReframeJobStatus;
  progress: number;
  message: string;
  error?: string;
  result?: ProcessResult;
};

export type CaptionJobState = {
  jobId: string;
  videoId: string;
  clipId: string;
  status: CaptionJobStatus;
  progress: number;
  message: string;
  error?: string;
  result?: ProcessResult;
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
