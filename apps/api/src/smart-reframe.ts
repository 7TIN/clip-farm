import path from "node:path";

import type { ReframeSettings, SmartCropMetadata } from "./types";

type PythonSmartCropResponse = {
  layout?: "single" | "split";
  source_width: number;
  source_height: number;
  target_width: number;
  target_height: number;
  crop_width: number;
  crop_height: number;
  split_orientation?: "vertical" | "horizontal";
  panels?: Array<{
    label?: "primary" | "secondary";
    x: number;
    y: number;
    width: number;
    height: number;
    confidence?: number;
  }>;
  entries: Array<{
    time_ms: number;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence?: number;
  }>;
};

export async function analyzeSmartCrop(
  videoPath: string,
  settings: ReframeSettings,
) {
  const pythonBin =
  process.env.PYTHON_BIN ||
  path.resolve(process.cwd(), ".venv/Scripts/python.exe");
  const scriptPath = path.resolve(
    import.meta.dir,
    "../scripts/smart_reframe.py",
  );
  let proc: Bun.Subprocess<"pipe", "pipe", "pipe">;

  try {
    proc = Bun.spawn(
      [
        pythonBin,
        scriptPath,
        "--video-path",
        videoPath,
        "--target-width",
        String(settings.targetWidth),
        "--target-height",
        String(settings.targetHeight),
        "--layout",
        settings.smartLayout,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
  } catch (error) {
    throw new Error(`Smart reframe could not start Python: ${String(error)}`);
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const details = stderr.trim() || stdout.trim() || `exit code ${exitCode}`;
    throw new Error(`Smart reframe analysis failed: ${details}`);
  }

  let parsed: PythonSmartCropResponse;

  try {
    parsed = JSON.parse(stdout) as PythonSmartCropResponse;
  } catch {
    throw new Error("Smart reframe analysis did not return valid JSON.");
  }

  return normalizeSmartCrop(parsed);
}

function normalizeSmartCrop(
  response: PythonSmartCropResponse,
): SmartCropMetadata {
  return {
    layout: response.layout || "single",
    sourceWidth: response.source_width,
    sourceHeight: response.source_height,
    targetWidth: response.target_width,
    targetHeight: response.target_height,
    cropWidth: response.crop_width,
    cropHeight: response.crop_height,
    entries: response.entries.map((entry) => ({
      timeMs: entry.time_ms,
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height,
      confidence: entry.confidence,
    })),
    splitOrientation: response.split_orientation,
    panels: response.panels?.map((panel, index) => ({
      label: panel.label || (index === 0 ? "primary" : "secondary"),
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
      confidence: panel.confidence,
    })),
  };
}
