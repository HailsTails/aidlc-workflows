import { z } from "zod";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../core/platform-ports/path-port.ts";
import type { ProcessPort } from "../core/platform-ports/process-port.ts";
import { parsedJson } from "../core/rule-set-reader/rule-set-reader.ts";
import type { Result } from "../core/values/result.ts";

export type InstallManifestFailure = { readonly kind: "manifest-invalid"; readonly detail: string };

export type InstallManifestWriteFailure =
  | InstallManifestFailure
  | { readonly kind: "not-a-file-url"; readonly url: string; readonly detail: string }
  | { readonly kind: "unreadable" | "unwritable"; readonly path: string; readonly detail: string };

const DEVELOPMENT_MANIFEST = "package.json";

const INSTALL_FOLDER = "install";

const versionsSchema = z.record(z.string(), z.string());

const installedSectionsSchema = z.object({
  version: z.string(),
  private: z.literal(true),
  type: z.literal("module"),
  description: z.string(),
  license: z.string(),
  engines: versionsSchema,
  dependencies: versionsSchema,
  peerDependencies: versionsSchema,
  peerDependenciesMeta: z.record(z.string(), z.object({ optional: z.boolean() })),
});

export const installManifestOf = (request: {
  readonly developmentManifest: string;
}): Result<string, InstallManifestFailure> => {
  const parsed = parsedJson({ text: request.developmentManifest });
  if (parsed.outcome === "failed") {
    return { outcome: "failed", error: { kind: "manifest-invalid", detail: parsed.error } };
  }
  const installed = installedSectionsSchema.safeParse(parsed.value);
  return installed.success
    ? { outcome: "ok", value: `${JSON.stringify(installed.data, null, 2)}\n` }
    : { outcome: "failed", error: { kind: "manifest-invalid", detail: installed.error.message } };
};

export const writtenInstallManifest = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly packageRoot: string;
}): Result<string, InstallManifestWriteFailure> => {
  const developmentManifest = request.fileText.read({ path: request.path.join({ segments: [request.packageRoot, DEVELOPMENT_MANIFEST] }) });
  if (developmentManifest.outcome === "failed") {
    return developmentManifest;
  }
  const installManifest = installManifestOf({ developmentManifest: developmentManifest.value });
  if (installManifest.outcome === "failed") {
    return installManifest;
  }
  const target = request.path.join({ segments: [request.packageRoot, INSTALL_FOLDER, DEVELOPMENT_MANIFEST] });
  const written = request.fileText.write({ path: target, text: installManifest.value });
  return written.outcome === "failed" ? written : { outcome: "ok", value: target };
};

const writtenFromScript = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly moduleUrl: string;
}): Result<string, InstallManifestWriteFailure> => {
  const scriptPath = request.path.fromFileUrl({ url: request.moduleUrl });
  return scriptPath.outcome === "failed"
    ? scriptPath
    : writtenInstallManifest({
        fileText: request.fileText,
        path: request.path,
        packageRoot: request.path.directoryOf({ path: request.path.directoryOf({ path: scriptPath.value }) }),
      });
};

export const runWriteInstallManifest = (request: {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly moduleUrl: string;
}): void => {
  const written = writtenFromScript(request);
  if (written.outcome === "failed") {
    request.process.writeOut({ text: `install manifest: ${JSON.stringify(written.error)}\n` });
    request.process.exitWith({ code: 1 });
    return;
  }
  request.process.writeOut({ text: `install manifest: wrote ${written.value}\n` });
  request.process.exitWith({ code: 0 });
};
