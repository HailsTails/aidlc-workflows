import { expect, test } from "bun:test";
import { refused } from "../../kernel/result.ts";
import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import { claudeCopyPayloadFixture } from "../fixtures/claude-payload.fixture.ts";
import type { PayloadFile } from "./payload.ts";
import { completePayload, duplicateRootIntegrations } from "./payload-completion.ts";

const copyPayload = claudeCopyPayloadFixture;
const textFile: PayloadFile = { path: path(".claude/example.md"),
  hash: hash("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
  content: { kind: "text", text: "Authored content\n" }, mode: "regular",
  origin: { kind: "projected", origin: { kind: "rendered", concept: "host-data", name: "fixture" } } };
const root = { path: path("settings.json"), policy: "jsonc-settings" as const,
  presence: "optional" as const };

test("completion admits covered files with exact content, modes and origins in path order", () => {
  const last = { ...textFile, path: path(".claude/z.md"), mode: "executable" as const };
  const first = { ...textFile, path: path(".claude/a.md") };
  expect(completePayload({ ...copyPayload, files: [last, first] })).toEqual({ ok: true,
    value: { ...copyPayload, files: [first, last] } });
});

test("root conflicts retain declaration order and report each repeated occurrence", () => {
  const other = { ...root, path: path("other.json") };
  expect(duplicateRootIntegrations([root, other, other, root, root])).toEqual([
    { kind: "root-integration-duplicate", path: other.path },
    { kind: "root-integration-duplicate", path: root.path },
    { kind: "root-integration-duplicate", path: root.path },
  ]);
});

test("duplicate roots refuse before duplicate files or undeclared file coverage", () => {
  const outside = { ...textFile, path: path("outside.md") };
  expect(completePayload({ ...copyPayload, descriptor: { ...copyPayload.descriptor,
    layout: { ...copyPayload.descriptor.layout, rootIntegrations: [root, root] } },
  files: [outside, outside] })).toEqual(refused([
    { kind: "root-integration-duplicate", path: root.path },
  ]));
});

test("duplicate files refuse before undeclared coverage even with identical bytes", () => {
  const outside = { ...textFile, path: path("outside.md") };
  expect(completePayload({ ...copyPayload, files: [outside, outside] }))
    .toEqual(refused([{ kind: "duplicate-path", path: outside.path }]));
});

test("coverage distinguishes projected and generated refusals in sorted path order", () => {
  const generated = { ...textFile, path: path("z.js"), origin: { kind: "version-stamp" as const } };
  const projected = { ...textFile, path: path("a.md") };
  expect(completePayload({ ...copyPayload, files: [generated, projected] })).toEqual(refused([
    { kind: "path-undeclared", path: projected.path,
      origin: { kind: "rendered", concept: "host-data", name: "fixture" } },
    { kind: "entry-not-bundled", entry: generated.path,
      reason: "Declare the generated file's directory in the distribution layout." },
  ]));
});

test("coverage accepts an exact root and rejects a managed directory's same-prefix neighbour", () => {
  const rootFile = { ...textFile, path: root.path };
  expect(completePayload({ ...copyPayload, descriptor: { ...copyPayload.descriptor,
    layout: { ...copyPayload.descriptor.layout, rootIntegrations: [root] } }, files: [rootFile] }))
    .toEqual({ ok: true, value: { ...copyPayload, descriptor: { ...copyPayload.descriptor,
      layout: { ...copyPayload.descriptor.layout, rootIntegrations: [root] } }, files: [rootFile] } });
  expect(completePayload({ ...copyPayload, files: [{ ...textFile, path: path(".claude-neighbour/a.md") }] }))
    .toMatchObject({ ok: false, refusal: [{ kind: "path-undeclared", path: ".claude-neighbour/a.md" }] });
});
