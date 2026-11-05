// The filesystem boundary for explicit workflow source capture. This port
// owns directory traversal, host path composition and missing-prior-grid I/O;
// the compiler receives only detached source values and never sees this port.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { WorkflowCompilationRequest } from "./aidlc-workflow-candidate.ts";

export interface WorkflowSourceReader {
  readonly stageSources: (directory: string) => WorkflowCompilationRequest["stageSources"];
  readonly priorGridText: (path: string) => string | null;
}

export const filesystemWorkflowSourceReader: WorkflowSourceReader = {
  stageSources: (stagesDirectory) => readdirSync(stagesDirectory).sort().flatMap((phase) => {
    const directory = join(stagesDirectory, phase);
    if (!statSync(directory).isDirectory()) return [];
    return readdirSync(directory).filter((name) => name.endsWith(".md")).sort().map((filename) => {
      const path = join(directory, filename);
      return { path, phase, text: readFileSync(path, "utf-8") };
    });
  }),
  priorGridText: (path) => existsSync(path) ? readFileSync(path, "utf-8") : null,
};
