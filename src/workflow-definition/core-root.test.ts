import { expect, mock, test } from "bun:test";
import { accept } from "../kernel/fixtures/accept.ts";
import { createInMemoryFileSystem } from "../kernel/fixtures/file-system.fake.ts";
import { accepted, refused } from "../kernel/result.ts";
import type { CoreContent } from "./domain/method.ts";
import type { MethodContentDecoder } from "./application/ports.ts";
import { loadAuthoredCoreMethod } from "./core-root.ts";

const core: CoreContent = { stages: [], agents: [], scopes: [], memberships: [],
  freeformDefaults: [], sensors: [], rules: [], knowledge: [], hooks: [] };
const files = {
  "file:///core/aidlc-common/stages/.keep": "", "file:///core/agents/.keep": "",
  "file:///core/scopes/.keep": "", "file:///core/sensors/.keep": "",
  "file:///core/memory/.keep": "", "file:///core/knowledge/.keep": "",
};

test("the Definition root composes injected captures with core admission", async () => {
  const decodeCore = mock<MethodContentDecoder["decodeCore"]>(async () => accepted({ core, files: [] }));
  const decodeContribution = mock<MethodContentDecoder["decodeContribution"]>(async () =>
    refused([{ kind: "core-namespace-claimed", plugin: "unused" }]));
  const reader = createInMemoryFileSystem({ files });
  const loaded = accept(await loadAuthoredCoreMethod({ coreRoot: new URL("file:///core/"), reader,
    decoder: { decodeCore, decodeContribution } }));
  expect(loaded.method.graph.nodes).toEqual([]);
  expect(loaded.authored).toBe(core);
  expect(loaded.sources).toEqual([]);
  expect(decodeCore).toHaveBeenCalledWith({ stages: [], agents: [], scopes: [], sensors: [], rules: [], knowledge: [] });
  expect(decodeContribution).not.toHaveBeenCalled();
});

test("the Definition root returns a decoder refusal without partial admission", async () => {
  const decodeCore = mock<MethodContentDecoder["decodeCore"]>(async () =>
    refused([{ kind: "invalid-file", location: { kind: "stage-pins" }, issues: ["decoder refused"] }]));
  const decodeContribution = mock<MethodContentDecoder["decodeContribution"]>(async () =>
    refused([{ kind: "core-namespace-claimed", plugin: "unused" }]));
  expect(await loadAuthoredCoreMethod({ coreRoot: new URL("file:///core/"),
    reader: createInMemoryFileSystem({ files }), decoder: { decodeCore, decodeContribution } }))
    .toEqual({ ok: false, refusal: [{ kind: "invalid-file", location: { kind: "stage-pins" },
      issues: ["decoder refused"] }] });
});
