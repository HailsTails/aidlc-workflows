import type { FileContent } from "../../kernel/file-content.ts";
import type { TreeFile, UnreadableTreeFile, TreeSelection } from "../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { sourcePath, type SourcePath } from "../../kernel/values.ts";
import type { SessionSkillSource, SessionSkillTreeReader } from "../application/ports/skills.ts";
import { SESSION_SKILL_NAMES, type SessionSkill } from "../domain/neutral-surface.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

type CapturedSkills = Result<readonly SessionSkill[], readonly ProjectionRefusal[]>;
type SessionSourceOptions = {
  readonly folder: URL;
  readonly source: SourcePath;
  readonly tree: SessionSkillTreeReader;
};
type CapturedSessionFile = {
  readonly name: string;
  readonly file: SessionSkill["files"][number];
};

const copyContent = (content: FileContent): FileContent => content.kind === "text" ? content
  : { kind: "bytes", bytes: new Uint8Array(content.bytes) };

const unreadable = (request: {
  readonly source: SourcePath;
  readonly failure: UnreadableTreeFile;
}): ProjectionRefusal => {
  const qualified = `${request.source}/${request.failure.within.replace(/\/$/, "")}`;
  const path = sourcePath(qualified);
  return { kind: "neutral-source-unreadable",
    source: path.ok ? path.value : request.source,
    reason: path.ok ? request.failure.code : `${request.failure.code}: ${qualified}` };
};

const captureFile = (request: {
  readonly source: SourcePath;
  readonly file: TreeFile;
}): Result<CapturedSessionFile | null, ProjectionRefusal> => {
  const [name, within] = request.file.path.split("/");
  if (!name) return accepted(null);
  if (within === undefined) return refused({ kind: "neutral-source-unreadable",
    source: request.source, reason: `The named session skill is not a folder: ${name}` });
  const path = sourcePath(`${request.source}/${request.file.path}`);
  if (!path.ok) return refused(unreadable({ source: request.source,
    failure: { within: request.file.path, code: "unportable-name" } }));
  return accepted({ name, file: { source: path.value, content: copyContent(request.file.content) } });
};

const selectSessionEntry: TreeSelection = ({ within }) =>
  SESSION_SKILL_NAMES.some((name) => name === within.split("/")[0]) ? "read" : "skip";

const captureSkills = async (options: SessionSourceOptions): Promise<CapturedSkills> => {
  const tree = await options.tree.readTree({ folder: options.folder, select: selectSessionEntry });
  if (!tree.ok) return tree.refusal.code === "not-found" ? accepted([])
    : refused([{ kind: "neutral-source-unreadable",
      source: options.source, reason: tree.refusal.code }]);
  const readings = tree.value.files.map((file) => captureFile({ source: options.source, file }));
  const failures = [
    ...tree.value.unreadable.map((failure) => unreadable({ source: options.source, failure })),
    ...readings.flatMap((reading) => reading.ok ? [] : [reading.refusal]),
  ];
  if (failures.length > 0) return refused(failures);
  const files = readings.flatMap((reading) => reading.ok && reading.value ? [reading.value] : []);
  const names = [...new Set(files.map((entry) => entry.name))].toSorted();
  return accepted(names.map((name) => ({ name,
    files: files.filter((entry) => entry.name === name).map((entry) => entry.file) })));
};

export const createSessionSkillSource = (options: SessionSourceOptions): SessionSkillSource => {
  const captured = captureSkills(options);
  return { read: () => captured };
};
