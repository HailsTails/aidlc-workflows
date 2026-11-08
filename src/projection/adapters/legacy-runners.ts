import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { FileContent, FileMode } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { METHOD_SOURCE_FOLDERS, type MethodSource } from
  "../../workflow-definition/domain/method-source.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

export type LegacyCommandFile = { readonly nativeName: string; readonly within: string;
  readonly content: FileContent; readonly mode: FileMode };
export type LegacyRunners = {
  readonly stages: Readonly<Record<string, readonly LegacyCommandFile[] | null>>;
  readonly scopes: Readonly<Record<string, readonly LegacyCommandFile[] | null>>;
  readonly workflow: readonly LegacyCommandFile[];
};
export type LegacyRunnerReply = {
  readonly status: number | null; readonly stdout: string; readonly stderr: string;
};
export type LegacyRunnerRequest = {
  readonly method: Method; readonly sources: readonly MethodSource[];
  readonly projectRoot: string; readonly harnessDir: string; readonly harnessName: string;
};

const commandFileSchema = z.object({ nativeName: z.string(), within: z.string(), text: z.string(),
  mode: z.enum(["regular", "executable"]) });
const replySchema = z.object({
  stages: z.record(z.string(), z.array(commandFileSchema).nullable()),
  scopes: z.record(z.string(), z.array(commandFileSchema).nullable()),
  workflow: z.array(commandFileSchema),
});
type WireFile = z.infer<typeof commandFileSchema>;
const files = (documents: readonly WireFile[]): readonly LegacyCommandFile[] =>
  documents.map((document) => ({ nativeName: document.nativeName, within: document.within,
    mode: document.mode, content: { kind: "text", text: document.text } }));
const table = (commands: Readonly<Record<string, readonly WireFile[] | null>>):
  Readonly<Record<string, readonly LegacyCommandFile[] | null>> =>
  Object.fromEntries(Object.entries(commands).map(([name, documents]) =>
    [name, documents === null ? null : files(documents)]));
const unavailable = (reason: string) => refused<ProjectionRefusal>({
  kind: "render-failed", concept: "stage-command", name: "runner-context", reason,
});

export const decodeLegacyRunners = (reply: LegacyRunnerReply):
  Result<LegacyRunners, ProjectionRefusal> => {
  if (reply.status !== 0) return unavailable(reply.stderr || "The frozen runner formatter failed.");
  try {
    const decoded = replySchema.safeParse(JSON.parse(reply.stdout));
    if (!decoded.success) return unavailable("The frozen runner formatter returned invalid documents.");
    return accepted({ stages: table(decoded.data.stages), scopes: table(decoded.data.scopes),
      workflow: files(decoded.data.workflow) });
  } catch {
    return unavailable("The frozen runner formatter returned invalid JSON.");
  }
};

const program = String.raw`
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
const input = await Bun.stdin.json();
const generator = await import(Bun.pathToFileURL(input.module).href);
generator.regenerateRunnerSurfaces();
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
}).sort();
const outputFiles = walk(input.output);
const directories = new Map(outputFiles.filter(path => path.endsWith("/SKILL.md")
  || path.endsWith("\\SKILL.md")).map(path => {
  const markdown = readFileSync(path, "utf8");
  const name = /^name: +([^\r\n]+)$/m.exec(markdown)?.[1];
  if (!name) throw new Error("A generated runner has no native name");
  return [name, dirname(path)];
}));
const documents = markdown => {
  const nativeName = /^name: +([^\r\n]+)$/m.exec(markdown)?.[1];
  const directory = directories.get(nativeName);
  if (!directory) throw new Error("The frozen runner output is missing " + nativeName);
  return outputFiles.filter(path => path.startsWith(directory + "/")
    || path.startsWith(directory + "\\")).map(path => ({ nativeName,
      within: relative(directory, path).replaceAll("\\", "/"),
      text: readFileSync(path, "utf8"),
      mode: (statSync(path).mode & 0o111) === 0 ? "regular" : "executable" }));
};
const runnable = new Map(generator.runnableStages().map(stage => [stage.slug, stage]));
const discovered = generator.discoverScopes();
const scopes = new Set(generator.defaultScopeBatch(discovered));
process.stdout.write(JSON.stringify({
  stages: Object.fromEntries(input.stages.map(name => [name,
    runnable.has(name) ? documents(generator.renderStageRunner(runnable.get(name))) : null])),
  scopes: Object.fromEntries(input.scopes.map(name => [name,
    scopes.has(name) ? documents(generator.renderRunner(name, discovered[name].description)) : null])),
  workflow: [...documents(generator.renderInitRunner()), ...documents(generator.renderComposeRunner())]
}));
`;

export const prepareLegacyRunners = (request: LegacyRunnerRequest):
  Result<LegacyRunners, ProjectionRefusal> => {
  let scratch: string | null = null;
  try {
    scratch = mkdtempSync(join(request.projectRoot, ".aidlc-runner-frame-"));
    const scopeRoot = join(scratch, "sources");
    const output = join(scratch, "output");
    mkdirSync(scopeRoot);
    mkdirSync(output);
    const prefix = `${METHOD_SOURCE_FOLDERS.scope}/`;
    const captured = request.method.scopes.map((scope): Result<MethodSource, ProjectionRefusal> => {
      const source = request.sources.find((candidate) => candidate.path === scope.source
        && candidate.owner.kind === scope.owner.kind
        && (candidate.owner.kind !== "plugin" || (scope.owner.kind === "plugin"
          && candidate.owner.plugin === scope.owner.plugin)));
      return source && source.path.startsWith(prefix) ? accepted(source)
        : unavailable(`The accepted scope source was not captured: ${scope.name}`);
    });
    const missing = captured.find((admission) => !admission.ok);
    if (missing && !missing.ok) return missing;
    captured.flatMap((admission) => admission.ok ? [admission.value] : []).forEach((source) => {
      const destination = join(scopeRoot, source.path.slice(prefix.length));
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, source.content.kind === "text"
        ? source.content.text : source.content.bytes);
    });
    const tree = join(request.projectRoot, request.harnessDir);
    const environment = Object.fromEntries(Object.entries(process.env)
      .filter(([key]) => ["SYSTEMROOT", "WINDIR", "PATH", "PATHEXT"].includes(key.toUpperCase())));
    const reply = spawnSync(process.execPath, ["--no-install", "--eval", program], {
      cwd: output, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
      env: { ...environment, ...Object.fromEntries([
        ["TEMP", scratch], ["TMP", scratch], ["AIDLC_SRC", tree], ["AIDLC_HARNESS_DIR", request.harnessDir],
        ["AIDLC_HARNESS_NAME", request.harnessName], ["AIDLC_RUNTIME_PROJECT_DIR", output],
        ["AIDLC_PROJECT_DIR", output], ["AIDLC_SCOPES_DIR", scopeRoot],
        ["AIDLC_STAGE_GRAPH", join(tree, "tools/data/stage-graph.json")],
        ["AIDLC_SCOPE_GRID", join(tree, "tools/data/scope-grid.json")],
      ]) },
      input: JSON.stringify({ module: join(tree, "tools/aidlc-runner-gen.ts"), output,
        stages: request.method.graph.nodes.map((node) => node.stage),
        scopes: request.method.scopes.map((scope) => scope.name) }),
    });
    return decodeLegacyRunners({ status: reply.status, stdout: reply.stdout ?? "",
      stderr: reply.stderr ?? reply.error?.message ?? "" });
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : String(error));
  } finally {
    if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  }
};
