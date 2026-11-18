import type { Finding } from "./outcome.ts";

export type MonolithShape = {
  readonly file: string;
  readonly declarations: readonly string[];
  readonly lines: number;
};

const MOVE_OUT =
  "Monoliths only shrink. Put the code in its context under src/ (see src/glossary.json " +
  "for the owner) and import it from there; never add to the monolith.";

const PASS_THROUGH_PORT =
  "Recorded types only shrink. Pass the input through the Harness port " +
  "instead of widening this type.";

const newDeclarations = (recorded: MonolithShape, measured: MonolithShape): readonly Finding[] => {
  const listed = new Set(recorded.declarations);
  return [...new Set(measured.declarations)]
    .filter((name) => !listed.has(name))
    .map((name) => ({
      subject: `${measured.file} · ${name}`,
      violation: name.includes(".")
        ? "is a new member of a type the monolith record holds"
        : "is a new top-level declaration in a monolith",
      fix: name.includes(".") ? PASS_THROUGH_PORT : MOVE_OUT,
    }));
};

const growth = (recorded: MonolithShape, measured: MonolithShape): readonly Finding[] =>
  measured.lines > recorded.lines
    ? [
        {
          subject: measured.file,
          violation: `grew from ${recorded.lines} to ${measured.lines} lines`,
          fix: MOVE_OUT,
        },
      ]
    : [];

export const judgeMonolith = (request: {
  readonly recorded: MonolithShape;
  readonly measured: MonolithShape;
}): readonly Finding[] => [
  ...newDeclarations(request.recorded, request.measured),
  ...growth(request.recorded, request.measured),
];

export const shrunkRecord = (request: {
  readonly recorded: MonolithShape;
  readonly measured: MonolithShape;
}): MonolithShape => {
  const present = new Set(request.measured.declarations);
  return {
    file: request.recorded.file,
    declarations: request.recorded.declarations.filter((name) => present.has(name)),
    lines: Math.min(request.recorded.lines, request.measured.lines),
  };
};

export const countLines = (text: string): number =>
  text.length === 0 ? 0 : text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n").length;
