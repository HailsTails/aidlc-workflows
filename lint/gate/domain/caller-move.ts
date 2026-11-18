import type { Finding } from "./outcome.ts";

export type LineChanges = {
  readonly added: readonly string[];
  readonly removed: readonly string[];
};

export type CallerMove = {
  readonly path: string;
  readonly lines: LineChanges;
  readonly movedNames: ReadonlySet<string>;
};

const IMPORT_LINE = /^\s*(import\b|export\s+(\*|\{|type\s*\{).*\bfrom\b|\}\s*from\s)/;

const SPECIFIER_LINE = /^\s*(type\s+)?[\w$]+(\s+as\s+[\w$]+)?,?\s*$/;

const BLANK = /^\s*$/;

const IDENTIFIER = /[\w$]+/g;

const linesOf = (text: string | undefined): readonly string[] =>
  text === undefined ? [] : text.split(/\r?\n/);

const withoutEach = (lines: readonly string[], taken: readonly string[]): readonly string[] => {
  const remaining = new Map<string, number>();
  for (const line of taken) {
    remaining.set(line, (remaining.get(line) ?? 0) + 1);
  }
  return lines.filter((line) => {
    const count = remaining.get(line) ?? 0;
    remaining.set(line, count - 1);
    return count <= 0;
  });
};

export const lineChanges = (versions: {
  readonly before: string | undefined;
  readonly after: string | undefined;
}): LineChanges => {
  const before = linesOf(versions.before);
  const after = linesOf(versions.after);
  return { added: withoutEach(after, before), removed: withoutEach(before, after) };
};

const mentionsMovedName = (line: string, movedNames: ReadonlySet<string>): boolean =>
  (line.match(IDENTIFIER) ?? []).some((token) => movedNames.has(token));

const isRepointLine = (line: string, movedNames: ReadonlySet<string>): boolean =>
  BLANK.test(line) ||
  IMPORT_LINE.test(line) ||
  SPECIFIER_LINE.test(line) ||
  mentionsMovedName(line, movedNames);

export const judgeCallerMove = (move: CallerMove): readonly Finding[] => {
  const changed = [...move.lines.added, ...move.lines.removed];
  const strays = changed.filter((line) => !isRepointLine(line, move.movedNames));
  return strays.length === 0
    ? []
    : [
        {
          subject: move.path,
          violation:
            `changes more than imports and call sites of ${[...move.movedNames].join(", ")}; ` +
            `first stray line: ${strays[0]?.trim()}`,
          fix:
            "Outside your lane, only repoint imports and call sites of a declaration you " +
            "deleted in this slice to its new owner. Revert every other edit.",
        },
      ];
};
