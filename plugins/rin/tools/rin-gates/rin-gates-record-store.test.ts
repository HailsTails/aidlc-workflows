import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  createNodeRecordStore,
  createRecordStore,
  createSystemClock,
  type FileSystemCapabilities,
} from "./rin-gates-record-store.ts";

const bindingPathIn = (recordDir: string): string =>
  join(recordDir, "importance-binding.json");

const missingEntryError = (): Error =>
  Object.assign(new Error("ENOENT: no such file or directory"), {
    code: "ENOENT",
  });

const refusingFileSystem = (error: Error): FileSystemCapabilities => ({
  readFile: () => {
    throw error;
  },
  writeFile: () => {
    throw error;
  },
  readDirectoryNames: () => {
    throw error;
  },
  directoryExists: () => {
    throw error;
  },
});

const storeOver = (fileSystem: FileSystemCapabilities) =>
  createRecordStore({
    bindingFilename: "importance-binding.json",
    fileSystem,
  });

describe("createRecordStore readBinding", () => {
  test("returns the file's contents, read from the binding filename inside the record dir", () => {
    const readPaths: string[] = [];
    const store = storeOver({
      readFile: ({ path }) => {
        readPaths.push(path);
        return '{"flagged":"not-flagged"}';
      },
      writeFile: () => undefined,
      readDirectoryNames: () => [],
      directoryExists: () => true,
    });

    expect(store.readBinding({ recordDir: "/intents/alpha" })).toEqual({
      outcome: "ok",
      value: '{"flagged":"not-flagged"}',
    });
    expect(readPaths).toEqual([bindingPathIn("/intents/alpha")]);
  });

  test("maps a missing file to an absent-not-failed result, so a record with no binding reads as null", () => {
    const store = storeOver(refusingFileSystem(missingEntryError()));

    expect(store.readBinding({ recordDir: "/intents/alpha" })).toEqual({
      outcome: "ok",
      value: null,
    });
  });

  test("reports a non-ENOENT read error as read-failed carrying the path and detail", () => {
    const store = storeOver(refusingFileSystem(new Error("EACCES denied")));

    expect(store.readBinding({ recordDir: "/intents/alpha" })).toEqual({
      outcome: "failed",
      error: {
        kind: "read-failed",
        path: bindingPathIn("/intents/alpha"),
        detail: "EACCES denied",
      },
    });
  });
});

describe("createRecordStore writeBinding", () => {
  test("writes the contents to the binding filename inside the record dir", () => {
    const written: { path: string; contents: string }[] = [];
    const store = storeOver({
      readFile: () => "",
      writeFile: ({ path, contents }) => {
        written.push({ path, contents });
      },
      readDirectoryNames: () => [],
      directoryExists: () => true,
    });

    expect(
      store.writeBinding({ recordDir: "/intents/alpha", contents: "{}" }),
    ).toEqual({ outcome: "ok", value: undefined });
    expect(written).toEqual([
      { path: bindingPathIn("/intents/alpha"), contents: "{}" },
    ]);
  });

  test("reports a write error as write-failed, never as an absent result", () => {
    const store = storeOver(refusingFileSystem(missingEntryError()));

    expect(
      store.writeBinding({ recordDir: "/intents/alpha", contents: "{}" }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "write-failed",
        path: bindingPathIn("/intents/alpha"),
        detail: "ENOENT: no such file or directory",
      },
    });
  });
});

describe("createRecordStore listRecordDirs", () => {
  test("joins each directory name onto the intents root and sorts the result", () => {
    const store = storeOver({
      readFile: () => "",
      writeFile: () => undefined,
      readDirectoryNames: () => ["beta", "alpha"],
      directoryExists: () => true,
    });

    expect(store.listRecordDirs({ intentsRoot: "/intents" })).toEqual({
      outcome: "ok",
      value: [join("/intents", "alpha"), join("/intents", "beta")],
    });
  });

  test("maps a missing intents root to an empty listing rather than a failure", () => {
    const store = storeOver(refusingFileSystem(missingEntryError()));

    expect(store.listRecordDirs({ intentsRoot: "/intents" })).toEqual({
      outcome: "ok",
      value: [],
    });
  });

  test("reports a non-ENOENT listing error as read-failed carrying the root", () => {
    const store = storeOver(refusingFileSystem(new Error("EACCES denied")));

    expect(store.listRecordDirs({ intentsRoot: "/intents" })).toEqual({
      outcome: "failed",
      error: {
        kind: "read-failed",
        path: "/intents",
        detail: "EACCES denied",
      },
    });
  });
});

describe("createNodeRecordStore", () => {
  // Reading a record dir that cannot exist proves the wiring without creating
  // anything: the real capabilities are genuinely bound (an unbound store could
  // not produce the absent-not-failed mapping), and the ENOENT path is reached.
  test("binds the real filesystem capabilities, mapping an absent record dir to absent rather than failing", () => {
    const store = createNodeRecordStore({
      bindingFilename: "importance-binding.json",
    });

    expect(
      store.readBinding({
        recordDir: join(
          "/rin-gates-record-store-absent-by-construction",
          "no-such-record",
        ),
      }),
    ).toEqual({ outcome: "ok", value: null });
  });
});

describe("createSystemClock", () => {
  // The factory's whole responsibility is handing back the Clock shape bound to
  // the real capability. Asserting the instant itself would characterise Date
  // against two further reads of the same ambient source (CD-27, CD-47); every
  // consumer varies time through the injected port instead.
  test("hands back a clock whose nowUtc yields a Date", () => {
    expect(createSystemClock().nowUtc()).toBeInstanceOf(Date);
  });
});
