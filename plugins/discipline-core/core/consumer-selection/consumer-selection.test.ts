import { describe, expect, it, vi } from "vitest";
import { requiredEntry } from "../../tests/required-entry.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { ruleSetNameSchema } from "../values/identifiers.ts";
import { repoPathSchema } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import { createSelectionRepository, type RuleSetLocation, readSelection, ruleSetRootOf } from "./consumer-selection.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const SELECTION_PATH = "/repo/disciplines.json";

type FakeFile = {
  readonly read: Result<
    string,
    { readonly kind: "unreadable"; readonly path: string; readonly detail: string }
  >;
  readonly presence: "present" | "absent";
};

const presentFile = (request: { readonly text: string }): FakeFile => ({
  read: { outcome: "ok", value: request.text },
  presence: "present",
});

const ABSENT_FILE: FakeFile = {
  read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } },
  presence: "absent",
};

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn(),
});

const JOINED_PATHS: Readonly<Record<string, string>> = {
  '["/repo","disciplines.json"]': "/repo/disciplines.json",
  '["/repo","team-rules"]': "/repo/team-rules",
  '["/repo","."]': "/repo",
  '["/repo","rules","TM-1","discipline.json"]': "/repo/rules/TM-1/discipline.json",
  '["/repo","mechanisms","walker","TM-1","piece.json"]': "/repo/mechanisms/walker/TM-1/piece.json",
  '["/repo","mechanisms","walker","TM-1"]': "/repo/mechanisms/walker/TM-1",
  '["/install","rules","CD-14","discipline.json"]': "/install/rules/CD-14/discipline.json",
  '["/install","rules","CD-99","discipline.json"]': "/install/rules/CD-99/discipline.json",
  '["/install","mechanisms","walker","CD-14","piece.json"]': "/install/mechanisms/walker/CD-14/piece.json",
  '["/install","mechanisms","walker","runner","runner.ts"]': "/install/mechanisms/walker/runner/runner.ts",
  '["/repo/team-rules","rules","TM-1","discipline.json"]': "/repo/team-rules/rules/TM-1/discipline.json",
  '["/repo/team-rules","mechanisms","walker","TM-1","piece.json"]': "/repo/team-rules/mechanisms/walker/TM-1/piece.json",
  '["/install","mechanisms","walker","CD-14"]': "/install/mechanisms/walker/CD-14",
  '["/repo/team-rules","mechanisms","walker","TM-1"]': "/repo/team-rules/mechanisms/walker/TM-1",
  '["/install","mechanisms","oxlint","runner","runner.ts"]': "/install/mechanisms/oxlint/runner/runner.ts",
  '["/install","mechanisms","oxlint","CD-14","piece.json"]': "/install/mechanisms/oxlint/CD-14/piece.json",
  '["/install","mechanisms","oxlint","CD-14"]': "/install/mechanisms/oxlint/CD-14",
  '["/repo/team-rules","rules","CD-14","discipline.json"]': "/repo/team-rules/rules/CD-14/discipline.json",
  '["/repo/team-rules","mechanisms","walker","CD-14","piece.json"]': "/repo/team-rules/mechanisms/walker/CD-14/piece.json",
  '["/repo/team-rules","mechanisms","walker","CD-14"]': "/repo/team-rules/mechanisms/walker/CD-14",
};

const TABLE_PATH: PathPort = {
  join: ({ segments }) => requiredEntry({ table: JOINED_PATHS, key: JSON.stringify(segments) }),
  relative: vi.fn(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: ({ path }) => ({ outcome: "ok", value: absolutePathSchema.parse(path) }),
  fromFileUrl: vi.fn(),
};

const CASES = {
  flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
  allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
};

const mechanical = (id: string) => ({
  kind: "mechanical",
  id,
  summary: "a mechanical clause",
  mechanisms: ["walker"],
  anchor: { kind: "keyword", keyword: "class" },
  cases: CASES,
});

const CD_14 = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [
    mechanical("class-syntax"),
    mechanical("abstract-syntax"),
    { kind: "judgement", id: "library-construction", summary: "wrap libraries", enforcedBy: "review" },
  ],
});

