import { asFolder, type TreeSelection } from "../../kernel/file-system-port.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { sourcePath } from "../../kernel/values.ts";
import { METHOD_SOURCE_FOLDERS, methodFileKind } from "../../workflow-definition/domain/method-source.ts";
import type { SessionSkillTreeReader } from "../application/ports/skills.ts";
import type { MemoryCompanionReading } from "../application/ports/workspace.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

const selectCompanion: TreeSelection = ({ kind, within }) => kind === "folder"
  || methodFileKind(within) === "companion" ? "read" : "skip";

export const createMemoryCompanionReading = (tree: SessionSkillTreeReader): MemoryCompanionReading => async ({ core }) => {
  const root = METHOD_SOURCE_FOLDERS.rule;
  const rootSource = sourcePath(root);
  if (!rootSource.ok) return refused([{ kind: "render-failed", concept: "host-data", name: root,
    reason: "The memory source is not a portable path." }]);
  const reading = await tree.readTree({ folder: new URL(`${root}/`, asFolder(core)), select: selectCompanion });
  const failure = (within: string, reason: string): ProjectionRefusal => {
    const raw = within ? `${root}/${within.replace(/\/$/, "")}` : root;
    const source = sourcePath(raw);
    return { kind: "neutral-source-unreadable", source: source.ok ? source.value : rootSource.value,
      reason: source.ok ? reason : `${reason}: ${raw}` };
  };
  if (!reading.ok) return refused([failure("", reading.refusal.code)]);
  const files = reading.value.files.map((file) => {
    const source = sourcePath(`${root}/${file.path}`);
    return source.ok ? accepted({ source: source.value, content: file.content.kind === "text" ? file.content
      : { kind: "bytes" as const, bytes: new Uint8Array(file.content.bytes) } })
      : refused(failure(file.path, "unportable-name"));
  });
  const failures = [...reading.value.unreadable.map((file) => failure(file.within, file.code)),
    ...files.flatMap((file) => file.ok ? [] : [file.refusal])];
  return failures.length > 0 ? refused(failures) : accepted(files.flatMap((file) => file.ok ? [file.value] : []));
};
