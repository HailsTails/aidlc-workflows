import { payloadTreeOrder } from "../domain/payload-files.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { ProjectedFile } from "../../projection/domain/projected-file.ts";
import type { NativeCommandRoutes } from "../../projection/domain/native-command.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { NativeRelease } from "../domain/payload.ts";
import { nativeBareToolPattern, nativeInvocationText } from "../domain/native-invocations.ts";
import { nativeOnboardingText } from "../domain/native-onboarding.ts";

type NativeLayoutRequest = {
  readonly files: readonly ProjectedFile[];
  readonly release: NativeRelease;
  readonly routes: NativeCommandRoutes;
  readonly host: HostIdentity;
};

const nativeFileTreatment = (file: ProjectedFile): "rewrite-text" | "preserve-content" =>
  /\.(?:md|mdc|json|toml|hook|ts)$/.test(file.path) ? "rewrite-text" : "preserve-content";
const textOf = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);

const replaceNativeBlock = (request: {
  readonly files: readonly ProjectedFile[]; readonly host: HostIdentity;
  readonly replacement: NativeRelease["replacements"][number];
}): Result<readonly ProjectedFile[], readonly PackagingRefusal[]> => {
  const found = request.files.some((file) => nativeFileTreatment(file) === "rewrite-text"
    && textOf(file.content).includes(request.replacement.from));
  if (!found) return refused([{ kind: "native-text-not-found", distribution: request.host.distribution,
    text: request.replacement.from }]);
  return accepted(request.files.map((file): ProjectedFile => nativeFileTreatment(file) === "rewrite-text"
    ? { ...file, content: { kind: "text", text: textOf(file.content)
      .replaceAll(request.replacement.from, request.replacement.to) } } : file));
};

const replaceNativeText = (request: NativeLayoutRequest): Result<readonly ProjectedFile[], readonly PackagingRefusal[]> =>
  request.release.replacements.reduce<Result<readonly ProjectedFile[], readonly PackagingRefusal[]>>(
    (reading, replacement) => reading.ok ? replaceNativeBlock({ files: reading.value, host: request.host, replacement }) : reading,
    accepted(request.files.filter((file) => !request.release.copyOnly.includes(file.path))),
  );

const nativeFailures = (file: ProjectedFile, request: NativeLayoutRequest): readonly PackagingRefusal[] => {
  if (nativeFileTreatment(file) === "preserve-content") return [];
  const text = textOf(file.content);
  const reasons = ["{{INVOKE}}", "{{TOOL_PREFIX}}", "{{OPTION_LETTERS}}"].filter((token) => text.includes(token))
    .map((token) => `unexpanded ${token}`);
  const directory = request.host.directory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(String.raw`\bbun\s+[^\n]*${directory}/(?:tools|hooks)/aidlc`).test(text)) {
    reasons.push("bun invocation survived native projection");
  }
  if (new RegExp(nativeBareToolPattern(request.routes).source, "i").test(text)) {
    reasons.push("bare bun invocation survived native projection");
  }
  if (/\baidlc\s+engine\s+(?:utility|runner-gen)\b/.test(text)) {
    reasons.push("retired engine alias survived native projection");
  }
  const checkedText = request.release.replacements.reduce((unmaskedText, replacement) =>
    unmaskedText.replaceAll(replacement.to, replacement.to.replace(/[^\n]/g, "")), text);
  reasons.push(...request.routes.unresolvable({ file: file.path, text: checkedText }));
  if (file.path.includes("/agents/") && /"allowedCommands"\s*:\s*\[[\s\S]*?"bun [^"]*tools\//.test(text)) {
    reasons.push("bun allowlist survived native projection");
  }
  return reasons.map((reason) => ({ kind: "native-leftover", path: file.path, reason }));
};

export const nativeLayoutFiles = (request: NativeLayoutRequest)
: Result<readonly ProjectedFile[], readonly PackagingRefusal[]> => {
  const replaced = replaceNativeText(request);
  if (!replaced.ok) return replaced;
  const files = replaced.value.map((file): ProjectedFile => nativeFileTreatment(file) === "rewrite-text" ? { ...file, content: { kind: "text",
    text: nativeOnboardingText({ text: nativeInvocationText({ text: textOf(file.content),
      host: request.host, routes: request.routes }), permissionsLine: request.release.permissionsLine,
    prefix: request.routes.prefix }),
  } } : file);
  const failures = files.toSorted(payloadTreeOrder).flatMap((file) => nativeFailures(file, request));
  return failures.length > 0 ? refused(failures) : accepted(files);
};
