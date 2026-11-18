import { describe, expect, test } from "bun:test";
import { judgeMonolith, shrunkRecord, type MonolithShape } from "./monolith.ts";

const RECORDED: MonolithShape = {
  file: "scripts/manifest-types.ts",
  declarations: ["EmitContext", "EmitContext.repoRoot"],
  lines: 100,
};

describe("judgeMonolith", () => {
  test("a new member of a recorded type is red and says to use the Harness port", () => {
    const declarations = [...RECORDED.declarations, "EmitContext.hostFiles"];
    const measured = { ...RECORDED, declarations };

    const findings = judgeMonolith({ recorded: RECORDED, measured });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.subject).toBe("scripts/manifest-types.ts · EmitContext.hostFiles");
    expect(findings[0]?.violation).toContain("new member");
    expect(findings[0]?.fix).toContain("Harness port");
  });

  test("a new top-level declaration keeps its own wording", () => {
    const measured = { ...RECORDED, declarations: [...RECORDED.declarations, "newHelper"] };

    expect(judgeMonolith({ recorded: RECORDED, measured })[0]?.violation).toContain("top-level");
  });

  test("a new line is red and a shorter file is green", () => {
    const judgedAt = (lines: number) =>
      judgeMonolith({ recorded: RECORDED, measured: { ...RECORDED, lines } });

    expect(judgedAt(101)).toHaveLength(1);
    expect(judgedAt(99)).toHaveLength(0);
  });

  test("a removed member drops out of the record and lines only fall", () => {
    const measured = { ...RECORDED, declarations: ["EmitContext"], lines: 90 };

    expect(shrunkRecord({ recorded: RECORDED, measured })).toEqual({
      file: RECORDED.file,
      declarations: ["EmitContext"],
      lines: 90,
    });
  });
});
