import { captureCommandScopes }
  from "../application/legacy-command-plan.ts";
import { asFolder, type FileWriteError } from "../../kernel/file-system-port.ts";
import { z } from "zod";
import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { CommandSource, LegacyRunnerProcess, LegacyRunnerScratch } from "../application/ports.ts";
import { ENTRY_SHORTCUTS, nativeCommandName, commandFilePath, type NativeCommandFile,
  type CommandReading, type CommandSubject } from "../domain/native-command.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { scopeName, stageSlug } from "../../workflow-definition/domain/identities.ts";
import { METHOD_SOURCE_FOLDERS, type MethodSource } from "../../workflow-definition/domain/method-source.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

export type LegacyRunnerReply = { readonly status: number | null; readonly stdout: string; readonly stderr: string };
export type LegacyRunnerRequest = { readonly method: Method; readonly sources: readonly MethodSource[];
  readonly projectRoot: URL; readonly temporaryRoot: URL;
  readonly harnessDir: string; readonly harnessName: string };
const subjectSchema = z.object({ concept: z.enum(["stage-command", "scope-command", "orchestrator-skill"]), name: z.string() });
const contentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("bytes"), bytes: z.array(z.number().int().min(0).max(255)) }),
]);
const fileSchema = z.object({ nativeName: z.string(), within: z.string(), content: contentSchema, mode: z.literal("regular") });
const entrySchema = z.object({ subject: subjectSchema, files: z.array(fileSchema).nullable(), reason: z.string().nullable() });
const replySchema = z.object({ entries: z.array(entrySchema), failure: z.string().nullable() });
type WireSubject = z.infer<typeof subjectSchema>;
const failure = (subject: CommandSubject, reason: string): ProjectionRefusal => ({ kind: "render-failed", ...subject, reason });
const failedSource = (reason: string): CommandSource => ({
  read: () => refused({ kind: "command-source-failed", reason }),
});
const subjectFrom = (raw: WireSubject): CommandSubject | null => {
  if (raw.concept === "stage-command") {
    const name = stageSlug(raw.name);
    return name.ok ? { concept: raw.concept, name: name.value } : null;
  }
  if (raw.concept === "scope-command") {
    const name = scopeName(raw.name);
    return name.ok ? { concept: raw.concept, name: name.value } : null;
  }
  const shortcut = ENTRY_SHORTCUTS.find((name) => name === raw.name);
  return shortcut ? { concept: raw.concept, name: shortcut } : null;
};

const admitFile = (subject: CommandSubject, file: z.infer<typeof fileSchema>):
  Result<NativeCommandFile, ProjectionRefusal> => {
  const name = nativeCommandName(file.nativeName);
  if (!name.ok) return refused(failure(subject, "The frozen native name must be one portable path segment."));
  const within = commandFilePath(file.within);
  const content: FileContent = file.content.kind === "text" ? file.content
    : { kind: "bytes", bytes: new Uint8Array(file.content.bytes) };
  return within.ok ? accepted({ name: name.value, within: within.value, mode: file.mode, content })
    : refused(failure(subject, "The frozen companion path must be a portable relative path."));
};
const admitReading = (subject: CommandSubject, documents: z.infer<typeof entrySchema>["files"]):
  Result<CommandReading, ProjectionRefusal> => {
  if (documents === null) return accepted({ kind: "declined" });
  const admitted = documents.map((file) => admitFile(subject, file));
  const broken = admitted.find((entry) => !entry.ok);
  if (broken && !broken.ok) return broken;
  const files = admitted.flatMap((entry) => entry.ok ? [entry.value] : []);
  const [first, ...remaining] = files;
  return first ? accepted({ kind: "rendered", files: [first, ...remaining] })
    : refused(failure(subject, "A rendered command must contain at least one file."));
};

export const decodeLegacyRunners = (reply: LegacyRunnerReply): CommandSource => {
  if (reply.status !== 0) return failedSource(reply.stderr || "The frozen runner formatter failed.");
  try {
    const decoded = replySchema.safeParse(JSON.parse(reply.stdout));
    if (!decoded.success) return failedSource("The frozen runner formatter returned invalid documents.");
    if (decoded.data.failure !== null) return failedSource(decoded.data.failure);
    const broken = decoded.data.entries.find((entry) => entry.reason !== null);
    const subject = broken ? subjectFrom(broken.subject) : null;
    if (broken && subject && broken.reason !== null) {
      const refusal = failure(subject, broken.reason);
      return { read: () => refused(refusal) };
    }
    return { read: (requested) => {
      const matches = decoded.data.entries.filter((entry) => entry.subject.concept === requested.concept
        && entry.subject.name === requested.name);
      const entry = matches[0];
      if (matches.length !== 1 || !entry) return refused(failure(requested,
        "The frozen runner response must contain exactly one entry for this subject."));
      if (entry.reason !== null) return refused(failure(requested, entry.reason));
      return admitReading(requested, entry.files);
    } };
  } catch {
    return failedSource("The frozen runner formatter returned invalid JSON.");
  }
};

