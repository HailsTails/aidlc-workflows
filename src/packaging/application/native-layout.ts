import { payloadTreeOrder } from "../domain/payload-files.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { FileContent } from "../../kernel/file-content.ts";
import type { ProjectedFile } from "../../projection/domain/projected-file.ts";
import type { NativeCommandRoutes } from "../../projection/domain/native-command.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { NativeRelease } from "../domain/payload.ts";
import { nativeBareToolPattern } from "../domain/native-invocations.ts";
import { nativePolicyObligation } from "../../projection/domain/native-policy.ts";
import { compiledLegacyNativeFile, legacyNativeProgram, legacyNativeTextPath } from "../../projection/domain/legacy-native-source.ts";

type NativeLayoutRequest = {
  readonly files: readonly ProjectedFile[];
  readonly release: NativeRelease;
  readonly routes: NativeCommandRoutes;
  readonly host: HostIdentity;
};

const nativeFileTreatment = (file: ProjectedFile): "consume-source" | "preserve-content" =>
  legacyNativeTextPath(file.path) ? "consume-source" : "preserve-content";
const textOf = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);

const admitNativeBlock = (request: {
  readonly files: readonly ProjectedFile[]; readonly host: HostIdentity;
  readonly replacement: NativeRelease["replacements"][number];
  readonly completed: ReadonlySet<string>;
  readonly replacements: NativeRelease["replacements"];
  readonly stage: number;
}): Result<readonly ProjectedFile[], readonly PackagingRefusal[]> => {
  const found = request.files.some((file) => nativeFileTreatment(file) === "consume-source"
    && (legacyNativeProgram(file, request.replacements)?.replacements[request.stage]?.found ?? false));
  if (!found && !request.completed.has(request.replacement.from)) return refused([{ kind: "native-text-not-found", distribution: request.host.distribution,
    text: request.replacement.from }]);
  return accepted(request.files);
};

const admitNativeSources = (request: NativeLayoutRequest): Result<readonly ProjectedFile[], readonly PackagingRefusal[]> => {
  const files = request.files.filter((file) => !request.release.copyOnly.includes(file.path));
  const completed = new Set(files.flatMap((file) => {
    if (nativeFileTreatment(file) !== "consume-source") return [];
    const obligation = nativePolicyObligation(file);
    return obligation === undefined ? [] : [obligation];
  }));
  return request.release.replacements.reduce<Result<readonly ProjectedFile[], readonly PackagingRefusal[]>>(
    (reading, replacement, stage) => reading.ok ? admitNativeBlock({ files: reading.value, host: request.host,
      replacement, completed, replacements: request.release.replacements, stage }) : reading,
    accepted(files.map((file) => file.origin.kind === "native-policy" ? { ...file, origin: file.origin.source } : file)),
  );
};

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
  const admitted = admitNativeSources(request);
  if (!admitted.ok) return admitted;
  const files = admitted.value.map((source): ProjectedFile => {
    const compiled = nativeFileTreatment(source) === "consume-source"
      ? compiledLegacyNativeFile(source, request.release.replacements) : undefined;
    if (compiled !== undefined) return compiled;
    const { nativeAuthoring: _program, ...file } = source;
    return nativeFileTreatment(file) === "consume-source" ? { ...file, content: { kind: "text",
    text: textOf(file.content),
  } } : file;
  });
  const failures = files.toSorted(payloadTreeOrder).flatMap((file) => nativeFailures(file, request));
  return failures.length > 0 ? refused(failures) : accepted(files);
};
