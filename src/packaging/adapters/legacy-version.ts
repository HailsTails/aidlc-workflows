import { AIDLC_VERSION } from "../../../core/tools/aidlc-version.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";

const assignment = /^export const AIDLC_VERSION = "[^"]+";$/m;

export const buildVersionNotice = (version: string): string | null => version === AIDLC_VERSION ? null
  : `[version] stamping projections with AIDLC_BUILD_VERSION=${version}\n`;

export const createVersionStamp = (version: Result<string, PackagingRefusal>) => (module: FileContent): Result<FileContent, PackagingRefusal> => {
  if (!version.ok) return version;
  if (version.value === AIDLC_VERSION) return accepted(module);
  const text = module.kind === "text" ? module.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(module.bytes);
  const matches = text.match(new RegExp(assignment.source, "gm")) ?? [];
  if (matches.length !== 1) return refused({
    kind: "version-unstampable",
    reason: `aidlc-version.ts must declare exactly one AIDLC_VERSION assignment, found ${matches.length}`,
  });
  return accepted({ kind: "text", text: text.replace(assignment,
    `export const AIDLC_VERSION = "${version.value}";`) });
};
