import { asFolder } from "../../kernel/file-system-port.ts";
import { prepareLegacyRunnersInFrame } from "./legacy-runners.ts";
import type { CommandSource, CommandSourceRequest } from "../application/ports/commands.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { ProjectedFile } from "../domain/projected-file.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { SkillTableRenderer, SkillTableVerb } from "../domain/neutral-surface.ts";
import type { LegacyRunnerProcess, LegacyRunnerScratch } from "../application/ports/legacy-runner.ts";
import type { SkillProjectionRequest } from "../application/ports/skills.ts";
import type { Depth } from "../../workflow-definition/domain/vocabulary.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { scopeColumn } from "../../workflow-definition/domain/scope-grid.ts";

const LEGACY_DEPTH: Readonly<Record<Depth, string>> = {
  minimal: "Minimal", standard: "Standard", comprehensive: "Comprehensive",
};

export const legacySkillScopeMapping = (method: Method) =>
  Object.fromEntries(method.scopes.map((scope) => {
    const selected = new Set(scopeColumn({ method, scope: scope.name }).stages);
    const definition = {
      depth: LEGACY_DEPTH[scope.depth],
      stages: Object.fromEntries(method.graph.nodes.map((node) =>
        [node.stage, selected.has(node.stage) ? "EXECUTE" : "SKIP"] as const)),
      ...(scope.testStrategy === null ? {} : { testStrategy: scope.testStrategy }),
    };
    return [scope.name, definition] as const;
  }));

type TableRequest = Pick<SkillProjectionRequest, "method" | "host" | "projectRoot">;
type TablePorts = {
  readonly scratch: LegacyRunnerScratch;
  readonly processRunner: LegacyRunnerProcess;
  readonly frames: URL;
};
type TableFrame = TablePorts & { readonly folder: URL; readonly mapping: URL };

const failedTables = (reason: string): SkillTableRenderer => () => refused(reason);
const treeOf = (request: TableRequest): URL => new URL(
  `${request.host.directory.split("/").map(encodeURIComponent).join("/")}/`, asFolder(request.projectRoot),
);
const pathArgument = (location: URL) => ({ kind: "path" as const, location });

const runTable = async (request: TableRequest & { readonly verb: SkillTableVerb }, frame: TableFrame):
Promise<Result<string, string>> => {
  const tree = treeOf(request);
  const reply = await frame.processRunner.runCurrentRuntime({
    argv: ["--no-install", pathArgument(new URL("tools/aidlc-utility.ts", tree)), request.verb],
    cwd: tree, input: "",
    env: {
      ["PATH"]: { kind: "runtime-folder" }, ["TEMP"]: pathArgument(frame.folder),
      ["TMP"]: pathArgument(frame.folder), ["TMPDIR"]: pathArgument(frame.folder),
      ["AIDLC_SRC"]: pathArgument(tree), ["AIDLC_HARNESS_DIR"]: request.host.directory,
      ["AIDLC_HARNESS_NAME"]: request.host.distribution,
      ["AIDLC_RUNTIME_PROJECT_DIR"]: pathArgument(frame.folder),
      ["AIDLC_PROJECT_DIR"]: pathArgument(frame.folder),
      ["AIDLC_SCOPE_MAPPING"]: pathArgument(frame.mapping),
      ["AIDLC_STAGE_GRAPH"]: pathArgument(new URL("tools/data/stage-graph.json", tree)),
    },
  });
  if (!reply.ok) return refused(reply.refusal.reason);
  return reply.value.exit.kind === "exited" && reply.value.exit.code === 0
    ? accepted(reply.value.stdout) : refused(reply.value.stderr || "The frozen skill formatter failed.");
};

const renderTables = async (request: TableRequest, frame: TableFrame): Promise<SkillTableRenderer> => {
  const written = await frame.scratch.writeFile({ file: frame.mapping,
    content: { kind: "text", text: JSON.stringify(legacySkillScopeMapping(request.method)) } });
  if (!written.ok) return failedTables(`The captured scope mapping could not be written: ${written.refusal.code}`);
  const stage = await runTable({ ...request, verb: "stage-table" }, frame);
  const scope = stage.ok ? await runTable({ ...request, verb: "scope-table" }, frame) : stage;
  return (verb) => verb === "stage-table" ? stage : scope;
};

