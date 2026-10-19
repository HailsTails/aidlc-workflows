import { describe, expect, it, vi } from "vitest";
import type { Selection } from "../consumer-selection/consumer-selection.ts";
import type { FileTextPort } from "../platform-ports/file-text-port.ts";
import type { PathPort } from "../platform-ports/path-port.ts";
import { absolutePathSchema } from "../values/absolute-path.ts";
import { clauseAddressSchema } from "../values/clause-address.ts";
import { mechanismIdSchema } from "../values/identifiers.ts";
import {
  createExceptionRepository,
  parseExceptionEntries,
  readExceptionEntries,
} from "./exception-records.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const EXCEPTIONS_PATH = "/repo/discipline-exceptions.json";

const SELECTION: Selection = {
  selected: [
    { address: clauseAddressSchema.parse("CD-14#class-syntax"), mechanism: mechanismIdSchema.parse("walker") },
    { address: clauseAddressSchema.parse("team/TM-1#no-tmp-files"), mechanism: mechanismIdSchema.parse("eslint") },
  ],
  uncovered: [],
};

const WHY = {
  why: "why is the exception taken",
  because: "the matcher cannot express the tracker id",
  evidence: "plugins/rin/tools/rin-harness-why-chain.ts:9",
};

const CHAIN = {
  whys: [WHY, WHY, WHY, WHY, WHY],
  rootCause: "the walker's matcher predates the tracker id format",
  owner: "capture 01a0b421",
};

const SHORT_CHAIN = { ...CHAIN, whys: [WHY, WHY] };

const CLASS_SYNTAX = { ruleSet: "shared", discipline: "CD-14", clause: "class-syntax" };

const LOCATION = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
} as const;

const FILE_CARVE_OUT = {
  kind: "file-carve-out",
  clause: "CD-14#class-syntax",
  file: "src/legacy.ts",
  reason: "legacy class awaiting paydown",
  whyChain: CHAIN,
} as const;

const CLAUSE_WIDE = {
  kind: "clause-wide-carve-out",
  clause: "team/TM-1#no-tmp-files",
  reason: "the whole clause is held",
  whyChain: CHAIN,
} as const;

const fileTextReading = (request: { readonly text: string }): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
  write: vi.fn(),
});

const absentFileText = (): FileTextPort => ({
  read: vi
    .fn<FileTextPort["read"]>()
    .mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } }),
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
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

const readEntries = (request: { readonly fileText: FileTextPort }) =>
  readExceptionEntries({
    fileText: request.fileText,
    path: pathJoiningTo({ joined: EXCEPTIONS_PATH }),
    repoRoot: REPO_ROOT,
  });

const readEntriesOf = (request: { readonly text: string }) =>
  readEntries({ fileText: fileTextReading({ text: request.text }) });

describe("createExceptionRepository", () => {
  it("reads complete records against the supplied full selection and preserves original invalid indexes", () => {
    const path = pathJoiningTo({ joined: EXCEPTIONS_PATH });
    const repository = createExceptionRepository({
      repoRoot: REPO_ROOT,
      path,
      fileText: fileTextReading({ text: JSON.stringify({
        version: 1,
        exceptions: [LOCATION, { ...LOCATION, file: "../outside.ts" }, CLAUSE_WIDE, { ...LOCATION, reason: "duplicate record" }],
      }) }),
    });

    expect(repository.read({ selection: SELECTION })).toEqual({
      outcome: "ok",
      value: {
        records: [
          { kind: "authorised-location", clause: CLASS_SYNTAX, mechanism: "walker", file: "src/factory.ts", reason: LOCATION.reason },
          {
            kind: "clause-wide-carve-out",
            clause: { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" },
            mechanism: "eslint",
            reason: CLAUSE_WIDE.reason,
            whyChain: CHAIN,
          },
        ],
        invalid: [
          { index: 1, problem: { kind: "file-not-repo-path", file: "../outside.ts" } },
          { index: 3, problem: { kind: "duplicate", ofIndex: 0 } },
        ],
      },
    });
    expect(path.join).toHaveBeenCalledExactlyOnceWith({ segments: [REPO_ROOT, "discipline-exceptions.json"] });
  });

  it("preserves a canonical exception read failure without publishing empty records", () => {
    const repository = createExceptionRepository({
      repoRoot: REPO_ROOT,
      path: pathJoiningTo({ joined: EXCEPTIONS_PATH }),
      fileText: {
        read: vi.fn<FileTextPort["read"]>().mockReturnValue({
          outcome: "failed",
          error: { kind: "unreadable", path: EXCEPTIONS_PATH, detail: "EACCES" },
        }),
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present"),
        write: vi.fn(),
      },
    });

    expect(repository.read({ selection: SELECTION })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: EXCEPTIONS_PATH, detail: "EACCES" },
    });
  });
});

