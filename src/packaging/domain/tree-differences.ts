import type { FileContent } from "../../kernel/file-content.ts";
import type { TreeFile } from "../../kernel/file-system-port.ts";

const bytesOf = (content: FileContent): Uint8Array =>
  content.kind === "bytes" ? content.bytes : new TextEncoder().encode(content.text);

const compareContent = (first: FileContent, second: FileContent): "equal" | "different" => {
  const left = bytesOf(first);
  const right = bytesOf(second);
  return left.length === right.length && left.every((byte, index) => byte === right[index]) ? "equal" : "different";
};

const byPath = (first: TreeFile, second: TreeFile): number =>
  first.path < second.path ? -1 : Number(first.path > second.path);

export const treeDifferences = ({ first, second, prefix }: {
  readonly first: readonly TreeFile[];
  readonly second: readonly TreeFile[];
  readonly prefix: string;
}): readonly string[] => {
  const firstPaths = new Set(first.map((file) => file.path));
  const counterparts = new Map(second.map((file) => [file.path, file]));
  return [
    ...first.toSorted(byPath).flatMap((file) => {
      const counterpart = counterparts.get(file.path);
      if (!counterpart) return [`MISSING in second build: ${prefix}/${file.path}`];
      return compareContent(file.content, counterpart.content) === "equal" ? []
        : [`DIFFERS between builds: ${prefix}/${file.path}`];
    }),
    ...second.toSorted(byPath).filter((file) => !firstPaths.has(file.path))
      .map((file) => `ONLY in second build: ${prefix}/${file.path}`),
  ];
};
