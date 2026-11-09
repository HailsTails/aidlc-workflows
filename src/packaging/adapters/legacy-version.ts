import { AIDLC_VERSION } from "../../../core/tools/aidlc-version.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { ProjectionRefusal } from "../../projection/domain/projection.ts";

const assignment = /^export const AIDLC_VERSION = "[^"]+";$/m;

export const createVersionStamp = (version: Result<string, ProjectionRefusal>) => (module: FileContent): Result<FileContent, ProjectionRefusal> => {
  if (!version.ok) return version;
  if (version.value === AIDLC_VERSION) return accepted(module);
  const text = module.kind === "text" ? module.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(module.bytes);
  const matches = text.match(new RegExp(assignment.source, "gm")) ?? [];
  if (matches.length !== 1) return refused({
    kind: "render-failed", concept: "host-data", name: "aidlc-version.ts",
    reason: `aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found ${matches.length}`,
  });
  return accepted({ kind: "text", text: text.replace(assignment,
    `export const AIDLC_VERSION = "${version.value}";`) });
};