type TableProgram = { readonly kind: "built" }
  | { readonly kind: "captured"; readonly files: readonly ProjectedFile[] };

const stageTableFiles = async (request: {
  readonly files: readonly ProjectedFile[];
  readonly folder: URL;
  readonly scratch: LegacyRunnerScratch;
}): Promise<Result<undefined, string>> => request.files.reduce<Promise<Result<undefined, string>>>(
  async (previous, file) => {
    const admitted = await previous;
    if (!admitted.ok) return admitted;
    const location = new URL(file.path.split("/").map(encodeURIComponent).join("/"), asFolder(request.folder));
    const parent = await request.scratch.makeFolder({ folder: new URL(".", location) });
    if (!parent.ok) return refused(`The formatter program folder is unavailable: ${file.path}: ${parent.refusal.code}`);
    const written = await request.scratch.writeFile({ file: location, content: file.content });
    return written.ok ? accepted(undefined)
      : refused(`The captured formatter program is unwritable: ${file.path}: ${written.refusal.code}`);
  }, Promise.resolve(accepted(undefined)),
);
const prepareTableFrame = async ({ request, ports, program }: {
  readonly request: TableRequest;
  readonly ports: TablePorts;
  readonly program: TableProgram;
}): Promise<SkillTableRenderer> => {
  const parent = await ports.scratch.makeFolder({ folder: ports.frames });
  if (!parent.ok) return failedTables(`The skill frame parent is unavailable: ${parent.refusal.code}`);
  const folder = await ports.scratch.makeScratchFolder({ parent: ports.frames });
  if (!folder.ok) return failedTables(`The skill frame is unavailable: ${folder.refusal.code}`);
  const staged = program.kind === "captured"
    ? await stageTableFiles({ files: program.files, folder: folder.value, scratch: ports.scratch }) : accepted(undefined);
  const tables = staged.ok ? await renderTables({ ...request,
    projectRoot: program.kind === "captured" ? folder.value : request.projectRoot,
  }, { ...ports, folder: folder.value, mapping: new URL("scope-mapping.json", asFolder(folder.value)) })
    : failedTables(staged.refusal);
  const removed = await ports.scratch.removeFolder({ folder: folder.value });
  return removed.ok ? tables
    : failedTables(`The private skill frame could not be removed: ${removed.refusal.code}`);
};

export const prepareLegacySkillTables = (request: TableRequest, ports: TablePorts): Promise<SkillTableRenderer> =>
  prepareTableFrame({ request, ports, program: { kind: "built" } });

export const prepareCapturedLegacySkillTables = (
  request: TableRequest & { readonly files: readonly ProjectedFile[] }, ports: TablePorts,
): Promise<SkillTableRenderer> => prepareTableFrame({ request, ports,
  program: { kind: "captured", files: request.files } });

type CapturedLegacyFormatting = { readonly tables: SkillTableRenderer; readonly commands: CommandSource };

export const prepareCapturedLegacyFormatting = async (
  request: TableRequest & CommandSourceRequest & { readonly files: readonly ProjectedFile[] },
  ports: TablePorts & { readonly child: URL },
): Promise<Result<CapturedLegacyFormatting, ProjectionRefusal>> => {
  const failure = (reason: string): Result<CapturedLegacyFormatting, ProjectionRefusal> =>
    refused({ kind: "command-source-failed", reason });
  const parent = await ports.scratch.makeFolder({ folder: ports.frames });
  if (!parent.ok) return failure(`The captured program parent is unavailable: ${parent.refusal.code}`);
  const folder = await ports.scratch.makeScratchFolder({ parent: ports.frames });
  if (!folder.ok) return failure(`The captured program frame is unavailable: ${folder.refusal.code}`);
  const staged = await stageTableFiles({ files: request.files, folder: folder.value, scratch: ports.scratch });
  const rendered = staged.ok ? accepted({
    commands: await prepareLegacyRunnersInFrame(request, { folder: folder.value, ports }),
    tables: await renderTables({ ...request, projectRoot: folder.value },
      { ...ports, folder: folder.value, mapping: new URL("scope-mapping.json", asFolder(folder.value)) }),
  }) : failure(staged.refusal);
  const removed = await ports.scratch.removeFolder({ folder: folder.value });
  return removed.ok ? rendered : failure(`The captured program frame could not be removed: ${removed.refusal.code}`);
};
