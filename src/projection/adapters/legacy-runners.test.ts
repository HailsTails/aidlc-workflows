import { createInMemoryFileSystem } from "../../kernel/fixtures/file-system.fake.ts";
import { createScriptedProcessRunner } from "../../kernel/fixtures/process-runner.fake.ts";
import type { LegacyRunnerScratch } from "../application/ports/legacy-runner.ts";
import type { MethodSource } from "../../workflow-definition/domain/method-source.ts";
import { methodSource } from "../../workflow-definition/fixtures/method-source.fixture.ts";
import { expect, mock, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { nativeCommandName, commandFilePath, type CommandReading } from "../domain/native-command.ts";
import { accepted, refused } from "../../kernel/result.ts";
import { scope, stage } from "../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { decodeLegacyRunners, prepareLegacyRunners } from "./legacy-runners.ts";

test("the boundary retains every companion and uses the requested typed stage subject", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout: `{"failure":null,"entries":[
    {"subject":{"concept":"stage-command","name":"example"},"reason":null,"files":[
      {"nativeName":"aidlc-example","within":"SKILL.md","content":{"kind":"text","text":"Stage\\n"},"mode":"regular"},
      {"nativeName":"aidlc-example","within":"agents/openai.yaml","content":{"kind":"text","text":"Guard\\n"},"mode":"regular"}
    ]}]}` });
  expect(source.read({ concept: "stage-command", name: stage("example") })).toEqual(accepted<CommandReading>({
    kind: "rendered", files: [
      { name: accept(nativeCommandName("aidlc-example")), within: accept(commandFilePath("SKILL.md")),
        content: { kind: "text", text: "Stage\n" }, mode: "regular" },
      { name: accept(nativeCommandName("aidlc-example")), within: accept(commandFilePath("agents/openai.yaml")),
        content: { kind: "text", text: "Guard\n" }, mode: "regular" },
    ],
  }));
});

test("a missing stage lookup is a named refusal rather than accepted undefined", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout: '{"failure":null,"entries":[]}' });
  expect(source.read({ concept: "stage-command", name: stage("example") })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "stage-command", name: "example",
      reason: "The frozen runner response must contain exactly one entry for this subject." } });
});

test("a missing scope lookup is a scope refusal rather than a map failure", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout: '{"failure":null,"entries":[]}' });
  expect(source.read({ concept: "scope-command", name: scope("feature") })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "feature",
      reason: "The frozen runner response must contain exactly one entry for this subject." } });
});

test("an explicitly declined scope is distinct from an absent response", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout: `{"failure":null,"entries":[
    {"subject":{"concept":"scope-command","name":"classic"},"files":null,"reason":null}]}` });
  expect(source.read({ concept: "scope-command", name: scope("classic") })).toEqual(accepted<CommandReading>({ kind: "declined" }));
});

test("a formatting failure retains the actual scope even when another command is requested first", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout: `{"failure":null,"entries":[
    {"subject":{"concept":"scope-command","name":"feature"},"files":null,"reason":"Invalid scope bytes"}]}` });
  expect(source.read({ concept: "stage-command", name: stage("example") })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "feature", reason: "Invalid scope bytes" } });
});

test("a process failure has no invented command subject", () => {
  const source = decodeLegacyRunners({ status: 1, stdout: "", stderr: "Formatter unavailable" });
  expect(source.read({ concept: "orchestrator-skill", name: "aidlc-compose" })).toEqual({ ok: false,
    refusal: { kind: "command-source-failed", reason: "Formatter unavailable" } });
});

test("malformed output is a subjectless source refusal", () => {
  const source = decodeLegacyRunners({ status: 0, stdout: "not JSON", stderr: "" });
  expect(source.read({ concept: "scope-command", name: scope("feature") })).toEqual({ ok: false,
    refusal: { kind: "command-source-failed", reason: "The frozen runner formatter returned invalid JSON." } });
});

test("duplicate subject responses refuse instead of taking the first entry", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout: `{"failure":null,"entries":[
    {"subject":{"concept":"scope-command","name":"feature"},"files":null,"reason":null},
    {"subject":{"concept":"scope-command","name":"feature"},"files":null,"reason":null}]}` });
  expect(source.read({ concept: "scope-command", name: scope("feature") })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "feature",
      reason: "The frozen runner response must contain exactly one entry for this subject." } });
});

test("a missing captured scope refuses before any filesystem or process port call", async () => {
  const processRunner = createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "unused" }) });
  const source = await prepareLegacyRunners({ method: methodSliceFixture, sources: [],
    projectRoot: new URL("file:///build/"), temporaryRoot: new URL("file:///scratch/"),
    harnessDir: ".host", harnessName: "host" }, { scratch: createInMemoryFileSystem({ files: {} }),
    processRunner, child: new URL("file:///entry.ts") });
  expect(source.read({ concept: "stage-command", name: stage("requirements-analysis") })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "classic",
      reason: "The accepted scope source was not captured." } });
  expect(processRunner.received()).toEqual([]);
});
test.each([
  { label: "empty rendered command", files: '[]', reason: "A rendered command must contain at least one file." },
  { label: "escaping native name", files: '[{"nativeName":"../outside","within":"SKILL.md","content":{"kind":"text","text":"Unused"},"mode":"regular"}]',
    reason: "The frozen native name must be one portable path segment." },
  { label: "escaping companion path", files: '[{"nativeName":"aidlc-feature","within":"../outside","content":{"kind":"text","text":"Unused"},"mode":"regular"}]',
    reason: "The frozen companion path must be a portable relative path." },
])("the legacy edge refuses $label with its actual scope", ({ files, reason }) => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout:
    `{"failure":null,"entries":[{"subject":{"concept":"scope-command","name":"feature"},"reason":null,"files":${files}}]}` });
  expect(source.read({ concept: "scope-command", name: scope("feature") })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "feature", reason } });
});

