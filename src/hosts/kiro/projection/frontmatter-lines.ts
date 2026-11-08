import { accepted, refused, type Result } from "../../../kernel/result.ts";

export type FrontmatterLinesRefusal =
  | { readonly kind: "no-frontmatter" }
  | { readonly kind: "not-a-key"; readonly line: string }
  | { readonly kind: "key-added-twice"; readonly key: string }
  | { readonly kind: "key-already-present"; readonly key: string };

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n(---\r?\n)/;

const YAML_KEY = /^[A-Za-z_][\w-]*$/;

const topLevelKeys = (lines: readonly string[]): readonly string[] =>
  lines.filter((line) => !/^\s/.test(line)).map((line) => line.split(":")[0]?.trim() ?? "");

const keyRefusal = (
  lines: readonly string[],
  existing: string,
): FrontmatterLinesRefusal | null => {
  const keys = topLevelKeys(lines);
  const notKey = keys.findIndex((key) => !YAML_KEY.test(key));
  if (notKey !== -1) {
    return { kind: "not-a-key", line: lines.filter((line) => !/^\s/.test(line))[notKey] ?? "" };
  }
  const twice = keys.find((key, position) => keys.indexOf(key) !== position);
  if (twice !== undefined) {
    return { kind: "key-added-twice", key: twice };
  }
  const present = keys.find((key) => new RegExp(`^${key}:`, "m").test(existing));
  return present === undefined ? null : { kind: "key-already-present", key: present };
};

export const withFrontmatterLines = (
  text: string,
  lines: readonly string[],
): Result<string, FrontmatterLinesRefusal> => {
  const block = FRONTMATTER.exec(text);
  if (block === null) {
    return refused({ kind: "no-frontmatter" });
  }
  const refusal = keyRefusal(lines, block[1] ?? "");
  if (refusal !== null) {
    return refused(refusal);
  }
  const insertAt = block[0].length - (block[2] ?? "").length;
  return accepted(`${text.slice(0, insertAt)}${lines.join("\n")}\n${text.slice(insertAt)}`);
};
