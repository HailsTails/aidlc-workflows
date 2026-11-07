// covers: function:catalogueRefreshRecovery, function:renderCatalogueRefreshWarning

import { expect, test } from "bun:test";
import { catalogueRefreshRecovery, renderCatalogueRefreshWarning } from "./aidlc-catalogue-recovery.ts";

test.each(["EBUSY", "EPERM", "EACCES"])("Windows %s recommends releasing a possible open file", (errorCode) => {
  expect(catalogueRefreshRecovery({ platform: "win32", errorCode })).toEqual({ reason: "a program may have a file in it open", action: "close-hosts" });
});

test.each([
  { platform: "linux", errorCode: "EPERM" },
  { platform: "linux", errorCode: "EACCES" },
  { platform: "darwin", errorCode: "EPERM" },
  { platform: "darwin", errorCode: "EACCES" },
])("permission failure outside Windows keeps its own remedy: %s", ({ platform, errorCode }) => {
  expect(catalogueRefreshRecovery({ platform, errorCode })).toEqual({ reason: "permission denied", action: "fix-cause" });
});

test.each(["win32", "linux", "darwin"])("%s full disk does not ask the person to close hosts", (platform) => {
  expect(catalogueRefreshRecovery({ platform, errorCode: "ENOSPC" })).toEqual({ reason: "the disk is full", action: "fix-cause" });
});

test.each(["win32", "linux", "darwin"])("%s read-only disk keeps the correct cause", (platform) => {
  expect(catalogueRefreshRecovery({ platform, errorCode: "EROFS" })).toEqual({ reason: "the disk is read-only", action: "fix-cause" });
});

test.each([
  { platform: "linux", errorCode: "EBUSY" },
  { platform: "win32", errorCode: "UNKNOWN" },
  { platform: "win32", errorCode: undefined },
  { platform: "win32", errorCode: null },
  { platform: "win32", errorCode: 1 },
  { platform: "win32", errorCode: { code: "EPERM" } },
])("unclassified native errors leave detail decoding with the adapter: %s", ({ platform, errorCode }) => {
  expect(catalogueRefreshRecovery({ platform, errorCode })).toEqual({ reason: null, action: "fix-cause" });
});

test.each([
  { before: null, after: null },
  { before: null, after: "tree:new" },
  { before: "absent", after: null },
  { before: "tree:old", after: null },
  { before: "tree:old", after: "absent" },
  { before: "tree:old", after: "tree:new" },
])("unproven preservation reports possible incompleteness: %s", ({ before, after }) => {
  expect(renderCatalogueRefreshWarning({ failure: { path: "/machine/plugins", version: "2.11.3", before, after }, reason: "the disk is full", recoveryAction: "fix-cause" })).toBe("Warning: the plugin marketplace at /machine/plugins was not refreshed (the disk is full) and may be incomplete; fix that, then run aidlc use 2.11.3.");
});

test("an unchanged absent catalogue is not described as retained plugins", () => {
  expect(renderCatalogueRefreshWarning({ failure: { path: "/machine/plugins", version: "2.11.3", before: "absent", after: "absent" }, reason: "the disk is full", recoveryAction: "fix-cause" })).toBe("Warning: the plugin marketplace at /machine/plugins was not created (the disk is full); fix that, then run aidlc use 2.11.3.");
});

test("equal observed snapshots preserve the earlier catalogue claim", () => {
  expect(renderCatalogueRefreshWarning({ failure: { path: "/machine/plugins", version: "2.11.3", before: "tree:old", after: "tree:old" }, reason: "a program may have a file in it open", recoveryAction: "close-hosts" })).toBe("Warning: the plugin marketplace at /machine/plugins was not refreshed (a program may have a file in it open), so it still lists the earlier plugins; close Claude Code and Codex, then run aidlc use 2.11.3.");
});

test("snapshot facts remain unchanged", () => {
  const failure = Object.freeze({ path: "/machine/plugins", version: "2.11.3", before: "tree:old", after: "tree:old" });
  expect(renderCatalogueRefreshWarning({ failure, reason: "permission denied", recoveryAction: "fix-cause" })).toBe("Warning: the plugin marketplace at /machine/plugins was not refreshed (permission denied), so it still lists the earlier plugins; fix that, then run aidlc use 2.11.3.");
  expect(failure).toEqual({ path: "/machine/plugins", version: "2.11.3", before: "tree:old", after: "tree:old" });
});
