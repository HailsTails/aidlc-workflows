import { z } from "zod";
import type { RunnerFailure } from "../../../core/mechanism-port/runner-failure.ts";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../../core/platform-ports/path-port.ts";
import { parsedJson } from "../../../core/rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../../../core/values/absolute-path.ts";
import { BUILT_MODULE_EXTENSION, type ModuleExtension } from "../../../core/values/install-layout.ts";
import type { Result } from "../../../core/values/result.ts";

export type CoreInstall =
  | { readonly form: "folder" }
  | { readonly form: "package"; readonly root: string; readonly name: string };

const INSTALL_MANIFEST = "package.json";

const FOLDER_INSTALL: CoreInstall = { form: "folder" };

const namedManifestSchema = z.object({ name: z.string() });

const manifestFailure = (request: { readonly manifest: string; readonly problem: string }): Result<never, RunnerFailure> => ({
  outcome: "failed",
  error: { kind: "tool-failed", detail: `the core install's ${request.manifest} ${request.problem}` },
});

const installNamedIn = (request: {
  readonly installRoot: AbsolutePath;
  readonly manifest: string;
  readonly text: string;
}): Result<CoreInstall, RunnerFailure> => {
  const document = parsedJson({ text: request.text });
  if (document.outcome === "failed") {
    return manifestFailure({ manifest: request.manifest, problem: `is not JSON: ${document.error}` });
  }
  const named = namedManifestSchema.safeParse(document.value);
  return {
    outcome: "ok",
    value: named.success ? { form: "package", root: request.installRoot, name: named.data.name } : FOLDER_INSTALL,
  };
};

export const coreInstallOf = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
}): Result<CoreInstall, RunnerFailure> => {
  if (request.moduleExtension !== BUILT_MODULE_EXTENSION) {
    return { outcome: "ok", value: FOLDER_INSTALL };
  }
  const manifest = request.path.join({ segments: [request.installRoot, INSTALL_MANIFEST] });
  if (request.fileText.exists({ path: manifest }) === "absent") {
    return { outcome: "ok", value: FOLDER_INSTALL };
  }
  const text = request.fileText.read({ path: manifest });
  if (text.outcome === "failed") {
    return manifestFailure({ manifest, problem: `cannot be read: ${text.error.detail}` });
  }
  return installNamedIn({ installRoot: request.installRoot, manifest, text: text.value });
};
