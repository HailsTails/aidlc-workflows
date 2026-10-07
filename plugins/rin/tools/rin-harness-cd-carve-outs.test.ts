import { basename, join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CARVE_OUT_DIR,
  carveOutDir,
  loadAllOwnedCarveOuts,
  loadCarveOutSidecarForCd,
  loadCarveOutsForCd,
  SENTINEL_SERVICE,
  sidecarName,
} from "./rin-harness-cd-carve-outs.ts";
import { legacyBaselineFor } from "./test-fixtures/r7-legacy-baseline.ts";
import type { SidecarFileReader } from "./rin-harness-sidecar-file-reader.ts";

const PROJECT_DIR = "/repo";

const fakeReader = (
  files: Readonly<Record<string, string>>,
): SidecarFileReader => {
  const withBaseline = {
    ...legacyBaselineFor({ files, projectDir: PROJECT_DIR }),
    ...files,
  };
  return {
    fileExists: (path) => Object.hasOwn(withBaseline, path),
    readFile: (path) => withBaseline[path],
    listDirectory: () => Object.keys(files).map((path) => basename(path)),
  };
};

const readerWithSidecar = ({
  cdId,
  contents,
}: {
  readonly cdId: string;
  readonly contents: string;
}): SidecarFileReader =>
  fakeReader({
    [join(carveOutDir(PROJECT_DIR), sidecarName(cdId))]: contents,
  });

describe("sidecarName", () => {
  test("derives the lowercase per-CD sidecar filename", () => {
    expect(sidecarName("CD-23")).toBe("cd-23.json");
  });
});

describe("carveOutDir", () => {
  test("resolves the carve-out directory under the project dir", () => {
    expect(carveOutDir("/repo")).toBe(join("/repo", CARVE_OUT_DIR));
  });
});

describe("loadCarveOutSidecarForCd", () => {
  test("loads an entry carrying files, reason, and decision", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([
        {
          files: ["scripts/ledger.ts"],
          reason: "unpaid debt",
          decision: "PR #123",
        },
      ]),
    });
    expect(
      loadCarveOutSidecarForCd({
        projectDir: PROJECT_DIR,
        cdId: "CD-23",
        reader,
      }),
    ).toEqual({
      outcome: "loaded",
      entries: [
        {
          cd: "CD-23",
          files: ["scripts/ledger.ts"],
          reason: "unpaid debt",
          decision: "PR #123",
        },
      ],
    });
  });

  test("grants nothing when the sidecar is absent", () => {
    const reader = fakeReader({});
    expect(
      loadCarveOutSidecarForCd({
        projectDir: PROJECT_DIR,
        cdId: "CD-23",
        reader,
      }),
    ).toEqual({
      outcome: "loaded",
      entries: [],
    });
  });

  test("names the offending entry index when decision is missing", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([
        { files: ["scripts/ledger.ts"], reason: "unpaid debt" },
      ]),
    });
    expect(
      loadCarveOutSidecarForCd({
        projectDir: PROJECT_DIR,
        cdId: "CD-23",
        reader,
      }),
    ).toEqual({
      outcome: "rejected",
      rejection: {
        sidecar: "cd-23.json",
        problem:
          "entry 0: `decision` is required and must be a non-empty string naming the carve-out's provenance",
      },
    });
  });

  test("rejects an entry whose decision is blank", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([
        {
          files: ["scripts/ledger.ts"],
          reason: "unpaid debt",
          decision: "   ",
        },
      ]),
    });
    const load = loadCarveOutSidecarForCd({
      projectDir: PROJECT_DIR,
      cdId: "CD-23",
      reader,
    });
    expect(load.outcome).toBe("rejected");
  });

  test("rejects an entry with no reason", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([
        { files: ["scripts/ledger.ts"], decision: "PR #123" },
      ]),
    });
    const load = loadCarveOutSidecarForCd({
      projectDir: PROJECT_DIR,
      cdId: "CD-23",
      reader,
    });
    expect(load.outcome).toBe("rejected");
  });

  test("rejects an entry with an empty files array", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([
        { files: [], reason: "unpaid debt", decision: "PR #123" },
      ]),
    });
    const load = loadCarveOutSidecarForCd({
      projectDir: PROJECT_DIR,
      cdId: "CD-23",
      reader,
    });
    expect(load.outcome).toBe("rejected");
  });

  test("rejects malformed JSON rather than granting the exemption", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: "[ { files: ",
    });
    expect(
      loadCarveOutSidecarForCd({
        projectDir: PROJECT_DIR,
        cdId: "CD-23",
        reader,
      }),
    ).toEqual({
      outcome: "rejected",
      rejection: {
        sidecar: "cd-23.json",
        problem: "sidecar is not valid JSON",
      },
    });
  });

  test("rejects a sidecar that exists but cannot be read", () => {
    const path = join(carveOutDir(PROJECT_DIR), sidecarName("CD-23"));
    const reader: SidecarFileReader = {
      fileExists: (candidate) => candidate === path,
      readFile: () => undefined,
      listDirectory: () => [],
    };
    expect(
      loadCarveOutSidecarForCd({
        projectDir: PROJECT_DIR,
        cdId: "CD-23",
        reader,
      }),
    ).toEqual({
      outcome: "rejected",
      rejection: {
        sidecar: "cd-23.json",
        problem: "sidecar exists but could not be read",
      },
    });
  });

  test("rejects a sidecar whose top level is not an array", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify({ files: ["scripts/ledger.ts"] }),
    });
    expect(
      loadCarveOutSidecarForCd({
        projectDir: PROJECT_DIR,
        cdId: "CD-23",
        reader,
      }),
    ).toEqual({
      outcome: "rejected",
      rejection: {
        sidecar: "cd-23.json",
        problem: "top level must be a JSON array",
      },
    });
  });
});

describe("loadCarveOutsForCd", () => {
  test("maps a valid sidecar entry to the vendored CarveOut shape", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([
        {
          files: ["scripts/ledger.ts"],
          reason: "unpaid debt",
          decision: "PR #123",
        },
      ]),
    });
    expect(
      loadCarveOutsForCd({ projectDir: PROJECT_DIR, cdId: "CD-23", reader }),
    ).toEqual([
      {
        service: SENTINEL_SERVICE,
        cdCode: "CD-23",
        spec: "PR #123",
        files: ["scripts/ledger.ts"],
      },
    ]);
  });
});

describe("loadAllOwnedCarveOuts", () => {
  test("aggregates owned carve-outs across every CD sidecar in the project dir", () => {
    const reader = fakeReader({
      [join(carveOutDir(PROJECT_DIR), sidecarName("CD-23"))]: JSON.stringify([
        { files: ["scripts/a.ts"], reason: "unpaid debt a", decision: "PR #1" },
      ]),
      [join(carveOutDir(PROJECT_DIR), sidecarName("CD-44"))]: JSON.stringify([
        { files: ["scripts/b.ts"], reason: "unpaid debt b", decision: "PR #2" },
      ]),
    });
    expect(loadAllOwnedCarveOuts({ projectDir: PROJECT_DIR, reader })).toEqual([
      {
        cd: "CD-23",
        files: ["scripts/a.ts"],
        reason: "unpaid debt a",
        decision: "PR #1",
      },
      {
        cd: "CD-44",
        files: ["scripts/b.ts"],
        reason: "unpaid debt b",
        decision: "PR #2",
      },
    ]);
  });
});
