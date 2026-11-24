import { asFolder } from "../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { CapturedFileFrame } from "../application/ports/captured-file-frame.ts";
import type { Rendering } from "../application/ports/harness.ts";
import type { LegacyRunnerScratch } from "../application/ports/legacy-runner.ts";
import type { ProjectedFile } from "../domain/projected-file.ts";

const failedFrame = (reason: string): Rendering => refused({
  kind: "render-failed", concept: "onboarding", name: "captured-file-frame", reason,
});

const stageFiles = (request: {
  readonly files: readonly ProjectedFile[]; readonly folder: URL; readonly scratch: LegacyRunnerScratch;
}): Promise<Result<undefined, string>> => request.files.reduce<Promise<Result<undefined, string>>>(
  async (previous, file) => {
    const staged = await previous;
    if (!staged.ok) return staged;
    const location = new URL(file.path.split("/").map(encodeURIComponent).join("/"), asFolder(request.folder));
    const parent = await request.scratch.makeFolder({ folder: new URL(".", location) });
    if (!parent.ok) return refused(`The captured folder is unavailable: ${file.path}: ${parent.refusal.code}`);
    const written = await request.scratch.writeFile({ file: location, content: file.content });
    return written.ok ? accepted(undefined)
      : refused(`The captured file is unwritable: ${file.path}: ${written.refusal.code}`);
  }, Promise.resolve(accepted(undefined)),
);

export const createCapturedFileFrame = (ports: {
  readonly scratch: LegacyRunnerScratch; readonly frames: URL;
  readonly nativePath: (location: URL) => string;
}): CapturedFileFrame => ({
  render: async (request) => {
    const parent = await ports.scratch.makeFolder({ folder: ports.frames });
    if (!parent.ok) return failedFrame(`The frame parent is unavailable: ${parent.refusal.code}`);
    const folder = await ports.scratch.makeScratchFolder({ parent: ports.frames });
    if (!folder.ok) return failedFrame(`The captured frame is unavailable: ${folder.refusal.code}`);
    let rendered: Rendering;
    try {
      const staged = await stageFiles({ files: request.files, folder: folder.value, scratch: ports.scratch });
      rendered = staged.ok ? request.render(ports.nativePath(folder.value)) : failedFrame(staged.refusal);
    } catch (error) {
      rendered = failedFrame(error instanceof Error ? error.message : String(error));
    }
    try {
      const removed = await ports.scratch.removeFolder({ folder: folder.value });
      return !rendered.ok || removed.ok ? rendered
        : failedFrame(`The captured frame could not be removed: ${removed.refusal.code}`);
    } catch (error) {
      return !rendered.ok ? rendered : failedFrame(
        `The captured frame could not be removed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },
});

export const CAPTURED_FRAME_NATIVE_PATH = (location: URL): string => Bun.fileURLToPath(location);