test("a whole-run failure remains identical across scope and shortcut readers", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout:
    '{"entries":[],"failure":"The runner frame is unavailable"}' });
  expect(source.read({ concept: "scope-command", name: scope("feature") })).toEqual({ ok: false,
    refusal: { kind: "command-source-failed", reason: "The runner frame is unavailable" } });
  expect(source.read({ concept: "orchestrator-skill", name: "aidlc-init" })).toEqual({ ok: false,
    refusal: { kind: "command-source-failed", reason: "The runner frame is unavailable" } });
});

test("companion bytes survive the legacy protocol without UTF-8 replacement", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout: `{"failure":null,"entries":[
    {"subject":{"concept":"scope-command","name":"feature"},"reason":null,"files":[
      {"nativeName":"aidlc-feature","within":"companion.bin","mode":"regular",
       "content":{"kind":"bytes","bytes":[0,255,195,40]}}
    ]}]}` });
  expect(source.read({ concept: "scope-command", name: scope("feature") })).toEqual(accepted<CommandReading>({
    kind: "rendered", files: [{ name: accept(nativeCommandName("aidlc-feature")),
      within: accept(commandFilePath("companion.bin")), mode: "regular",
      content: { kind: "bytes", bytes: new Uint8Array([0, 255, 195, 40]) } }],
  }));
});


const scopeSources: readonly MethodSource[] = [
  { owner: { kind: "core" }, path: methodSource({ kind: "scope", within: "aidlc-classic.md" }),
    content: { kind: "text", text: "Captured classic" } },
  { owner: { kind: "core" }, path: methodSource({ kind: "scope", within: "aidlc-feature.md" }),
    content: { kind: "text", text: "Captured feature" } },
];
const captureRequest = { method: methodSliceFixture, sources: scopeSources,
  projectRoot: new URL("file:///build/"), temporaryRoot: new URL("file:///scratch/"),
  harnessDir: ".claude", harnessName: "claude" };
const child = new URL("file:///entry.ts");

test("async preparation captures a successful fake process reply once and removes its frame", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const processRunner = createScriptedProcessRunner({ outcome: accepted({ exit: { kind: "exited", code: 0 },
    stdout: '{"failure":null,"entries":[{"subject":{"concept":"scope-command","name":"feature"},"files":null,"reason":null}]}',
    stderr: "" }) });
  const source = await prepareLegacyRunners(captureRequest, { scratch, processRunner, child });
  expect(source.read({ concept: "scope-command", name: scope("feature") }))
    .toEqual({ ok: true, value: { kind: "declined" } });
  expect(processRunner.received()).toHaveLength(1);
  expect(processRunner.received()[0]?.argv).toEqual(["--no-install", { kind: "path", location: child }, "--runner-child"]);
  expect(processRunner.received()[0]?.cwd).toEqual(new URL("file:///scratch/scratch-2/output/"));
  expect(processRunner.received()[0]?.input).toBe(
    '{"module":"file:///build/.claude/tools/aidlc-runner-gen.ts","output":"file:///scratch/scratch-2/output/","stages":["requirements-analysis","units-generation","code-generation"],"scopes":["classic","feature"]}');
  expect(processRunner.received()[0]?.env["PATH"]).toEqual({ kind: "runtime-folder" });
  expect(processRunner.received()[0]?.env["TMPDIR"]).toEqual({ kind: "path", location: new URL("file:///scratch/scratch-2/") });
  expect(scratch.snapshot()).toEqual({});
});

test("a not-started process preserves its subjectless refusal and cleans the frame", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const processRunner = createScriptedProcessRunner({ outcome: refused({ kind: "not-started", reason: "Spawn refused" }) });
  const source = await prepareLegacyRunners(captureRequest, { scratch, processRunner, child });
  expect(source.read({ concept: "stage-command", name: stage("requirements-analysis") }))
    .toEqual({ ok: false, refusal: { kind: "command-source-failed", reason: "Spawn refused" } });
  expect(scratch.snapshot()).toEqual({});
});

test("cleanup failure retains the existing priority over a successful child response", async () => {
  const scratch = createInMemoryFileSystem({ files: {} });
  const removeFolder = mock<LegacyRunnerScratch["removeFolder"]>(async () =>
    refused({ kind: "unwritable", code: "permission-denied" }));
  const processRunner = createScriptedProcessRunner({ outcome: accepted({ exit: { kind: "exited", code: 0 },
    stdout: '{"failure":null,"entries":[]}', stderr: "" }) });
  const source = await prepareLegacyRunners(captureRequest, { scratch: { ...scratch, removeFolder }, processRunner, child });
  expect(source.read({ concept: "scope-command", name: scope("feature") })).toEqual({ ok: false,
    refusal: { kind: "command-source-failed", reason: "The private runner frame could not be removed: permission-denied" } });
  expect(removeFolder).toHaveBeenCalledTimes(1);
});