const CD_14_WITH_THREE_MECHANICAL = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [
    mechanical("class-syntax"),
    mechanical("abstract-syntax"),
    mechanical("decorator-syntax"),
    { kind: "judgement", id: "library-construction", summary: "wrap libraries", enforcedBy: "review" },
  ],
});

const CD_14_PIECE = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "walker",
  clauses: [
    { clause: "class-syntax", settings: { module: "class-syntax.ts" } },
    { clause: "abstract-syntax", settings: { module: "abstract-syntax.ts" } },
  ],
});

const CD_14_ON_TWO_MECHANISMS = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [
    { ...mechanical("class-syntax"), mechanisms: ["walker", "oxlint"] },
    { ...mechanical("abstract-syntax"), mechanisms: ["walker", "oxlint"] },
  ],
});

const CD_14_OXLINT_PIECE = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "oxlint",
  clauses: [{ clause: "abstract-syntax", settings: { rule: "no-abstract" } }],
});

const TEAM_CD_14 = JSON.stringify({
  version: 1,
  id: "CD-14",
  clauses: [
    {
      kind: "mechanical",
      id: "class-syntax",
      summary: "the team's own class clause",
      mechanisms: ["walker"],
      anchor: { kind: "keyword", keyword: "enum" },
      cases: CASES,
    },
  ],
});

const TEAM_CD_14_PIECE = JSON.stringify({
  version: 1,
  discipline: "CD-14",
  mechanism: "walker",
  clauses: [{ clause: "class-syntax", settings: { module: "team-class-syntax.ts" } }],
});

const TM_1 = JSON.stringify({ version: 1, id: "TM-1", clauses: [mechanical("no-tmp-files")] });

const TM_1_PIECE = JSON.stringify({
  version: 1,
  discipline: "TM-1",
  mechanism: "walker",
  clauses: [{ clause: "no-tmp-files", settings: { module: "no-tmp-files.ts" } }],
});

const INSTALL: Readonly<Record<string, FakeFile>> = {
  [SELECTION_PATH]: ABSENT_FILE,
  "/install/rules/CD-14/discipline.json": presentFile({ text: CD_14 }),
  "/install/rules/CD-99/discipline.json": ABSENT_FILE,
  "/install/mechanisms/walker/CD-14/piece.json": presentFile({ text: CD_14_PIECE }),
  "/install/mechanisms/walker/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/team-rules/rules/TM-1/discipline.json": presentFile({ text: TM_1 }),
  "/repo/team-rules/mechanisms/walker/TM-1/piece.json": presentFile({ text: TM_1_PIECE }),
};

const select = (files: Readonly<Record<string, FakeFile>>) =>
  readSelection({
    fileText: fileTextOver(files),
    path: TABLE_PATH,
    repoRoot: REPO_ROOT,
    installRoot: INSTALL_ROOT,
  });

const selecting = (selection: unknown) =>
  select({ ...INSTALL, [SELECTION_PATH]: presentFile({ text: JSON.stringify(selection) }) });

