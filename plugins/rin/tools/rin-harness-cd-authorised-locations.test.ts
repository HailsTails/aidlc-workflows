import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  AUTHORISED_LOCATION_DIR,
  authorisedLocationDir,
  loadSidecarForCd,
  sidecarName,
} from "./rin-harness-cd-authorised-locations.ts";
import type { SidecarFileReader } from "./rin-harness-sidecar-file-reader.ts";

const PROJECT_DIR = "/repo";

const fakeReader = (
  files: Readonly<Record<string, string>>,
): SidecarFileReader => ({
  fileExists: (path) => Object.hasOwn(files, path),
  readFile: (path) => files[path],
  listDirectory: () => Object.keys(files),
});

const readerWithSidecar = ({
  cdId,
  contents,
}: {
  readonly cdId: string;
  readonly contents: string;
}): SidecarFileReader =>
  fakeReader({
    [join(authorisedLocationDir(PROJECT_DIR), sidecarName(cdId))]: contents,
  });

describe("sidecarName", () => {
  test("derives the lowercase per-CD sidecar filename", () => {
    expect(sidecarName("CD-23")).toBe("cd-23.json");
  });
});

describe("authorisedLocationDir", () => {
  test("resolves the exemption directory under the project dir", () => {
    expect(authorisedLocationDir("/repo")).toBe(
      join("/repo", AUTHORISED_LOCATION_DIR),
    );
  });
});

describe("loadSidecarForCd", () => {
  test("loads an entry carrying files and a reason", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([
        { files: ["scripts/ledger.ts"], reason: "declarative manifest" },
      ]),
    });
    expect(
      loadSidecarForCd({ projectDir: PROJECT_DIR, cdId: "CD-23", reader }),
    ).toEqual({
      outcome: "loaded",
      entries: [
        {
          cd: "CD-23",
          files: ["scripts/ledger.ts"],
          reason: "declarative manifest",
        },
      ],
    });
  });

  test("grants nothing when the sidecar is absent", () => {
    const reader = fakeReader({});
    expect(
      loadSidecarForCd({ projectDir: PROJECT_DIR, cdId: "CD-23", reader }),
    ).toEqual({
      outcome: "loaded",
      entries: [],
    });
  });

  test("rejects an entry with no reason", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([{ files: ["scripts/ledger.ts"] }]),
    });
    const load = loadSidecarForCd({
      projectDir: PROJECT_DIR,
      cdId: "CD-23",
      reader,
    });
    expect(load.outcome).toBe("rejected");
  });

  test("rejects an entry whose reason is blank", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([
        { files: ["scripts/ledger.ts"], reason: "   " },
      ]),
    });
    const load = loadSidecarForCd({
      projectDir: PROJECT_DIR,
      cdId: "CD-23",
      reader,
    });
    expect(load.outcome).toBe("rejected");
  });

  test("rejects an entry whose reason is not a string", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([{ files: ["scripts/ledger.ts"], reason: 7 }]),
    });
    const load = loadSidecarForCd({
      projectDir: PROJECT_DIR,
      cdId: "CD-23",
      reader,
    });
    expect(load.outcome).toBe("rejected");
  });

  test("rejects an entry with an empty files array", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([{ files: [], reason: "nothing named" }]),
    });
    const load = loadSidecarForCd({
      projectDir: PROJECT_DIR,
      cdId: "CD-23",
      reader,
    });
    expect(load.outcome).toBe("rejected");
  });

  test("rejects malformed JSON rather than granting the suppression", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: "[ { files: ",
    });
    expect(
      loadSidecarForCd({ projectDir: PROJECT_DIR, cdId: "CD-23", reader }),
    ).toEqual({
      outcome: "rejected",
      rejection: {
        sidecar: "cd-23.json",
        problem: "sidecar is not valid JSON",
      },
    });
  });

  test("rejects a sidecar that exists but cannot be read", () => {
    const path = join(authorisedLocationDir(PROJECT_DIR), sidecarName("CD-23"));
    const reader: SidecarFileReader = {
      fileExists: (candidate) => candidate === path,
      readFile: () => undefined,
      listDirectory: () => [],
    };
    expect(
      loadSidecarForCd({ projectDir: PROJECT_DIR, cdId: "CD-23", reader }),
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
      loadSidecarForCd({ projectDir: PROJECT_DIR, cdId: "CD-23", reader }),
    ).toEqual({
      outcome: "rejected",
      rejection: {
        sidecar: "cd-23.json",
        problem: "top level must be a JSON array",
      },
    });
  });

  test("names the offending entry index in the rejection", () => {
    const reader = readerWithSidecar({
      cdId: "CD-23",
      contents: JSON.stringify([
        { files: ["scripts/a.ts"], reason: "sound" },
        { files: ["scripts/b.ts"] },
      ]),
    });
    const load = loadSidecarForCd({
      projectDir: PROJECT_DIR,
      cdId: "CD-23",
      reader,
    });
    expect(load).toEqual({
      outcome: "rejected",
      rejection: {
        sidecar: "cd-23.json",
        problem: "entry 1: `reason` is required and must be a non-empty string",
      },
    });
  });
});
