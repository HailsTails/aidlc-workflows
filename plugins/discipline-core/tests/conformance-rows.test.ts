import { describe, expect, it } from "vitest";
import { mechanismIdSchema } from "../core/values/identifiers.ts";
import { conformanceRows, foldersUnder } from "./conformance-rows.ts";

const TABLE = {
  "./rules/XX-1/discipline.json": JSON.stringify({
    version: 1,
    id: "XX-1",
    clauses: [
      {
        kind: "mechanical",
        id: "first-check",
        summary: "first",
        mechanisms: ["audit"],
        anchor: { kind: "file" },
        cases: {
          flag: [{ name: "flagged", fileName: "a.ts", source: "x\n", expectedLines: [1] }],
          allow: [{ name: "allowed", fileName: "b.ts", source: "y\n", expectedLines: [] }],
        },
      },
      { kind: "judgement", id: "second-check", summary: "second", enforcedBy: "review" },
    ],
  }),
  "./mechanisms/audit/XX-1/piece.json": JSON.stringify({
    version: 1,
    discipline: "XX-1",
    mechanism: "audit",
    clauses: [{ clause: "first-check", settings: { module: "first.ts" } }],
  }),
  "./mechanisms/audit/XX-2/piece.json": "{}",
};

describe("foldersUnder", () => {
  it("lists each folder holding a key under the prefix once, in order", () => {
    expect(foldersUnder({ table: TABLE, prefix: "./mechanisms/audit/" })).toEqual(["XX-1", "XX-2"]);
  });
});

describe("conformanceRows", () => {
  it("builds one row per piece clause with its address, anchor, piece root, settings and flag then allow cases", () => {
    expect(
      conformanceRows({
        table: TABLE,
        disciplines: ["XX-1"],
        mechanism: mechanismIdSchema.parse("audit"),
        mechanismRoot: "/install/mechanisms/audit",
      }),
    ).toEqual([
      {
        name: "XX-1#first-check",
        clause: {
          address: { ruleSet: "shared", discipline: "XX-1", clause: "first-check" },
          anchor: { kind: "file" },
          pieceRoot: "/install/mechanisms/audit/XX-1",
          settings: { module: "first.ts" },
        },
        cases: [
          { name: "flagged", fileName: "a.ts", source: "x\n", expectedLines: [1] },
          { name: "allowed", fileName: "b.ts", source: "y\n", expectedLines: [] },
        ],
      },
    ]);
  });
});
