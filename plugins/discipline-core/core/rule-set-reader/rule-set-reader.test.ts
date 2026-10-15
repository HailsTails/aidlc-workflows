import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import {
  clauseIdSchema,
  disciplineIdSchema,
  mechanismIdSchema,
} from "../values/identifiers.ts";
import {
  type DisciplineFile,
  readDisciplineFile,
  readPieceFile,
} from "./rule-set-reader.ts";

const ROOT = absolutePathSchema.parse("/install");
const CD_14 = disciplineIdSchema.parse("CD-14");
const WALKER = mechanismIdSchema.parse("walker");
const DISCIPLINE_PATH = "/install/rules/CD-14/discipline.json";
const PIECE_PATH = "/install/mechanisms/walker/CD-14/piece.json";

const fileTextReading = (request: { readonly text: string }): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
  exists: vi.fn(),
  write: vi.fn(),
});

const unreadableFileText = (): FileTextPort => ({
  read: vi
    .fn<FileTextPort["read"]>()
    .mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } }),
  exists: vi.fn(),
  write: vi.fn(),
});

const pathJoiningTo = (request: { readonly joined: string }): PathPort => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue(request.joined),
  relative: vi.fn(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn(),
  fromFileUrl: vi.fn(),
});

const FLAG_CASE = {
  name: "class declaration",
  fileName: "src/a.ts",
  source: "class A {}\n",
  expectedLines: [1],
};

const ALLOW_CASE = {
  name: "arrow function",
  fileName: "src/b.ts",
  source: "const b = () => 1;\n",
  expectedLines: [],
};

const CLASS_SYNTAX = {
  kind: "mechanical",
  id: "class-syntax",
  summary: "no class syntax",
  mechanisms: ["walker", "eslint"],
  anchor: { kind: "keyword", keyword: "class" },
  cases: { flag: [FLAG_CASE], allow: [ALLOW_CASE] },
};

const LIBRARY_CONSTRUCTION = {
  kind: "judgement",
  id: "library-construction",
  summary: "wrap libraries in factories",
  enforcedBy: "review",
};

const DISCIPLINE = {
  version: 1,
  id: "CD-14",
  clauses: [CLASS_SYNTAX, LIBRARY_CONSTRUCTION],
};

const PIECE = {
  version: 1,
  discipline: "CD-14",
  mechanism: "walker",
  clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }],
};

const readDiscipline = (file: unknown) =>
  readDisciplineFile({
    fileText: fileTextReading({ text: JSON.stringify(file) }),
    path: pathJoiningTo({ joined: DISCIPLINE_PATH }),
    ruleSetRoot: ROOT,
    discipline: CD_14,
  });

const LOADED_DISCIPLINE: DisciplineFile = {
  version: 1,
  id: CD_14,
  clauses: [
    {
      kind: "mechanical",
      id: clauseIdSchema.parse("class-syntax"),
      summary: CLASS_SYNTAX.summary,
      mechanisms: [WALKER, mechanismIdSchema.parse("eslint")],
      anchor: { kind: "keyword", keyword: "class" },
      cases: { flag: [], allow: [] },
    },
  ],
};

const readPiece = (file: unknown) =>
  readPieceFile({
    fileText: fileTextReading({ text: JSON.stringify(file) }),
    path: pathJoiningTo({ joined: PIECE_PATH }),
    ruleSetRoot: ROOT,
    mechanism: WALKER,
    discipline: LOADED_DISCIPLINE,
  });

