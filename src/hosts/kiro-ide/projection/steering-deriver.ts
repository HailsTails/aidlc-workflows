import type { HostFileDeriver } from "../../../projection/application/ports/harness.ts";
import { accepted, refused } from "../../../kernel/result.ts";
import { projectPath } from "../../../kernel/values.ts";
import type { FileContent } from "../../../kernel/file-content.ts";
import type { ProjectedFile } from "../../../projection/domain/projected-file.ts";

const STEERING_PATH = ".kiro/steering/aidlc-active-memory.md";
const MEMORY_DIRECTORY = "aidlc/spaces/default/memory";
const MEMORY_LAYERS = [
  "org.md", "team.md", "project.md",
  "phases/ideation.md", "phases/inception.md", "phases/construction.md", "phases/operation.md",
];
const INLINE_MAX_BYTES = 64 * 1024;
const EMPTY: FileContent = { kind: "text", text: "" };
const HEAD = ["---", "inclusion: always", "---", "", "# AI-DLC Active Memory", ""];

const decodedText = (content: FileContent): string | null => {
  if (content.kind === "text") return content.text;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content.bytes);
  } catch {
    return null;
  }
};

const memoryFiles = (files: readonly ProjectedFile[]): ReadonlyMap<string, ProjectedFile> => new Map(
  files.filter((file) => file.path.startsWith(`${MEMORY_DIRECTORY}/`))
    .map((file) => [file.path.slice(MEMORY_DIRECTORY.length + 1), file]),
);

const extraLayers = (names: Iterable<string>, folder: string): readonly string[] => [...names]
  .filter((name) => name.endsWith(".md") && !MEMORY_LAYERS.includes(name)
    && (folder === "" ? !name.includes("/") : name.startsWith(`${folder}/`) && !name.slice(folder.length + 1).includes("/")))
  .sort();

const orderedLayers = (memory: ReadonlyMap<string, ProjectedFile>): readonly string[] => [
  ...MEMORY_LAYERS, ...extraLayers(memory.keys(), ""), ...extraLayers(memory.keys(), "phases"),
].filter((name) => memory.has(name));

const memoryBlock = (name: string, text: string): string =>
  `<memory-file path="${MEMORY_DIRECTORY}/${name}">\n${text}${text.endsWith("\n") ? "" : "\n"}</memory-file>\n`;

const inlineBlocks = (memory: ReadonlyMap<string, ProjectedFile>): readonly string[] | null => {
  const layers = orderedLayers(memory).map((name) => ({ name, text: decodedText(memory.get(name)?.content ?? EMPTY) }));
  const texts = layers.flatMap((layer) => layer.text === null ? [] : [{ name: layer.name, text: layer.text }]);
  const bytes = texts.reduce((total, layer) => total + new TextEncoder().encode(layer.text).length, 0);
  const unreadable = texts.length !== layers.length || bytes > INLINE_MAX_BYTES;
  return unreadable || texts.length === 0 ? null : texts.map((layer) => memoryBlock(layer.name, layer.text));
};

const referenceSteering = (): string => [
  ...HEAD,
  "The following live workspace files are the active AI-DLC method and policy",
  "layers. They apply to the conductor and delegated agents.",
  "",
  ...MEMORY_LAYERS.map((name) => `#[[file:${MEMORY_DIRECTORY}/${name}]]`),
  "",
].join("\n");

const inlineSteering = (blocks: readonly string[]): string => [
  ...HEAD,
  `<!-- AI-DLC writes this file from ${MEMORY_DIRECTORY}/ for every chat. Do not edit it: edit those files instead. -->`,
  "",
  "The text of each file below is the active AI-DLC method and policy layers. They apply to the",
  "conductor and delegated agents.",
  "",
  blocks.join("\n"),
].join("\n");

export const deriveKiroIdeSteering: HostFileDeriver = ({ files }) => {
  const path = projectPath(STEERING_PATH);
  if (!path.ok) return refused({ kind: "render-failed", concept: "onboarding", name: STEERING_PATH,
    reason: "The steering destination must be project-relative." });
  const blocks = inlineBlocks(memoryFiles(files));
  return accepted([{ path: path.value, mode: "regular",
    content: { kind: "text", text: blocks === null ? referenceSteering() : inlineSteering(blocks) },
    origin: { kind: "rendered", concept: "onboarding", name: STEERING_PATH } }]);
};
