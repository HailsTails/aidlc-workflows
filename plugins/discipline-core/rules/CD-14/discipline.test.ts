import { describe, expect, it } from "vitest";
import type { FileTextPort } from "../../core/platform-ports/file-text-port.ts";
import { createPathPort } from "../../core/platform-ports/path-port.ts";
import { readDisciplineFile } from "../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../core/values/absolute-path.ts";
import { disciplineIdSchema } from "../../core/values/identifiers.ts";
import discipline from "./discipline.json" with { type: "json" };

const fileText: FileTextPort = {
  read: () => ({ outcome: "ok", value: JSON.stringify(discipline) }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
};

const loaded = () =>
  readDisciplineFile({
    fileText,
    path: createPathPort({ workingDirectory: () => "/install" }),
    ruleSetRoot: absolutePathSchema.parse("/install"),
    discipline: disciplineIdSchema.parse("CD-14"),
  });

describe("CD-14 discipline.json", () => {
  it("states class syntax as a mechanical clause the walker and ESLint decide at the class keyword", () => {
    expect(loaded()).toMatchObject({
      outcome: "ok",
      value: {
        version: 1,
        id: "CD-14",
        clauses: [
          {
            kind: "mechanical",
            id: "class-syntax",
            mechanisms: ["walker", "eslint"],
            anchor: { kind: "keyword", keyword: "class" },
          },
          { kind: "judgement", id: "library-construction", enforcedBy: "review" },
        ],
      },
    });
  });

  it("carries every must-flag case FR-1 names", () => {
    expect(loaded()).toMatchObject({
      value: {
        clauses: [
          {
            cases: {
              flag: [
                { name: "class declaration" },
                { name: "class expression" },
                { name: "export default class across two lines" },
                { name: "abstract class" },
                { name: "nested class" },
                { name: "runtime namespace class" },
                { name: "new anonymous class" },
              ],
            },
          },
          {},
        ],
      },
    });
  });

  it("carries every must-allow case FR-1 names, a declaration file among them", () => {
    expect(loaded()).toMatchObject({
      value: {
        clauses: [
          {
            cases: {
              allow: [
                { name: "declare class" },
                { name: "declare module" },
                { name: "declare global" },
                { name: "nested declare namespace" },
                { name: "declaration file", fileName: "x.d.ts" },
                { name: "library construction" },
              ],
            },
          },
          {},
        ],
      },
    });
  });
});
