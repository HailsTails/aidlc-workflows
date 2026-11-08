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
