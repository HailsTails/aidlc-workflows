import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { createRuntimeReading } from "./runtime-files.ts";

const files = {
  "file:///core/tools/aidlc-version.ts": "V",
  "file:///core/tools/run.ts": new Uint8Array([0, 255]),
  "file:///core/hooks/hook.ts": "H",
  "file:///core/sensors/check.ts": "S",
  "file:///core/scopes/feature.yaml": "C",
  "file:///core/skills/ignored/SKILL.md": "outside runtime",
};
const runtime = {
  files: [
    { source: source("tools/run.ts"), content: { kind: "bytes", bytes: new Uint8Array([0, 255]) } },
    { source: source("hooks/hook.ts"), content: { kind: "bytes", bytes: new Uint8Array([72]) } },
    { source: source("sensors/check.ts"), content: { kind: "bytes", bytes: new Uint8Array([83]) } },
    { source: source("scopes/feature.yaml"), content: { kind: "bytes", bytes: new Uint8Array([67]) } },
  ],
  version: { kind: "text", text: "stamped" },
  agentTiers: { kind: "text", text: "tiers" }, settingsSchema: { kind: "text", text: "schema" },
} as const;
const capture = { core: new URL("file:///core/"), method: methodSliceFixture,
  stamp: () => accepted({ kind: "text" as const, text: "stamped" }) };
const runtimeData = { agentTiers: () => ({ kind: "text" as const, text: "tiers" }),
  settingsSchema: () => ({ kind: "text" as const, text: "schema" }) };

test("four runtime folders capture recursive bytes and separate the once-stamped version", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const readTree = mock(fileSystem.readTree);
  const stamp = mock(capture.stamp);
  const agentTiers = mock(runtimeData.agentTiers);
  const settingsSchema = mock(runtimeData.settingsSchema);
  expect(await createRuntimeReading({ tree: { readTree }, agentTiers, settingsSchema })({ ...capture, stamp }))
    .toEqual(accepted(runtime));
  expect(readTree).toHaveBeenCalledTimes(4);
  expect(stamp).toHaveBeenCalledTimes(1);
  expect(stamp).toHaveBeenCalledWith({ kind: "bytes", bytes: new Uint8Array([86]) });
  expect(agentTiers).toHaveBeenCalledWith(methodSliceFixture);
  expect(settingsSchema).toHaveBeenCalledTimes(1);
});

test("capture owns a byte snapshot after its source is changed", async () => {
  const fileSystem = createInMemoryFileSystem({ files });
  const captured = await createRuntimeReading({ tree: fileSystem, ...runtimeData })(capture);
  await fileSystem.writeFile({ file: new URL("file:///core/tools/run.ts"),
    content: { kind: "bytes", bytes: new Uint8Array([1]) } });
  expect(captured).toEqual(accepted(runtime));
});

test("per-file and folder failures retain runtime source and deterministic folder order", async () => {
  const fileSystem = createInMemoryFileSystem({ files, faults: {
    "file:///core/tools/run.ts": "permission-denied", "file:///core/hooks/": "permission-denied",
  } });
  const stamp = mock(capture.stamp);
  expect(await createRuntimeReading({ tree: fileSystem, ...runtimeData })({ ...capture, stamp })).toEqual(refused([
    { kind: "neutral-source-unreadable", source: source("tools/run.ts"), reason: "permission-denied" },
    { kind: "neutral-source-unreadable", source: source("hooks"), reason: "permission-denied" },
  ]));
  expect(stamp).not.toHaveBeenCalled();
});

test("an absent required version module is an explicit source refusal", async () => {
  const fileSystem = createInMemoryFileSystem({ files: {
    "file:///core/tools/run.ts": "T", "file:///core/hooks/hook.ts": "H",
    "file:///core/sensors/check.ts": "S", "file:///core/scopes/feature.yaml": "C",
  } });
  expect(await createRuntimeReading({ tree: fileSystem, ...runtimeData })(capture)).toEqual(refused([
    { kind: "neutral-source-unreadable", source: source("tools/aidlc-version.ts"), reason: "not-found" },
  ]));
});

test("a stamp refusal remains failure data and does not generate shared data", async () => {
  const agentTiers = mock(runtimeData.agentTiers);
  const settingsSchema = mock(runtimeData.settingsSchema);
  expect(await createRuntimeReading({ tree: createInMemoryFileSystem({ files }), agentTiers, settingsSchema })({
    ...capture, stamp: () => refused({ kind: "render-failed", concept: "host-data",
      name: "aidlc-version.ts", reason: "Two assignments" }),
  })).toEqual(refused([{ kind: "render-failed", concept: "host-data", name: "aidlc-version.ts",
    reason: "Two assignments" }]));
  expect(agentTiers).not.toHaveBeenCalled();
  expect(settingsSchema).not.toHaveBeenCalled();
});