describe("createSelectionRepository", () => {
  it("reads the complete canonical selection with shared and named bindings and uncovered clauses", () => {
    const repository = createSelectionRepository({
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      path: TABLE_PATH,
      fileText: fileTextOver({
        ...INSTALL,
        [SELECTION_PATH]: presentFile({ text: JSON.stringify({
          version: 1,
          ruleSets: { team: "team-rules" },
          clauses: { "CD-14#class-syntax": "walker", "team/TM-1#no-tmp-files": "walker" },
        }) }),
      }),
    });

    expect(repository.read({})).toEqual({
      outcome: "ok",
      value: {
        selection: {
          selected: [
            { address: { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" }, mechanism: "walker" },
            { address: { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" }, mechanism: "walker" },
          ],
          uncovered: [{ ruleSet: "shared", discipline: "CD-14", clause: "abstract-syntax" }],
        },
        bindings: [
          {
            mechanism: "walker",
            clause: {
              address: { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" },
              anchor: { kind: "keyword", keyword: "class" },
              pieceRoot: "/install/mechanisms/walker/CD-14",
              settings: { module: "class-syntax.ts" },
            },
          },
          {
            mechanism: "walker",
            clause: {
              address: { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" },
              anchor: { kind: "keyword", keyword: "class" },
              pieceRoot: "/repo/team-rules/mechanisms/walker/TM-1",
              settings: { module: "no-tmp-files.ts" },
            },
          },
        ],
      },
    });
  });

  it("preserves the canonical selection read failure at the captured repository root", () => {
    const repository = createSelectionRepository({
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      path: TABLE_PATH,
      fileText: fileTextOver({
        ...INSTALL,
        [SELECTION_PATH]: {
          presence: "present",
          read: { outcome: "failed", error: { kind: "unreadable", path: SELECTION_PATH, detail: "EACCES" } },
        },
      }),
    });

    expect(repository.read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: SELECTION_PATH, detail: "EACCES" },
    });
  });

  it("preserves malformed canonical selection failure instead of returning an empty adoption", () => {
    const repository = createSelectionRepository({
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      path: TABLE_PATH,
      fileText: fileTextOver({ ...INSTALL, [SELECTION_PATH]: presentFile({ text: "{" }) }),
    });

    expect(repository.read({})).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH, detail: expect.any(String) },
    });
  });
});

describe("readSelection", () => {
  it("selects a shared clause, rooted at the install, with its mechanism", () => {
    expect(
      selecting({
        version: 1,
        ruleSets: {},
        clauses: { "CD-14#class-syntax": "walker", "CD-14#abstract-syntax": "walker" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        selection: {
          selected: [
            { address: { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" }, mechanism: "walker" },
            { address: { ruleSet: "shared", discipline: "CD-14", clause: "abstract-syntax" }, mechanism: "walker" },
          ],
          uncovered: [],
        },
        bindings: [
          {
            mechanism: "walker",
            clause: {
              address: { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" },
              anchor: { kind: "keyword", keyword: "class" },
              pieceRoot: "/install/mechanisms/walker/CD-14",
              settings: { module: "class-syntax.ts" },
            },
          },
          {
            mechanism: "walker",
            clause: {
              address: { ruleSet: "shared", discipline: "CD-14", clause: "abstract-syntax" },
              anchor: { kind: "keyword", keyword: "class" },
              pieceRoot: "/install/mechanisms/walker/CD-14",
              settings: { module: "abstract-syntax.ts" },
            },
          },
        ],
      },
    });
  });

  it("selects a named rule set's clause from a directory relative to the repo root", () => {
    expect(
      selecting({
        version: 1,
        ruleSets: { team: "team-rules" },
        clauses: { "team/TM-1#no-tmp-files": "walker" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        selection: {
          selected: [
            { address: { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" }, mechanism: "walker" },
          ],
          uncovered: [],
        },
        bindings: [
          {
            mechanism: "walker",
            clause: {
              address: { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" },
              anchor: { kind: "keyword", keyword: "class" },
              pieceRoot: "/repo/team-rules/mechanisms/walker/TM-1",
              settings: { module: "no-tmp-files.ts" },
            },
          },
        ],
      },
    });
  });

  it("lists the unlisted mechanical clauses of an adopted discipline as uncovered, never its judgement clauses", () => {
    expect(
      selecting({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "walker" } }),
    ).toEqual({
      outcome: "ok",
      value: {
        selection: {
          selected: [
            { address: { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" }, mechanism: "walker" },
          ],
          uncovered: [{ ruleSet: "shared", discipline: "CD-14", clause: "abstract-syntax" }],
        },
        bindings: [expect.objectContaining({ mechanism: "walker" })],
      },
    });
  });

  it("lists an unlisted mechanical clause once when two clauses of its discipline are selected", () => {
    expect(
      select({
        ...INSTALL,
        "/install/rules/CD-14/discipline.json": presentFile({ text: CD_14_WITH_THREE_MECHANICAL }),
        [SELECTION_PATH]: presentFile({
          text: JSON.stringify({
            version: 1,
            ruleSets: {},
            clauses: { "CD-14#class-syntax": "walker", "CD-14#abstract-syntax": "walker" },
          }),
        }),
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { selection: { uncovered: [{ ruleSet: "shared", discipline: "CD-14", clause: "decorator-syntax" }] } },
    });
  });

  it("reads a discipline's discipline.json and piece.json once each when two of its clauses are selected", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({
        outcome: "ok",
        value: JSON.stringify({
          version: 1,
          ruleSets: {},
          clauses: { "CD-14#class-syntax": "walker", "CD-14#abstract-syntax": "walker" },
        }),
      })
      .mockReturnValueOnce({ outcome: "ok", value: CD_14 })
      .mockReturnValue({ outcome: "ok", value: CD_14_PIECE });
    readSelection({
      fileText: { ...fileTextOver(INSTALL), read },
      path: TABLE_PATH,
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
    });
    expect(read.mock.calls).toEqual([
      [{ path: SELECTION_PATH }],
      [{ path: "/install/rules/CD-14/discipline.json" }],
      [{ path: "/install/mechanisms/walker/CD-14/piece.json" }],
    ]);
  });

  it("reads each mechanism's own piece when two clauses of one discipline select different mechanisms", () => {
    expect(
      select({
        ...INSTALL,
        "/install/rules/CD-14/discipline.json": presentFile({ text: CD_14_ON_TWO_MECHANISMS }),
        "/install/mechanisms/oxlint/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
        "/install/mechanisms/oxlint/CD-14/piece.json": presentFile({ text: CD_14_OXLINT_PIECE }),
        [SELECTION_PATH]: presentFile({
          text: JSON.stringify({
            version: 1,
            ruleSets: {},
            clauses: { "CD-14#class-syntax": "walker", "CD-14#abstract-syntax": "oxlint" },
          }),
        }),
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        bindings: [
          { mechanism: "walker", clause: { settings: { module: "class-syntax.ts" } } },
          {
            mechanism: "oxlint",
            clause: { pieceRoot: "/install/mechanisms/oxlint/CD-14", settings: { rule: "no-abstract" } },
          },
        ],
      },
    });
  });

  it("is piece-missing for the second mechanism of a discipline whose first mechanism's piece covers the clause", () => {
    expect(
      select({
        ...INSTALL,
        "/install/rules/CD-14/discipline.json": presentFile({ text: CD_14_ON_TWO_MECHANISMS }),
        "/install/mechanisms/oxlint/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
        "/install/mechanisms/oxlint/CD-14/piece.json": ABSENT_FILE,
        [SELECTION_PATH]: presentFile({
          text: JSON.stringify({
            version: 1,
            ruleSets: {},
            clauses: { "CD-14#class-syntax": "walker", "CD-14#abstract-syntax": "oxlint" },
          }),
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "CD-14#abstract-syntax", mechanism: "oxlint" },
    });
  });

  it("reads a named rule set's own discipline and piece for a discipline id the shared rule set also holds", () => {
    expect(
      select({
        ...INSTALL,
        "/repo/team-rules/rules/CD-14/discipline.json": presentFile({ text: TEAM_CD_14 }),
        "/repo/team-rules/mechanisms/walker/CD-14/piece.json": presentFile({ text: TEAM_CD_14_PIECE }),
        [SELECTION_PATH]: presentFile({
          text: JSON.stringify({
            version: 1,
            ruleSets: { team: "team-rules" },
            clauses: { "CD-14#class-syntax": "walker", "team/CD-14#class-syntax": "walker" },
          }),
        }),
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        bindings: [
          {
            mechanism: "walker",
            clause: {
              address: { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" },
              anchor: { kind: "keyword", keyword: "class" },
              settings: { module: "class-syntax.ts" },
            },
          },
          {
            mechanism: "walker",
            clause: {
              address: { ruleSet: { name: "team" }, discipline: "CD-14", clause: "class-syntax" },
              anchor: { kind: "keyword", keyword: "enum" },
              pieceRoot: "/repo/team-rules/mechanisms/walker/CD-14",
              settings: { module: "team-class-syntax.ts" },
            },
          },
        ],
      },
    });
  });

  it("adopts no discipline none of whose clauses is listed", () => {
    expect(
      selecting({
        version: 1,
        ruleSets: { team: "team-rules" },
        clauses: { "team/TM-1#no-tmp-files": "walker" },
      }),
    ).toMatchObject({ outcome: "ok", value: { selection: { uncovered: [] } } });
  });

  it("is file-unreadable when disciplines.json cannot be read", () => {
    expect(select(INSTALL)).toMatchObject({
      outcome: "failed",
      error: { kind: "file-unreadable", path: SELECTION_PATH },
    });
  });

  it("is file-malformed when disciplines.json is not JSON", () => {
    expect(select({ ...INSTALL, [SELECTION_PATH]: presentFile({ text: "{ not json" }) })).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH },
    });
  });

  it("is unsupported-version with the found value for a version other than 1", () => {
    expect(selecting({ version: 2, ruleSets: {}, clauses: {} })).toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: SELECTION_PATH, found: 2 },
    });
  });

  it("refuses an extra top-level key as file-malformed", () => {
    expect(
      selecting({ version: 1, ruleSets: {}, clauses: {}, mechanisms: {} }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH },
    });
  });

  it("refuses a clauses key that is not a clause address as file-malformed", () => {
    expect(
      selecting({ version: 1, ruleSets: {}, clauses: { "CD-14 class-syntax": "walker" } }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH },
    });
  });

  it("refuses a ruleSets key that is not a rule-set name as file-malformed", () => {
    expect(
      selecting({ version: 1, ruleSets: { Team: "team-rules" }, clauses: {} }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH },
    });
  });

  it("refuses a ruleSets value that is not a string as file-malformed", () => {
    expect(
      selecting({ version: 1, ruleSets: { team: 7 }, clauses: {} }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH },
    });
  });

  it("refuses a ruleSets value written with a backslash as file-malformed", () => {
    expect(
      selecting({ version: 1, ruleSets: { team: "tools\\disciplines" }, clauses: {} }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH },
    });
  });

  it("refuses an absolute ruleSets value as file-malformed", () => {
    expect(
      selecting({ version: 1, ruleSets: { team: "/abs" }, clauses: {} }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH },
    });
  });

  it("roots a named rule set declared as . at the repo root", () => {
    expect(
      select({
        ...INSTALL,
        [SELECTION_PATH]: presentFile({
          text: JSON.stringify({ version: 1, ruleSets: { team: "." }, clauses: { "team/TM-1#no-tmp-files": "walker" } }),
        }),
        "/repo/rules/TM-1/discipline.json": presentFile({ text: TM_1 }),
        "/repo/mechanisms/walker/TM-1/piece.json": presentFile({ text: TM_1_PIECE }),
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { bindings: [{ clause: { pieceRoot: "/repo/mechanisms/walker/TM-1" } }] },
    });
  });

  it("refuses a clauses value that is not a mechanism id as file-malformed", () => {
    expect(
      selecting({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "Walker" } }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH },
    });
  });

  it("refuses the rule-set name shared as reserved-rule-set-name", () => {
    expect(
      selecting({ version: 1, ruleSets: { shared: "team-rules" }, clauses: {} }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "reserved-rule-set-name", name: "shared" },
    });
  });

  it("is unknown-rule-set for a clause naming a rule set the file does not declare", () => {
    expect(
      selecting({ version: 1, ruleSets: {}, clauses: { "team/TM-1#no-tmp-files": "walker" } }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unknown-rule-set", name: "team" },
    });
  });

  it("is unknown-discipline for a discipline the rule set does not hold", () => {
    expect(
      selecting({ version: 1, ruleSets: {}, clauses: { "CD-99#class-syntax": "walker" } }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unknown-discipline", address: "CD-99#class-syntax" },
    });
  });

  it("is unknown-clause for a clause the discipline does not declare", () => {
    expect(
      selecting({ version: 1, ruleSets: {}, clauses: { "CD-14#no-such-clause": "walker" } }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unknown-clause", address: "CD-14#no-such-clause" },
    });
  });

  it("is judgement-clause-selected for a judgement clause", () => {
    expect(
      selecting({ version: 1, ruleSets: {}, clauses: { "CD-14#library-construction": "walker" } }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "judgement-clause-selected", address: "CD-14#library-construction" },
    });
  });

  it("is mechanism-not-allowed for a mechanism the clause does not list", () => {
    expect(
      selecting({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "oxlint" } }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "mechanism-not-allowed", address: "CD-14#class-syntax", mechanism: "oxlint" },
    });
  });

  it("is runner-missing when <install>/mechanisms/<id>/runner/runner.ts is absent", () => {
    expect(
      select({
        ...INSTALL,
        "/install/mechanisms/walker/runner/runner.ts": ABSENT_FILE,
        [SELECTION_PATH]: presentFile({
          text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "walker" } }),
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "runner-missing", mechanism: "walker" },
    });
  });

  it("is piece-missing when the clause's rule set has no piece for the mechanism and discipline", () => {
    expect(
      select({
        ...INSTALL,
        "/install/mechanisms/walker/CD-14/piece.json": ABSENT_FILE,
        [SELECTION_PATH]: presentFile({
          text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "walker" } }),
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "CD-14#class-syntax", mechanism: "walker" },
    });
  });

  it("is piece-missing when the piece has no entry for the clause", () => {
    expect(
      select({
        ...INSTALL,
        "/install/mechanisms/walker/CD-14/piece.json": presentFile({
          text: JSON.stringify({
            version: 1,
            discipline: "CD-14",
            mechanism: "walker",
            clauses: [{ clause: "abstract-syntax", settings: {} }],
          }),
        }),
        [SELECTION_PATH]: presentFile({
          text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "walker" } }),
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "CD-14#class-syntax", mechanism: "walker" },
    });
  });

  it("carries a selected discipline file's refusal as rule-set-invalid", () => {
    expect(
      select({
        ...INSTALL,
        "/install/rules/CD-14/discipline.json": presentFile({
          text: JSON.stringify({ version: 1, id: "CD-15", clauses: [mechanical("class-syntax")] }),
        }),
        [SELECTION_PATH]: presentFile({
          text: JSON.stringify({ version: 1, ruleSets: {}, clauses: { "CD-14#class-syntax": "walker" } }),
        }),
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: "/install/rules/CD-14/discipline.json" },
    });
  });
});

