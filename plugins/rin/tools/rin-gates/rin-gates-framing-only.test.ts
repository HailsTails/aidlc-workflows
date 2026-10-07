import { describe, expect, test } from "vitest";
import { programmingFenceFindings } from "./rin-gates-framing-only.ts";

describe("programmingFenceFindings", () => {
  test("refuses each fence tagged with a programming language", () => {
    expect(
      programmingFenceFindings({
        artefact: "rin-solution-options.md",
        markdownText:
          "# Ledger\n\n```ts\ntype A = string;\n```\n\n~~~Python\nx = 1\n~~~\n",
      }),
    ).toEqual([
      {
        check: "framing-only/programming-language-fence",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 3 },
        subject: "a `ts` code fence",
        remedy:
          "Gate 2 is prose and diagrams: describe the shape in prose or mermaid, and quote existing code as evidence in a `text` fence. Signatures and code belong to Gate 3.",
      },
      {
        check: "framing-only/programming-language-fence",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 7 },
        subject: "a `python` code fence",
        remedy:
          "Gate 2 is prose and diagrams: describe the shape in prose or mermaid, and quote existing code as evidence in a `text` fence. Signatures and code belong to Gate 3.",
      },
    ]);
  });

  test("allows evidence, diagram, data and untagged fences, and does not scan prose", () => {
    expect(
      programmingFenceFindings({
        artefact: "rin-options-questions.md",
        markdownText:
          "```\nplain\n```\n```bash\ngit grep x\n```\n```mermaid\ngraph TD\n```\n```json\n{}\n```\n\ntype A = string; and `run(x: string): void`\n",
      }),
    ).toEqual([]);
  });

  test("reads a tag carrying metadata by its language alone", () => {
    expect(
      programmingFenceFindings({
        artefact: "rin-solution-options.md",
        markdownText: "```ts:src/a.ts\nx\n```\n```mts,title=b\ny\n```\n",
      }),
    ).toEqual([
      {
        check: "framing-only/programming-language-fence",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 1 },
        subject: "a `ts` code fence",
        remedy:
          "Gate 2 is prose and diagrams: describe the shape in prose or mermaid, and quote existing code as evidence in a `text` fence. Signatures and code belong to Gate 3.",
      },
      {
        check: "framing-only/programming-language-fence",
        artefact: "rin-solution-options.md",
        location: { kind: "line", lineNumber: 4 },
        subject: "a `mts` code fence",
        remedy:
          "Gate 2 is prose and diagrams: describe the shape in prose or mermaid, and quote existing code as evidence in a `text` fence. Signatures and code belong to Gate 3.",
      },
    ]);
  });

  test("does not read a language tag inside an open fence as a new fence", () => {
    expect(
      programmingFenceFindings({
        artefact: "rin-solution-options.md",
        markdownText: "````text\n```ts\n````\n",
      }),
    ).toEqual([]);
  });
});
