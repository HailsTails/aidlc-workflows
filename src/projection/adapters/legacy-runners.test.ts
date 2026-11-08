import { expect, test } from "bun:test";
import { accept } from "../../kernel/fixtures/accept.ts";
import { nativeCommandName, commandFilePath, type CommandReading } from "../domain/native-command.ts";
import { accepted } from "../../kernel/result.ts";
import { scope, stage } from "../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { decodeLegacyRunners, duplicateNativeCommand, prepareLegacyRunners, runChild, runChildWithCapability } from "./legacy-runners.ts";

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

test("a missing captured scope refuses before any filesystem access", () => {
  const source = prepareLegacyRunners({ method: methodSliceFixture, sources: [], projectRoot: "unused",
    temporaryRoot: "unused", harnessDir: ".host", harnessName: "host" });
  expect(source.read({ concept: "stage-command", name: stage("requirements-analysis") })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "classic",
      reason: "The accepted scope source was not captured." } });
});

test("a stage and scope sharing a native name refuse before frozen writes can overwrite", () => {
  expect(duplicateNativeCommand([
    { subject: { concept: "stage-command", name: "example" }, nativeName: "aidlc-example",
      markdown: "Stage", reason: null },
    { subject: { concept: "scope-command", name: "example-scope" }, nativeName: "aidlc-example",
      markdown: "Scope", reason: null },
  ])).toEqual({ subject: { concept: "scope-command", name: "example-scope" }, files: null,
    reason: "Two frozen commands share the native destination: aidlc-example" });
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

test("invalid child input returns failure data before any module or filesystem access", async () => {
  expect(await runChild(null)).toEqual({ entries: [], failure: "The frozen runner request is invalid." });
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


test("an absent selected scope is refused before child output is written", () => {
  expect(runChildWithCapability({ module: "unused", output: "unused", stages: [], scopes: ["feature"] }, {
    runnableStages: () => [],
    discoverScopes: () => ({}),
    defaultScopeBatch: () => ["feature"],
    renderStageRunner: () => "Unused stage",
    renderRunner: () => "Unused scope",
    renderInitRunner: () => "---\nname: aidlc-init\n---\n",
    renderComposeRunner: () => "---\nname: aidlc-compose\n---\n",
    regenerateRunnerSurfaces: () => undefined,
  })).toEqual({ failure: null, entries: [{ subject: { concept: "scope-command", name: "feature" },
    files: null, reason: "The selected frozen scope is absent: feature" }] });
});

test("an invalid child capability API returns a whole-source failure", () => {
  expect(runChildWithCapability({ module: "unused", output: "unused", stages: [], scopes: [] }, {}))
    .toEqual({ entries: [], failure: "The frozen runner capability API is invalid." });
});
