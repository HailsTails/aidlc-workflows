import { expect, test } from "bun:test";
import type { FileContent } from "../../kernel/file-content.ts";
import { distribution, hash, host, path, version } from "../../kernel/fixtures/values.fixture.ts";
import type { ProjectPath } from "../../kernel/values.ts";
import type { Payload, PayloadFile } from "./payload.ts";
import type { RootIntegration } from "./root-integration.ts";
import { identicalRootConflicts } from "./identical-root-conflicts.ts";

const ROOT: RootIntegration = {
  path: path("AGENTS.md"), policy: "whole-file", sharing: "identical", presence: "required",
};
const GUIDE: RootIntegration = {
  path: path("GUIDE.md"), policy: "managed-block", marker: "aidlc", sharing: "identical", presence: "required",
};
const file = (content: FileContent, within: ProjectPath = path("AGENTS.md")): PayloadFile => ({
  path: within, content, hash: hash("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
  mode: "regular", origin: { kind: "distribution-descriptor" },
});
const hostPayload = ({ name, files, roots = [ROOT] }: {
  readonly name: string;
  readonly files: readonly PayloadFile[];
  readonly roots?: readonly RootIntegration[];
}): Payload => ({
  version: version("2.12.0"), channel: "copy", files,
  descriptor: { host: host({ name, directory: `.${name}` }),
    layout: { rootIntegrations: roots, managedDirectories: [] },
    history: { retiredFiles: [], priorIntegrations: [] } },
});

test("different bytes in an identical root identify its first and conflicting distributions", () => {
  expect(identicalRootConflicts({ payloads: [
    hostPayload({ name: "claude", files: [file({ kind: "text", text: "first\n" })] }),
    hostPayload({ name: "codex", files: [file({ kind: "text", text: "second\n" })] }),
  ] })).toEqual([{ kind: "shared-root-integration-differs", path: path("AGENTS.md"),
    distributions: [distribution("claude"), distribution("codex")] }]);
});

test("equal UTF-8 content agrees even when representation, hash and mode differ", () => {
  expect(identicalRootConflicts({ payloads: [
    hostPayload({ name: "claude", files: [file({ kind: "text", text: "café" })] }),
    hostPayload({ name: "codex", files: [{ ...file({ kind: "bytes", bytes: new Uint8Array([99, 97, 102, 195, 169]) }),
      hash: hash("sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"), mode: "executable" }] }),
  ] })).toEqual([]);
});

test("each later mismatch is compared with the original owner in payload and declaration order", () => {
  expect(identicalRootConflicts({ payloads: [
    hostPayload({ name: "claude", files: [file({ kind: "text", text: "first" }),
      file({ kind: "text", text: "guide-first" }, path("GUIDE.md"))], roots: [ROOT, GUIDE] }),
    hostPayload({ name: "codex", files: [file({ kind: "text", text: "second" }),
      file({ kind: "text", text: "guide-second" }, path("GUIDE.md"))], roots: [GUIDE, ROOT] }),
    hostPayload({ name: "kiro", files: [file({ kind: "text", text: "second" })] }),
  ] })).toEqual([
    { kind: "shared-root-integration-differs", path: path("GUIDE.md"),
      distributions: [distribution("claude"), distribution("codex")] },
    { kind: "shared-root-integration-differs", path: path("AGENTS.md"),
      distributions: [distribution("claude"), distribution("codex")] },
    { kind: "shared-root-integration-differs", path: path("AGENTS.md"),
      distributions: [distribution("claude"), distribution("kiro")] },
  ]);
});

test("union, exclusive and policies without sharing do not establish identical owners", () => {
  expect(identicalRootConflicts({ payloads: [
    hostPayload({ name: "claude", files: [], roots: [
      { path: path("AGENTS.md"), policy: "whole-file", sharing: "union", presence: "required" },
      { path: path("GUIDE.md"), policy: "managed-block", marker: "aidlc", sharing: "exclusive", presence: "required" },
      { path: path("settings.json"), policy: "json-map", key: "settings", presence: "required" },
    ] }),
    hostPayload({ name: "codex", files: [file({ kind: "text", text: "only identical owner" })] }),
  ] })).toEqual([]);
});

test("files that are not declared as identical roots are outside this comparison", () => {
  expect(identicalRootConflicts({ payloads: [
    hostPayload({ name: "claude", files: [file({ kind: "text", text: "first" })], roots: [] }),
    hostPayload({ name: "codex", files: [file({ kind: "text", text: "second" })], roots: [] }),
  ] })).toEqual([]);
});

test("an absent identical root uses the existing missing-root refusal", () => {
  expect(identicalRootConflicts({ payloads: [hostPayload({ name: "claude", files: [] })] }))
    .toEqual([{ kind: "root-integration-missing", path: path("AGENTS.md") }]);
});

test("invalid UTF-8 binary differences do not collapse through text decoding", () => {
  expect(identicalRootConflicts({ payloads: [
    hostPayload({ name: "claude", files: [file({ kind: "bytes", bytes: new Uint8Array([255, 0]) })] }),
    hostPayload({ name: "codex", files: [file({ kind: "bytes", bytes: new Uint8Array([254, 0]) })] }),
  ] })).toEqual([{ kind: "shared-root-integration-differs", path: path("AGENTS.md"),
    distributions: [distribution("claude"), distribution("codex")] }]);
});

test("a longer binary view conflicts while equal subarray content agrees", () => {
  expect(identicalRootConflicts({ payloads: [
    hostPayload({ name: "claude", files: [
      file({ kind: "bytes", bytes: new Uint8Array([9, 1, 2, 9]).subarray(1, 3) }),
    ] }),
    hostPayload({ name: "codex", files: [file({ kind: "bytes", bytes: new Uint8Array([1, 2]) })] }),
    hostPayload({ name: "kiro", files: [file({ kind: "bytes", bytes: new Uint8Array([1, 2, 3]) })] }),
  ] })).toEqual([{ kind: "shared-root-integration-differs", path: path("AGENTS.md"),
    distributions: [distribution("claude"), distribution("kiro")] }]);
});

test("an independent native-channel cohort uses the same byte rule", () => {
  expect(identicalRootConflicts({ payloads: [
    { ...hostPayload({ name: "claude", files: [file({ kind: "text", text: "native" })] }), channel: "native" },
    { ...hostPayload({ name: "codex", files: [file({ kind: "text", text: "native" })] }), channel: "native" },
  ] })).toEqual([]);
});

test("empty cohorts, one owner and empty matching files have no conflict", () => {
  expect(identicalRootConflicts({ payloads: [] })).toEqual([]);
  expect(identicalRootConflicts({ payloads: [
    hostPayload({ name: "claude", files: [file({ kind: "text", text: "" })] }),
  ] })).toEqual([]);
  expect(identicalRootConflicts({ payloads: [
    hostPayload({ name: "claude", files: [file({ kind: "text", text: "" })] }),
    hostPayload({ name: "codex", files: [file({ kind: "bytes", bytes: new Uint8Array() })] }),
  ] })).toEqual([]);
});
