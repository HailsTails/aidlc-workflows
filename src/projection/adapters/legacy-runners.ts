import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { z } from "zod";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { CommandSource } from "../application/ports.ts";
import { ENTRY_SHORTCUTS, nativeCommandName, commandFilePath, type NativeCommandFile,
  type CommandReading, type CommandSubject, type EntryShortcut } from "../domain/native-command.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { scopeName, stageSlug } from "../../workflow-definition/domain/identities.ts";
import { METHOD_SOURCE_FOLDERS, type MethodSource } from "../../workflow-definition/domain/method-source.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

const frozenStageSchema = z.object({ slug: z.string() }).passthrough();
const frozenScopesSchema = z.record(z.string(), z.object({ description: z.string() }).passthrough());
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
  readonly projectRoot: string; readonly temporaryRoot: string;
  readonly harnessDir: string; readonly harnessName: string };
const subjectSchema = z.object({ concept: z.enum(["stage-command", "scope-command", "orchestrator-skill"]), name: z.string() });
const fileSchema = z.object({ nativeName: z.string(), within: z.string(), text: z.string(), mode: z.literal("regular") });
const entrySchema = z.object({ subject: subjectSchema, files: z.array(fileSchema).nullable(), reason: z.string().nullable() });
const replySchema = z.object({ entries: z.array(entrySchema), failure: z.string().nullable() });
const childSchema = z.object({ module: z.string(), output: z.string(), stages: z.array(z.string()), scopes: z.array(z.string()) });
type WireSubject = z.infer<typeof subjectSchema>;
type WireEntry = z.infer<typeof entrySchema>;
type ChildCommand = { readonly subject: WireSubject; readonly markdown: string | null;
  readonly nativeName: string | null; readonly reason: string | null };
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
const failure = (subject: CommandSubject, reason: string): ProjectionRefusal => ({ kind: "render-failed", ...subject, reason });
const failedSource = (reason: string): CommandSource => ({ read: (subject) => refused(failure(subject, reason)) });
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
  return within.ok ? accepted({ name: name.value, within: within.value, mode: file.mode,
    content: { kind: "text", text: file.text } })
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
  const selected = new Set(generator.defaultScopeBatch(discovered));
  const shortcuts: Record<EntryShortcut, () => string> = {
    "aidlc-init": () => generator.renderInitRunner(),
    "aidlc-compose": () => generator.renderComposeRunner(),
  };
  return [
    ...input.stages.map((name) => renderedCommand({ concept: "stage-command", name }, () => {
      const node = runnable.find((stage) => stage.slug === name);
      return node ? generator.renderStageRunner(node) : null;
    })),
    ...input.scopes.map((name) => renderedCommand({ concept: "scope-command", name }, () => {
      if (!selected.has(name)) return null;
      const scope = discovered[name];
      if (!scope) throw new Error(`The selected frozen scope is absent: ${name}`);
      return generator.renderRunner(name, scope.description);
    })),
    ...ENTRY_SHORTCUTS.map((name) => renderedCommand({ concept: "orchestrator-skill", name }, shortcuts[name])),
  ];
};
const walk = (directory: string): readonly string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]).sort();
const commandDocuments = (command: ChildCommand, paths: readonly string[]): WireEntry => {
  if (command.markdown === null || command.nativeName === null) return { subject: command.subject, files: null, reason: command.reason };
  const skillPaths = paths.filter((path) => basename(path) === "SKILL.md" && basename(dirname(path)) === command.nativeName);
  const skill = skillPaths[0];
  if (skillPaths.length !== 1 || !skill) return { subject: command.subject, files: null,
    reason: "The frozen output must contain exactly one directory for this native name." };
  const directory = dirname(skill);
  return { subject: command.subject, reason: null, files: [
    { nativeName: command.nativeName, within: "SKILL.md", text: command.markdown, mode: "regular" },
    ...paths.filter((path) => path !== skill && relative(directory, path).split(/[\\/]/)[0] !== "..")
      .map((path) => ({ nativeName: command.nativeName ?? "", within: relative(directory, path).replaceAll("\\", "/"),
        text: readFileSync(path, "utf8"), mode: "regular" as const })),
  ] };
};
export const duplicateNativeCommand = (commands: readonly ChildCommand[]): WireEntry | null => {
  const collision = commands.find((command, index) => command.nativeName !== null
    && commands.findIndex((other) => other.nativeName === command.nativeName) < index);
  return collision ? { subject: collision.subject, files: null,
    reason: `Two frozen commands share the native destination: ${collision.nativeName}` } : null;
};
const runChild = async (raw: unknown): Promise<z.infer<typeof replySchema>> => {
  const input = childSchema.parse(raw);
  const generator = generatorSchema.parse(await import(Bun.pathToFileURL(input.module).href));
  const commands = renderFrozenCommands(generator, input);
  const collision = duplicateNativeCommand(commands);
  if (collision) return { failure: null, entries: [collision] };
  const broken = commands.find((command) => command.reason !== null);
  if (broken) return { failure: null, entries: [{ subject: broken.subject, files: null, reason: broken.reason }] };
  generator.regenerateRunnerSurfaces();
  const paths = walk(input.output);
  return { failure: null, entries: commands.map((command) => commandDocuments(command, paths)) };
};

