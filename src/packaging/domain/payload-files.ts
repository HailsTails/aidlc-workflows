import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { PackagingRefusal } from "./artifact.ts";
import type { PayloadFile } from "./payload.ts";

export const orderedPayloadFiles = (
  files: readonly PayloadFile[],
): Result<readonly PayloadFile[], readonly PackagingRefusal[]> => {
  const ordered = files.toSorted((left, right) =>
    left.path < right.path ? -1 : Number(left.path > right.path));
  const duplicates = ordered.flatMap((file, index) => file.path === ordered[index - 1]?.path
    ? [{ kind: "duplicate-path" as const, path: file.path }] : []);
  return duplicates.length > 0 ? refused(duplicates) : accepted(ordered);
};

export const payloadTreeOrder = (first: Pick<PayloadFile, "path">, second: Pick<PayloadFile, "path">): number => {
  const firstParts = first.path.split("/");
  const secondParts = second.path.split("/");
  const difference = firstParts.slice(0, secondParts.length).map((firstPart, index) => {
    const secondPart = secondParts[index] ?? "";
    return firstPart < secondPart ? -1 : Number(firstPart > secondPart);
  }).find((order) => order !== 0);
  return difference ?? firstParts.length - secondParts.length;
};
