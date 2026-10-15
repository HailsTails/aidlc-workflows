import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../core/platform-ports/file-text-port.ts";
import {
  createPathPort,
  posixPathFlavour,
  windowsPathFlavour,
} from "../../../core/platform-ports/path-port.ts";
import { absolutePathSchema } from "../../../core/values/absolute-path.ts";
import { clauseAddressSchema } from "../../../core/values/clause-address.ts";
import { repoPathSchema } from "../../../core/values/repo-path.ts";
import type { SelectedRule } from "./package-script-scanner.ts";
import { scriptSuppressionEntries, suppressionEntriesOf } from "./suppressions-scanner.ts";

const classSyntax = clauseAddressSchema.parse("CD-14#class-syntax");
const noTmpFiles = clauseAddressSchema.parse("probe/PD-1#no-tmp-files");
const defaultLocation = repoPathSchema.parse("eslint-suppressions.json");
const scriptLocation = repoPathSchema.parse("ci/lint-suppressions.json");
const repoRoot = absolutePathSchema.parse("/repo");
const windowsRepoRoot = absolutePathSchema.parse("C:\\repo");
const posixPath = createPathPort({ flavour: posixPathFlavour, workingDirectory: () => "/repo" });
const windowsPath = createPathPort({ flavour: windowsPathFlavour, workingDirectory: () => "C:\\repo" });
const nestedLocation = repoPathSchema.parse("packages/a/eslint-suppressions.json");
const packageDirectory = repoPathSchema.parse("packages/a");

const classRule: SelectedRule = { ruleId: "rin-discipline/no-class-authoring", clause: classSyntax };
const tmpRule: SelectedRule = { ruleId: "probe-lint/no-tmp-files", clause: noTmpFiles };

const suppressionsText = JSON.stringify({
  "src/a.ts": {
    "rin-discipline/no-class-authoring": { count: 2 },
    "no-console": { count: 1 },
  },
  "src/b.ts": {
    "probe-lint/no-tmp-files": { count: 1 },
    "rin-discipline/no-class-authoring": { count: 1 },
  },
  "src/c.ts": { "no-console": { count: 4 } },
});