describe("parseExceptionEntries records", () => {
  it("parses an authorised location with the mechanism copied from the selection", () => {
    expect(parseExceptionEntries({ entries: [LOCATION], selection: SELECTION })).toEqual({
      records: [
        { kind: "authorised-location", clause: CLASS_SYNTAX, mechanism: "walker", file: "src/factory.ts", reason: LOCATION.reason },
      ],
      invalid: [],
    });
  });

  it("parses a file carve-out with its why-chain", () => {
    expect(parseExceptionEntries({ entries: [FILE_CARVE_OUT], selection: SELECTION })).toEqual({
      records: [
        {
          kind: "file-carve-out",
          clause: CLASS_SYNTAX,
          mechanism: "walker",
          file: "src/legacy.ts",
          reason: FILE_CARVE_OUT.reason,
          whyChain: CHAIN,
        },
      ],
      invalid: [],
    });
  });

  it("parses a clause-wide carve-out in a named rule set with that clause's mechanism", () => {
    expect(parseExceptionEntries({ entries: [CLAUSE_WIDE], selection: SELECTION })).toEqual({
      records: [
        {
          kind: "clause-wide-carve-out",
          clause: { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" },
          mechanism: "eslint",
          reason: CLAUSE_WIDE.reason,
          whyChain: CHAIN,
        },
      ],
      invalid: [],
    });
  });

  it("keeps two entries of different kinds for the same clause and file as two records", () => {
    const carveOut = { ...FILE_CARVE_OUT, file: "src/factory.ts" };

    expect(
      parseExceptionEntries({ entries: [LOCATION, carveOut], selection: SELECTION }).invalid,
    ).toEqual([]);
  });

  it("keeps two entries of the same kind and clause for different files as two records", () => {
    const other = { ...LOCATION, file: "src/other-factory.ts" };

    expect(
      parseExceptionEntries({ entries: [LOCATION, other], selection: SELECTION }).records,
    ).toHaveLength(2);
  });
});

describe("parseExceptionEntries invalid records", () => {
  it("is clause-unparseable for a clause that is not a clause address", () => {
    expect(
      parseExceptionEntries({ entries: [{ ...LOCATION, clause: "CD-14 class-syntax" }], selection: SELECTION }),
    ).toMatchObject({
      records: [],
      invalid: [{ index: 0, problem: { kind: "clause-unparseable", detail: expect.stringMatching(/.+/) } }],
    });
  });

  it("is clause-not-selected for a clause the selection does not hold", () => {
    expect(
      parseExceptionEntries({ entries: [{ ...LOCATION, clause: "CD-14#abstract-syntax" }], selection: SELECTION }),
    ).toEqual({
      records: [],
      invalid: [
        {
          index: 0,
          problem: { kind: "clause-not-selected", clause: { ruleSet: "shared", discipline: "CD-14", clause: "abstract-syntax" } },
        },
      ],
    });
  });

  it("is file-not-repo-path for a file that is not a RepoPath", () => {
    expect(
      parseExceptionEntries({ entries: [{ ...LOCATION, file: "../factory.ts" }], selection: SELECTION }),
    ).toEqual({
      records: [],
      invalid: [{ index: 0, problem: { kind: "file-not-repo-path", file: "../factory.ts" } }],
    });
  });

  it("is why-chain-refused for a file carve-out whose chain is refused", () => {
    expect(
      parseExceptionEntries({ entries: [{ ...FILE_CARVE_OUT, whyChain: SHORT_CHAIN }], selection: SELECTION }),
    ).toMatchObject({
      records: [],
      invalid: [{ index: 0, problem: { kind: "why-chain-refused", detail: expect.stringMatching(/.+/) } }],
    });
  });

  it("is why-chain-refused for a clause-wide carve-out whose chain is refused", () => {
    expect(
      parseExceptionEntries({ entries: [{ ...CLAUSE_WIDE, whyChain: "because" }], selection: SELECTION }),
    ).toMatchObject({
      records: [],
      invalid: [{ index: 0, problem: { kind: "why-chain-refused" } }],
    });
  });

  it("is a duplicate of the earlier valid entry with the same kind, clause and file", () => {
    expect(
      parseExceptionEntries({ entries: [LOCATION, { ...LOCATION, reason: "said again" }], selection: SELECTION }),
    ).toMatchObject({
      records: [{ kind: "authorised-location", file: "src/factory.ts", reason: LOCATION.reason }],
      invalid: [{ index: 1, problem: { kind: "duplicate", ofIndex: 0 } }],
    });
  });

  it("is a duplicate of an earlier clause-wide carve-out for the same clause", () => {
    expect(
      parseExceptionEntries({ entries: [CLAUSE_WIDE, CLAUSE_WIDE], selection: SELECTION }).invalid,
    ).toEqual([{ index: 1, problem: { kind: "duplicate", ofIndex: 0 } }]);
  });

  it("is not a duplicate of an earlier entry that was itself invalid", () => {
    expect(
      parseExceptionEntries({
        entries: [{ ...FILE_CARVE_OUT, whyChain: SHORT_CHAIN }, FILE_CARVE_OUT],
        selection: SELECTION,
      }),
    ).toMatchObject({
      records: [{ kind: "file-carve-out", file: "src/legacy.ts" }],
      invalid: [{ index: 0, problem: { kind: "why-chain-refused" } }],
    });
  });

  it("gives each invalid entry its position in the entries", () => {
    expect(
      parseExceptionEntries({
        entries: [LOCATION, FILE_CARVE_OUT, { ...LOCATION, file: "/abs/factory.ts" }],
        selection: SELECTION,
      }).invalid,
    ).toEqual([{ index: 2, problem: { kind: "file-not-repo-path", file: "/abs/factory.ts" } }]);
  });
});

describe("readExceptionEntries", () => {
  it("reads no exceptions when discipline-exceptions.json is absent", () => {
    expect(readEntries({ fileText: absentFileText() })).toEqual({ outcome: "ok", value: [] });
  });

  it("reads the joined path when it is present", () => {
    const fileText = fileTextReading({ text: JSON.stringify({ version: 1, exceptions: [] }) });

    readEntries({ fileText });

    expect(fileText.read).toHaveBeenCalledWith({ path: "/repo/discipline-exceptions.json" });
  });

  it("reads the entries of <repoRoot>/discipline-exceptions.json", () => {
    expect(
      readEntriesOf({ text: JSON.stringify({ version: 1, exceptions: [LOCATION, CLAUSE_WIDE] }) }),
    ).toEqual({ outcome: "ok", value: [LOCATION, CLAUSE_WIDE] });
  });

  it("is file-malformed when the text is not JSON", () => {
    expect(readEntriesOf({ text: "{ not json" })).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: EXCEPTIONS_PATH },
    });
  });

  it("is file-malformed when an entry does not match ExceptionsFile", () => {
    expect(
      readEntriesOf({
        text: JSON.stringify({ version: 1, exceptions: [{ kind: "authorised-location", clause: "CD-14#class-syntax" }] }),
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: EXCEPTIONS_PATH },
    });
  });

  it("is file-malformed for an unknown exception kind", () => {
    expect(
      readEntriesOf({
        text: JSON.stringify({ version: 1, exceptions: [{ ...LOCATION, kind: "blanket-waiver" }] }),
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: EXCEPTIONS_PATH },
    });
  });

  it("is file-malformed for a clause-wide carve-out carrying a file", () => {
    expect(
      readEntriesOf({
        text: JSON.stringify({ version: 1, exceptions: [{ ...CLAUSE_WIDE, file: "src/legacy.ts" }] }),
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: EXCEPTIONS_PATH },
    });
  });

  it("is file-malformed for an authorised location carrying an unknown key", () => {
    expect(
      readEntriesOf({
        text: JSON.stringify({ version: 1, exceptions: [{ ...LOCATION, expires: "2027-01-01" }] }),
      }),
    ).toMatchObject({
      outcome: "failed",
      error: { kind: "file-malformed", path: EXCEPTIONS_PATH },
    });
  });

  it("is unsupported-version with the found value for a version other than 1", () => {
    expect(readEntriesOf({ text: JSON.stringify({ version: 0, exceptions: [] }) })).toEqual({
      outcome: "failed",
      error: { kind: "unsupported-version", path: EXCEPTIONS_PATH, found: 0 },
    });
  });
});