type RunnerPorts = {
  readonly scratch: LegacyRunnerScratch;
  readonly processRunner: LegacyRunnerProcess;
  readonly child: URL;
};

const location = (root: URL, within: string): URL =>
  new URL(within.split("/").map(encodeURIComponent).join("/"), asFolder(root));
const pathArgument = (url: URL) => ({ kind: "path" as const, location: url });

const executeFrame = async (request: LegacyRunnerRequest, frame: {
  readonly scratch: URL;
  readonly scopes: readonly MethodSource[];
  readonly ports: RunnerPorts;
}): Promise<CommandSource> => {
  const scopeRoot = new URL("sources/", asFolder(frame.scratch));
  const output = new URL("output/", asFolder(frame.scratch));
  const folders = await [scopeRoot, output].reduce<Promise<Result<URL, FileWriteError>>>(
    async (previous, folder) => {
      const prepared = await previous;
      return prepared.ok ? frame.ports.scratch.makeFolder({ folder }) : prepared;
    }, Promise.resolve(accepted(frame.scratch)));
  if (!folders.ok) return failedSource(folders.refusal.code);
  const scopes = await frame.scopes.reduce<Promise<Result<URL, FileWriteError>>>(async (previous, source) => {
    const prepared = await previous;
    if (!prepared.ok) return prepared;
    const file = location(scopeRoot, source.path.slice(METHOD_SOURCE_FOLDERS.scope.length + 1));
    const made = await frame.ports.scratch.makeFolder({ folder: new URL(".", file) });
    return made.ok ? frame.ports.scratch.writeFile({ file, content: source.content }) : made;
  }, Promise.resolve(accepted(scopeRoot)));
  if (!scopes.ok) return failedSource(scopes.refusal.code);
  const tree = location(request.projectRoot, request.harnessDir);
  const reply = await frame.ports.processRunner.runCurrentRuntime({
    argv: ["--no-install", pathArgument(frame.ports.child), "--runner-child"], cwd: output,
    env: {
      ["PATH"]: { kind: "runtime-folder" }, ["TEMP"]: pathArgument(frame.scratch),
      ["TMP"]: pathArgument(frame.scratch), ["TMPDIR"]: pathArgument(frame.scratch),
      ["AIDLC_SRC"]: pathArgument(tree), ["AIDLC_HARNESS_DIR"]: request.harnessDir,
      ["AIDLC_HARNESS_NAME"]: request.harnessName,
      ["AIDLC_RUNTIME_PROJECT_DIR"]: pathArgument(output), ["AIDLC_PROJECT_DIR"]: pathArgument(output),
      ["AIDLC_SCOPES_DIR"]: pathArgument(scopeRoot),
      ["AIDLC_STAGE_GRAPH"]: pathArgument(location(tree, "tools/data/stage-graph.json")),
      ["AIDLC_SCOPE_GRID"]: pathArgument(location(tree, "tools/data/scope-grid.json")),
    },
    input: JSON.stringify({ module: location(tree, "tools/aidlc-runner-gen.ts").href, output: output.href,
      stages: request.method.graph.nodes.map((node) => node.stage),
      scopes: request.method.scopes.map((scope) => scope.name) }),
  });
  if (!reply.ok) return failedSource(reply.refusal.reason);
  return decodeLegacyRunners({ status: reply.value.exit.kind === "exited" ? reply.value.exit.code : null,
    stdout: reply.value.stdout, stderr: reply.value.stderr });
};

export const prepareLegacyRunners = async (request: LegacyRunnerRequest,
  ports: RunnerPorts): Promise<CommandSource> => {
  const scopes = captureCommandScopes(request);
  if (!scopes.ok) return { read: () => refused(scopes.refusal) };
  const parent = await ports.scratch.makeFolder({ folder: request.temporaryRoot });
  if (!parent.ok) return failedSource(parent.refusal.code);
  const frame = await ports.scratch.makeScratchFolder({ parent: request.temporaryRoot });
  if (!frame.ok) return failedSource(frame.refusal.code);
  const source = await executeFrame(request, { scratch: frame.value, scopes: scopes.value, ports });
  const removed = await ports.scratch.removeFolder({ folder: frame.value });
  return removed.ok ? source : failedSource(`The private runner frame could not be removed: ${removed.refusal.code}`);
};
