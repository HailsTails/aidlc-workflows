// covers: function:planMachineTransactionParent, function:admitMachineTransactionParent

import { expect, test } from "bun:test";
import { admitMachineTransactionParent, planMachineTransactionParent } from "./aidlc-machine-transaction-parent.ts";

test.each([
  { install: ["home", "team", "aidlc"], command: ["home", "team", "bin"], shared: ["home", "team"] },
  { install: ["home", "team", "aidlc"], command: ["home", "team", "aidlc", "bin"], shared: ["home", "team", "aidlc"] },
  { install: ["home", "team", "aidlc", "versions"], command: ["home", "team", "aidlc"], shared: ["home", "team", "aidlc"] },
  { install: ["home", "team", "aidlc"], command: ["home", "team", "aidlc"], shared: ["home", "team", "aidlc"] },
  { install: ["home", "team", "a"], command: ["home", "teammate", "b"], shared: ["home"] },
])("transaction parent uses whole shared segments: %s", ({ install, command, shared }) => {
  expect(planMachineTransactionParent({ installDirectory: { filesystemRoot: "/", segments: install }, commandDirectory: { filesystemRoot: "/", segments: command } })).toEqual({ filesystemRoot: "/", segments: shared });
});

test.each(["H:\\", "\\\\server\\share\\"])("Windows root spelling survives unchanged: %s", (filesystemRoot) => {
  expect(planMachineTransactionParent({ installDirectory: { filesystemRoot, segments: ["team", "aidlc"] }, commandDirectory: { filesystemRoot, segments: ["team", "bin"] } })).toEqual({ filesystemRoot, segments: ["team"] });
});

test.each([
  { install: [], command: ["home", "team"] },
  { install: ["home"], command: [] },
  { install: ["install"], command: ["bin"] },
  { install: ["Team", "aidlc"], command: ["team", "bin"] },
])("filesystem-root-only parents remain refused: %s", ({ install, command }) => {
  expect(() => planMachineTransactionParent({ installDirectory: { filesystemRoot: "H:\\", segments: install }, commandDirectory: { filesystemRoot: "H:\\", segments: command } })).toThrow("machine install and command directories need a writable shared parent");
});

test.each([
  { install: "H:\\", command: "D:\\" },
  { install: "H:\\", command: "h:\\" },
  { install: "\\\\server\\one\\", command: "\\\\server\\two\\" },
])("different root spellings remain refused: %s", ({ install, command }) => {
  expect(() => planMachineTransactionParent({ installDirectory: { filesystemRoot: install, segments: ["team", "aidlc"] }, commandDirectory: { filesystemRoot: command, segments: ["team", "bin"] } })).toThrow("machine install and command directories must be on one filesystem root");
});

test("frozen decoded facts remain unchanged", () => {
  const segments = Object.freeze(["team", "aidlc"]);
  const directory = Object.freeze({ filesystemRoot: "H:\\", segments });
  expect(planMachineTransactionParent({ installDirectory: directory, commandDirectory: directory })).toEqual({ filesystemRoot: "H:\\", segments: ["team", "aidlc"] });
  expect(directory).toEqual({ filesystemRoot: "H:\\", segments: ["team", "aidlc"] });
});

test("platform-sensitive segments remain facts for the final native path check", () => {
  expect(planMachineTransactionParent({ installDirectory: { filesystemRoot: "/", segments: ["a", ".."] }, commandDirectory: { filesystemRoot: "/", segments: ["a", ".."] } })).toEqual({ filesystemRoot: "/", segments: ["a", ".."] });
});

test.each(["/", "H:\\", "\\\\server\\share\\"])("a final native join cannot admit the filesystem root: %s", (filesystemRoot) => {
  expect(() => admitMachineTransactionParent({ filesystemRoot, parentPath: filesystemRoot })).toThrow("machine install and command directories need a writable shared parent");
});

test.each([
  { filesystemRoot: "/", parentPath: "/home/team" },
  { filesystemRoot: "H:\\", parentPath: "H:\\team" },
  { filesystemRoot: "\\\\server\\share\\", parentPath: "\\\\server\\share\\team" },
])("a final non-root parent retains its platform spelling: %s", ({ filesystemRoot, parentPath }) => {
  expect(admitMachineTransactionParent({ filesystemRoot, parentPath })).toBe(parentPath);
});
