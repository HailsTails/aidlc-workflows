import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../core/platform-ports/file-text-port.ts";
import type { PathPort } from "../../core/platform-ports/path-port.ts";
import { readDisciplineFile } from "../../core/rule-set-reader/rule-set-reader.ts";
import { absolutePathSchema } from "../../core/values/absolute-path.ts";
import { disciplineIdSchema } from "../../core/values/identifiers.ts";
import { requiredEntry } from "../../tests/required-entry.ts";
import discipline from "./discipline.json" with { type: "json" };

const fileText: FileTextPort = {
  read: () => ({ outcome: "ok", value: JSON.stringify(discipline) }),
  exists: () => "present",
  write: () => ({ outcome: "ok", value: undefined }),
};

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/install","rules","CD-14","discipline.json"]': "/install/rules/CD-14/discipline.json",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const loaded = () =>
  readDisciplineFile({
    fileText,
    path: TABLE_PATH,
    ruleSetRoot: absolutePathSchema.parse("/install"),
    discipline: disciplineIdSchema.parse("CD-14"),
  });

describe("CD-14 discipline.json", () => {
  it("states class syntax as a mechanical clause the audit and ESLint decide at the class keyword", () => {
    expect(loaded()).toMatchObject({
      outcome: "ok",
      value: {
        version: 1,
        id: "CD-14",
        clauses: [
          {
            kind: "mechanical",
            id: "class-syntax",
            mechanisms: ["audit", "eslint"],
            anchor: { kind: "keyword", keyword: "class" },
          },
          { kind: "judgement", id: "library-construction", enforcedBy: "review" },
          {
            kind: "mechanical",
            id: "static-only-class",
            mechanisms: ["eslint"],
            anchor: { kind: "keyword", keyword: "class" },
          },
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
          {},
        ],
      },
    });
  });
});
