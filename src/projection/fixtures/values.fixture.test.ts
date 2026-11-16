import { describe, expect, test } from "bun:test";
import { methodPath, text } from "./values.fixture.ts";

describe("text", () => {
  test("joins lines into text content ending in a newline", () => {
    expect(text(["# AI-DLC", "", "Type `/aidlc` to start."])).toEqual({
      kind: "text",
      text: "# AI-DLC\n\nType `/aidlc` to start.\n",
    });
  });

  test("turns no lines into a lone newline", () => {
    expect(text([])).toEqual({ kind: "text", text: "\n" });
  });
});

describe("methodPath", () => {
  test("places a stage source under the stages folder", () => {
    expect(methodPath({ kind: "stage", within: "construction/code-generation.md" })).toBe<string>(
      "aidlc-common/stages/construction/code-generation.md",
    );
  });

  test("throws for a location that is not a portable path", () => {
    expect(() => methodPath({ kind: "agent", within: "../aidlc-developer-agent.md" })).toThrow(
      'Fixture value refused: {"kind":"invalid-method-source-location",' +
        '"raw":"aidlc-common/agents/../aidlc-developer-agent.md"}',
    );
  });
});