const RESOLVING_PATH: PathPort = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/./rules/team"),
  relative: vi.fn(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({ outcome: "ok", value: absolutePathSchema.parse("/repo/rules/team") }),
  fromFileUrl: vi.fn(),
};

const UNRESOLVABLE_PATH: PathPort = {
  join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/rules/team"),
  relative: vi.fn(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({
    outcome: "failed",
    error: { kind: "working-directory-unusable", path: "/repo/rules/team" },
  }),
  fromFileUrl: vi.fn(),
};

const TEAM_RULE_SETS: Readonly<Record<string, RuleSetLocation>> = {
  team: { location: "folder", path: repoPathSchema.parse("rules/team") },
};

describe("ruleSetRootOf", () => {
  it("roots the shared rule set at the install root", () => {
    expect(
      ruleSetRootOf({
        ruleSet: "shared",
        ruleSets: TEAM_RULE_SETS,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: RESOLVING_PATH,
      }),
    ).toEqual({ outcome: "ok", value: "/install" });
  });

  it("roots a named rule set at the resolved join of the repo root and its declared directory", () => {
    const path: PathPort = {
      ...RESOLVING_PATH,
      join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/./rules/team"),
      resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({ outcome: "ok", value: absolutePathSchema.parse("/repo/rules/team") }),
    };
    const root = ruleSetRootOf({
      ruleSet: { name: ruleSetNameSchema.parse("team") },
      ruleSets: TEAM_RULE_SETS,
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      path,
    });
    expect({
      root,
      joins: vi.mocked(path.join).mock.calls,
      resolves: vi.mocked(path.resolve).mock.calls,
    }).toEqual({
      root: { outcome: "ok", value: "/repo/rules/team" },
      joins: [[{ segments: ["/repo", "rules/team"] }]],
      resolves: [[{ path: "/repo/./rules/team" }]],
    });
  });

  it("is unknown-rule-set for a named rule set the consumer file does not declare", () => {
    expect(
      ruleSetRootOf({
        ruleSet: { name: ruleSetNameSchema.parse("ghost") },
        ruleSets: TEAM_RULE_SETS,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: RESOLVING_PATH,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "unknown-rule-set", name: "ghost" } });
  });

  it("is rule-set-invalid at the joined directory when a named rule set's directory resolves to no absolute path", () => {
    expect(
      ruleSetRootOf({
        ruleSet: { name: ruleSetNameSchema.parse("team") },
        ruleSets: TEAM_RULE_SETS,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: UNRESOLVABLE_PATH,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        path: "/repo/rules/team",
        detail: "the directory of rule set team resolves to no absolute path",
      },
    });
  });
});
