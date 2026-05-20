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