describe("suppressionEntriesOf", () => {
  it("reports one suppression-entry per file and selected rule id present, at the suppressions file's location", () => {
    expect(
      suppressionEntriesOf({
        location: defaultLocation,
        keysRelativeTo: "repo-root",
        text: suppressionsText,
        selectedRules: [classRule, tmpRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "suppression-entry", clause: classSyntax, file: "src/a.ts", location: "eslint-suppressions.json" },
        { kind: "suppression-entry", clause: noTmpFiles, file: "src/b.ts", location: "eslint-suppressions.json" },
        { kind: "suppression-entry", clause: classSyntax, file: "src/b.ts", location: "eslint-suppressions.json" },
      ],
    });
  });

  it("reports nothing for entries naming only rules that are not selected", () => {
    expect(
      suppressionEntriesOf({
        location: defaultLocation,
        keysRelativeTo: "repo-root",
        text: JSON.stringify({ "src/c.ts": { "no-console": { count: 4 } } }),
        selectedRules: [classRule],
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });

  it("reports a dormant entry for a selected rule, whose file holds no finding", () => {
    expect(
      suppressionEntriesOf({
        location: scriptLocation,
        keysRelativeTo: "repo-root",
        text: JSON.stringify({ "src/clean.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "suppression-entry", clause: classSyntax, file: "src/clean.ts", location: "ci/lint-suppressions.json" },
      ],
    });
  });

  it("does not match a rule id that only extends a selected one", () => {
    expect(
      suppressionEntriesOf({
        location: defaultLocation,
        keysRelativeTo: "repo-root",
        text: JSON.stringify({ "src/a.ts": { "rin-discipline/no-class-authoring-x": { count: 1 } } }),
        selectedRules: [classRule],
      }),
    ).toEqual({ outcome: "ok", value: [] });
  });

  it("reports malformed JSON as tool-failed", () => {
    expect(
      suppressionEntriesOf({ location: defaultLocation,
        keysRelativeTo: "repo-root", text: `{ "src/a.ts": `, selectedRules: [classRule] }),
    ).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });

  it("reports a file entry that is not an object of rule ids as tool-failed", () => {
    expect(
      suppressionEntriesOf({
        location: defaultLocation,
        keysRelativeTo: "repo-root",
        text: JSON.stringify({ "src/a.ts": ["rin-discipline/no-class-authoring"] }),
        selectedRules: [classRule],
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });

  it("reports a file key that is not a repo-relative POSIX path as tool-failed", () => {
    expect(
      suppressionEntriesOf({
        location: defaultLocation,
        keysRelativeTo: "repo-root",
        text: JSON.stringify({ "../outside.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
        selectedRules: [classRule],
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });
});

describe("suppressionEntriesOf with keys relative to a directory", () => {
  it("reads a nested eslint-suppressions.json's keys relative to its own directory, giving repo-relative files", () => {
    expect(
      suppressionEntriesOf({
        location: nestedLocation,
        keysRelativeTo: packageDirectory,
        text: JSON.stringify({ "src/x.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "suppression-entry",
          clause: classSyntax,
          file: "packages/a/src/x.ts",
          location: "packages/a/eslint-suppressions.json",
        },
      ],
    });
  });

  it("reads a script-named file's keys relative to the declaring package.json's directory, not the file's own", () => {
    expect(
      suppressionEntriesOf({
        location: scriptLocation,
        keysRelativeTo: packageDirectory,
        text: JSON.stringify({ "src/x.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "suppression-entry",
          clause: classSyntax,
          file: "packages/a/src/x.ts",
          location: "ci/lint-suppressions.json",
        },
      ],
    });
  });

  it("reports a key that leaves the repository once joined to its base directory as tool-failed", () => {
    expect(
      suppressionEntriesOf({
        location: nestedLocation,
        keysRelativeTo: packageDirectory,
        text: JSON.stringify({ "../../../outside.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
        selectedRules: [classRule],
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });
});

describe("scriptSuppressionEntries", () => {
  it("reads a script-named file declared in a nested package.json with keys relative to that package's directory", () => {
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({
        outcome: "ok",
        value: JSON.stringify({ "src/x.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
      }),
      exists: vi.fn().mockReturnValue("present"),
      write: vi.fn(),
    };

    expect(
      scriptSuppressionEntries({
        fileText,
        path: posixPath,
        repoRoot,
        location: scriptLocation,
        keysRelativeTo: packageDirectory,
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "suppression-entry", clause: classSyntax, file: "packages/a/src/x.ts", location: "ci/lint-suppressions.json" },
      ],
    });
  });

  it("reads the script-named suppressions file under the repo root and reports its entries", () => {
    const read = vi.fn().mockReturnValue({
      outcome: "ok",
      value: JSON.stringify({ "src/a.ts": { "rin-discipline/no-class-authoring": { count: 1 } } }),
    });
    const fileText: FileTextPort = { read, exists: vi.fn().mockReturnValue("present"), write: vi.fn() };

    expect(
      scriptSuppressionEntries({ fileText, path: posixPath, repoRoot, location: scriptLocation, keysRelativeTo: "repo-root", selectedRules: [classRule] }),
    ).toEqual({
      outcome: "ok",
      value: [
        { kind: "suppression-entry", clause: classSyntax, file: "src/a.ts", location: "ci/lint-suppressions.json" },
      ],
    });
    expect(read).toHaveBeenCalledWith({ path: "/repo/ci/lint-suppressions.json" });
  });

  it("reports a script-named suppressions file that is absent as file-unreadable at its location", () => {
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({
        outcome: "failed",
        error: { kind: "unreadable", path: "/repo/ci/lint-suppressions.json", detail: "ENOENT" },
      }),
      exists: vi.fn().mockReturnValue("absent"),
      write: vi.fn(),
    };

    expect(
      scriptSuppressionEntries({ fileText, path: posixPath, repoRoot, location: scriptLocation, keysRelativeTo: "repo-root", selectedRules: [classRule] }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "ci/lint-suppressions.json", detail: "ENOENT" },
    });
  });
});

describe("scriptSuppressionEntries on Windows", () => {
  it("reads the script-named suppressions file at its Windows form under the repo root", () => {
    const read = vi.fn().mockReturnValue({ outcome: "ok", value: "{}" });
    const fileText: FileTextPort = { read, exists: vi.fn().mockReturnValue("present"), write: vi.fn() };

    scriptSuppressionEntries({
      fileText,
      path: windowsPath,
      repoRoot: windowsRepoRoot,
      location: scriptLocation,
      keysRelativeTo: "repo-root",
      selectedRules: [classRule],
    });

    expect(read.mock.calls).toEqual([[{ path: "C:\\repo\\ci\\lint-suppressions.json" }]]);
  });
});