describe("readDisciplineFile", () => {
  it("reads <ruleSetRoot>/rules/<discipline>/discipline.json into a discipline file", () => {
    expect(readDiscipline(DISCIPLINE)).toEqual({ outcome: "ok", value: DISCIPLINE });
  });

  it("allows a case fileName ending .d.ts", () => {
    const file = {
      ...DISCIPLINE,
      clauses: [
        { ...CLASS_SYNTAX, cases: { flag: [{ ...FLAG_CASE, fileName: "types/ambient.d.ts" }], allow: [ALLOW_CASE] } },
      ],
    };

    expect(readDiscipline(file)).toEqual({ outcome: "ok", value: file });
  });

  it("reads the joined discipline path", () => {
    const fileText = fileTextReading({ text: JSON.stringify(DISCIPLINE) });

    readDisciplineFile({
      fileText,
      path: pathJoiningTo({ joined: DISCIPLINE_PATH }),
      ruleSetRoot: ROOT,
      discipline: CD_14,
    });

    expect(fileText.read).toHaveBeenCalledWith({ path: "/install/rules/CD-14/discipline.json" });
  });

  it("is file-unreadable with the path when the file cannot be read", () => {
    const disciplineRead = readDisciplineFile({
      fileText: unreadableFileText(),
      path: pathJoiningTo({ joined: DISCIPLINE_PATH }),
      ruleSetRoot: ROOT,
      discipline: CD_14,
    });

    expect(disciplineRead).toMatchObject({
      outcome: "failed",
      error: { kind: "file-unreadable", path: DISCIPLINE_PATH },
    });
  });

  it("is file-malformed with the path when the text is not JSON", () => {
    const disciplineRead = readDisciplineFile({
      fileText: fileTextReading({ text: "{ not json" }),
      path: pathJoiningTo({ joined: DISCIPLINE_PATH }),
      ruleSetRoot: ROOT,
      discipline: CD_14,
    });

    expect(disciplineRead).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: DISCIPLINE_PATH },
    });
  });

  it("is file-malformed when the shape does not match", () => {
    expect(readDiscipline({ version: 1, id: "CD-14" })).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: DISCIPLINE_PATH },
    });
  });

  it("is unsupported-version with the found value for a version other than 1", () => {
    expect(readDiscipline({ ...DISCIPLINE, version: 2 })).toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: DISCIPLINE_PATH, found: 2 },
    });
  });

  it("refuses an id that differs from its folder name as rule-set-invalid", () => {
    expect(readDiscipline({ ...DISCIPLINE, id: "CD-15" })).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses duplicate clause ids as rule-set-invalid", () => {
    expect(
      readDiscipline({ ...DISCIPLINE, clauses: [CLASS_SYNTAX, CLASS_SYNTAX] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses a mechanical clause with no mechanism as rule-set-invalid", () => {
    expect(
      readDiscipline({ ...DISCIPLINE, clauses: [{ ...CLASS_SYNTAX, mechanisms: [] }] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses a mechanical clause with no flag case as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [{ ...CLASS_SYNTAX, cases: { flag: [], allow: [ALLOW_CASE] } }],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses a mechanical clause with no allow case as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [{ ...CLASS_SYNTAX, cases: { flag: [FLAG_CASE], allow: [] } }],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses an allow case with expected lines as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [
          { ...CLASS_SYNTAX, cases: { flag: [FLAG_CASE], allow: [{ ...ALLOW_CASE, expectedLines: [1] }] } },
        ],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses a flag case with no expected lines as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [
          { ...CLASS_SYNTAX, cases: { flag: [{ ...FLAG_CASE, expectedLines: [] }], allow: [ALLOW_CASE] } },
        ],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });

  it("refuses a case fileName that is not a RepoPath as rule-set-invalid", () => {
    expect(
      readDiscipline({
        ...DISCIPLINE,
        clauses: [
          { ...CLASS_SYNTAX, cases: { flag: [{ ...FLAG_CASE, fileName: "../a.ts" }], allow: [ALLOW_CASE] } },
        ],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: DISCIPLINE_PATH },
    });
  });
});

describe("readPieceFile", () => {
  it("reads <ruleSetRoot>/mechanisms/<mechanism>/<discipline>/piece.json into a piece file", () => {
    expect(readPiece(PIECE)).toEqual({ outcome: "ok", value: PIECE });
  });

  it("keeps each entry's settings uninterpreted", () => {
    const piece = {
      ...PIECE,
      clauses: [{ clause: "class-syntax", settings: { anything: [1, "two"] } }],
    };

    expect(readPiece(piece)).toEqual({ outcome: "ok", value: piece });
  });

  it("reads the joined piece path", () => {
    const fileText = fileTextReading({ text: JSON.stringify(PIECE) });

    readPieceFile({
      fileText,
      path: pathJoiningTo({ joined: PIECE_PATH }),
      ruleSetRoot: ROOT,
      mechanism: WALKER,
      discipline: LOADED_DISCIPLINE,
    });

    expect(fileText.read).toHaveBeenCalledWith({
      path: "/install/mechanisms/walker/CD-14/piece.json",
    });
  });

  it("is file-unreadable with the path when the piece cannot be read", () => {
    const pieceRead = readPieceFile({
      fileText: unreadableFileText(),
      path: pathJoiningTo({ joined: PIECE_PATH }),
      ruleSetRoot: ROOT,
      mechanism: WALKER,
      discipline: LOADED_DISCIPLINE,
    });

    expect(pieceRead).toMatchObject({
      outcome: "failed",
      error: { kind: "file-unreadable", path: PIECE_PATH },
    });
  });

  it("is file-malformed when the shape does not match", () => {
    expect(readPiece({ version: 1, discipline: "CD-14" })).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: PIECE_PATH },
    });
  });

  it("is unsupported-version with the found value for a version other than 1", () => {
    expect(readPiece({ ...PIECE, version: 3 })).toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: PIECE_PATH, found: 3 },
    });
  });

  it("refuses a discipline that differs from its folder name as rule-set-invalid", () => {
    expect(readPiece({ ...PIECE, discipline: "CD-15" })).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: PIECE_PATH },
    });
  });

  it("refuses a mechanism that differs from its folder name as rule-set-invalid", () => {
    expect(readPiece({ ...PIECE, mechanism: "eslint" })).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: PIECE_PATH },
    });
  });

  it("refuses a clause id not in the discipline as rule-set-invalid", () => {
    expect(
      readPiece({ ...PIECE, clauses: [{ clause: "no-such-clause", settings: {} }] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: PIECE_PATH },
    });
  });

  it("refuses duplicate clause entries as rule-set-invalid", () => {
    expect(
      readPiece({ ...PIECE, clauses: [PIECE.clauses[0], PIECE.clauses[0]] }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "rule-set-invalid", path: PIECE_PATH },
    });
  });
});
