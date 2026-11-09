import { captureCommandScopes, duplicateNativeCommand, selectedScopeDescription, selectLegacyDocuments }
  from "../application/legacy-command-plan.ts";
import { asFolder, type FileWriteError } from "../../kernel/file-system-port.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { CommandSource, LegacyRunnerProcess, LegacyRunnerScratch } from "../application/ports.ts";
import { ENTRY_SHORTCUTS, nativeCommandName, commandFilePath, type NativeCommandFile,
  type CommandReading, type CommandSubject, type EntryShortcut } from "../domain/native-command.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { scopeName, stageSlug } from "../../workflow-definition/domain/identities.ts";
import { METHOD_SOURCE_FOLDERS, type MethodSource } from "../../workflow-definition/domain/method-source.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

const frozenStageSchema = z.looseObject({ slug: z.string() });
const frozenScopesSchema = z.record(z.string(), z.looseObject({ description: z.string() }));
const generatorSchema = z.object({
  runnableStages: z.function({ input: [], output: z.array(frozenStageSchema) }),
  discoverScopes: z.function({ input: [], output: frozenScopesSchema }),
  defaultScopeBatch: z.function({ input: [frozenScopesSchema], output: z.array(z.string()) }),
  renderStageRunner: z.function({ input: [frozenStageSchema], output: z.string() }),
  renderRunner: z.function({ input: [z.string(), z.string()], output: z.string() }),
  renderInitRunner: z.function({ input: [], output: z.string() }),
  renderComposeRunner: z.function({ input: [], output: z.string() }),
  regenerateRunnerSurfaces: z.function({ input: [], output: z.void() }),
});
type Generator = z.infer<typeof generatorSchema>;
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
const childSchema = z.object({ module: z.string(), output: z.string(), stages: z.array(z.string()), scopes: z.array(z.string()) });
type WireSubject = z.infer<typeof subjectSchema>;
type WireEntry = z.infer<typeof entrySchema>;
type ChildCommand = { readonly subject: WireSubject; readonly markdown: string | null;
  readonly nativeName: string | null; readonly reason: string | null };
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
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

const renderedCommand = (subject: WireSubject, render: () => string | null): ChildCommand => {
  try {
    const markdown = render();
    const nativeName = markdown === null ? null : /^name: +([^\r\n]+)$/m.exec(markdown)?.[1];
    return markdown === null || nativeName ? { subject, markdown, nativeName: nativeName ?? null, reason: null }
      : { subject, markdown: null, nativeName: null, reason: "The frozen command has no native name." };
  } catch (error) {
    return { subject, markdown: null, nativeName: null, reason: message(error) };
  }
};
const renderFrozenCommands = (generator: Generator, input: z.infer<typeof childSchema>): readonly ChildCommand[] => {
  const runnable = generator.runnableStages();
  const discovered = generator.discoverScopes();
  const selected = generator.defaultScopeBatch(discovered);
  const shortcuts: Record<EntryShortcut, () => string> = {
    "aidlc-init": () => generator.renderInitRunner(),
    "aidlc-compose": () => generator.renderComposeRunner(),
  };
  return [
    ...input.stages.map((name) => renderedCommand({ concept: "stage-command", name }, () => {
      const node = runnable.find((stage) => stage.slug === name);
      return node ? generator.renderStageRunner(node) : null;
    })),
    ...input.scopes.map((name): ChildCommand => {
      const subject: WireSubject = { concept: "scope-command", name };
      const selection = selectedScopeDescription({ name, selected, scopes: discovered });
      if (!selection.ok) return { subject, markdown: null, nativeName: null, reason: selection.refusal };
      return renderedCommand(subject, () => selection.value === null ? null
        : generator.renderRunner(name, selection.value));
    }),
    ...ENTRY_SHORTCUTS.map((name) => renderedCommand({ concept: "orchestrator-skill", name }, shortcuts[name])),
  ];
};
const walk = (directory: string): readonly string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]).sort();
const commandDocuments = (command: ChildCommand, paths: readonly string[]): WireEntry => {
  const nativeName = command.nativeName;
  if (command.markdown === null || nativeName === null) return { subject: command.subject, files: null, reason: command.reason };
  const selected = selectLegacyDocuments({ nativeName, paths });
  if (!selected.ok) return { subject: command.subject, files: null, reason: selected.refusal };
  return { subject: command.subject, reason: null, files: [
    { nativeName, within: "SKILL.md", content: { kind: "text", text: command.markdown }, mode: "regular" },
    ...selected.value.companions.map(({ path, within }): z.infer<typeof fileSchema> => ({
      nativeName, within, content: { kind: "bytes", bytes: Array.from(readFileSync(path)) }, mode: "regular" })),
  ] };
};
export const runChildWithCapability = (input: z.infer<typeof childSchema>, capability: unknown):
  z.infer<typeof replySchema> => {
  const admitted = generatorSchema.safeParse(capability);
  if (!admitted.success) return { entries: [], failure: "The frozen runner capability API is invalid." };
  const generator = admitted.data;
  const commands = renderFrozenCommands(generator, input);
  const collision = duplicateNativeCommand(commands);
  if (collision) return { failure: null, entries: [collision] };
  const broken = commands.find((command) => command.reason !== null);
  if (broken) return { failure: null, entries: [{ subject: broken.subject, files: null, reason: broken.reason }] };
  generator.regenerateRunnerSurfaces();
  const paths = walk(input.output);
  return { failure: null, entries: commands.map((command) => commandDocuments(command, paths)) };
};

export const runChild = async (raw: unknown): Promise<z.infer<typeof replySchema>> => {
  const decoded = childSchema.safeParse(raw);
  if (!decoded.success) return { entries: [], failure: "The frozen runner request is invalid." };
  return runChildWithCapability(decoded.data, await import(Bun.pathToFileURL(decoded.data.module).href));
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
if (import.meta.main && process.argv[2] === "--runner-child") {
  try { process.stdout.write(JSON.stringify(await runChild(await Bun.stdin.json()))); }
  catch (error) { process.stdout.write(JSON.stringify({ entries: [], failure: message(error) })); }
}