const captureScopes = (request: LegacyRunnerRequest): Result<readonly MethodSource[], ProjectionRefusal> => {
  const captured = request.method.scopes.map((scope): Result<MethodSource, ProjectionRefusal> => {
    const source = request.sources.find((candidate) => candidate.path === scope.source
      && candidate.owner.kind === scope.owner.kind && (candidate.owner.kind !== "plugin"
        || (scope.owner.kind === "plugin" && candidate.owner.plugin === scope.owner.plugin)));
    return source && source.path.startsWith(`${METHOD_SOURCE_FOLDERS.scope}/`) ? accepted(source)
      : refused(failure({ concept: "scope-command", name: scope.name }, "The accepted scope source was not captured."));
  });
  const broken = captured.find((entry) => !entry.ok);
  return broken && !broken.ok ? broken : accepted(captured.flatMap((entry) => entry.ok ? [entry.value] : []));
};
const executeFrame = (request: LegacyRunnerRequest, frame: { readonly scratch: string;
  readonly scopes: readonly MethodSource[] }): CommandSource => {
  const scopeRoot = join(frame.scratch, "sources");
  const output = join(frame.scratch, "output");
  mkdirSync(scopeRoot);
  mkdirSync(output);
  frame.scopes.forEach((source) => {
    const destination = join(scopeRoot, source.path.slice(METHOD_SOURCE_FOLDERS.scope.length + 1));
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, source.content.kind === "text" ? source.content.text : source.content.bytes);
  });
  const tree = join(request.projectRoot, request.harnessDir);
  const reply = spawnSync(process.execPath, ["--no-install", Bun.fileURLToPath(import.meta.url), "--runner-child"], {
    cwd: output, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    env: Object.fromEntries([
      ["PATH", dirname(process.execPath)], ["TEMP", frame.scratch], ["TMP", frame.scratch],
      ["AIDLC_SRC", tree], ["AIDLC_HARNESS_DIR", request.harnessDir], ["AIDLC_HARNESS_NAME", request.harnessName],
      ["AIDLC_RUNTIME_PROJECT_DIR", output], ["AIDLC_PROJECT_DIR", output], ["AIDLC_SCOPES_DIR", scopeRoot],
      ["AIDLC_STAGE_GRAPH", join(tree, "tools/data/stage-graph.json")], ["AIDLC_SCOPE_GRID", join(tree, "tools/data/scope-grid.json")],
    ]),
    input: JSON.stringify({ module: join(tree, "tools/aidlc-runner-gen.ts"), output,
      stages: request.method.graph.nodes.map((node) => node.stage), scopes: request.method.scopes.map((scope) => scope.name) }),
  });
  return decodeLegacyRunners({ status: reply.status, stdout: reply.stdout ?? "", stderr: reply.stderr ?? reply.error?.message ?? "" });
};
export const prepareLegacyRunners = (request: LegacyRunnerRequest): CommandSource => {
  const scopes = captureScopes(request);
  if (!scopes.ok) return { read: () => refused(scopes.refusal) };
  let scratch: string | null = null;
  let source: CommandSource;
  try {
    mkdirSync(request.temporaryRoot, { recursive: true });
    scratch = mkdtempSync(join(request.temporaryRoot, "runner-"));
    source = executeFrame(request, { scratch, scopes: scopes.value });
  } catch (error) {
    source = failedSource(message(error));
  }
  if (scratch !== null) {
    try { rmSync(scratch, { recursive: true, force: true }); }
    catch (error) { source = failedSource(`The private runner frame could not be removed: ${message(error)}`); }
  }
  return source;
};

if (import.meta.main && process.argv[2] === "--runner-child") {
  try { process.stdout.write(JSON.stringify(await runChild(await Bun.stdin.json()))); }
  catch (error) { process.stdout.write(JSON.stringify({ entries: [], failure: message(error) })); }
}
