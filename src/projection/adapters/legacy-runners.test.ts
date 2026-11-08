import { expect, test } from "bun:test";
import { accepted } from "../../kernel/result.ts";
import { scope, stage } from "../../workflow-definition/fixtures/identities.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { decodeLegacyRunners, duplicateNativeCommand, prepareLegacyRunners } from "./legacy-runners.ts";

test("the boundary retains every companion and uses the requested typed stage subject", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout: `{"failure":null,"entries":[
    {"subject":{"concept":"stage-command","name":"example"},"reason":null,"files":[
      {"nativeName":"aidlc-example","within":"SKILL.md","text":"Stage\\n","mode":"regular"},
      {"nativeName":"aidlc-example","within":"agents/openai.yaml","text":"Guard\\n","mode":"regular"}
    ]}]}` });
  expect(source.read({ concept: "stage-command", name: stage("example") })).toEqual(accepted([
    { nativeName: "aidlc-example", within: "SKILL.md", content: { kind: "text", text: "Stage\n" }, mode: "regular" },
    { nativeName: "aidlc-example", within: "agents/openai.yaml", content: { kind: "text", text: "Guard\n" }, mode: "regular" },
  ]));
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
  expect(source.read({ concept: "scope-command", name: scope("classic") })).toEqual(accepted(null));
});

test("a formatting failure retains the actual scope even when another command is requested first", () => {
  const source = decodeLegacyRunners({ status: 0, stderr: "", stdout: `{"failure":null,"entries":[
    {"subject":{"concept":"scope-command","name":"feature"},"files":null,"reason":"Invalid scope bytes"}]}` });
  expect(source.read({ concept: "stage-command", name: stage("example") })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "feature", reason: "Invalid scope bytes" } });
});

test("a process failure identifies the actual requested shortcut", () => {
  const source = decodeLegacyRunners({ status: 1, stdout: "", stderr: "Formatter unavailable" });
  expect(source.read({ concept: "orchestrator-skill", name: "aidlc-compose" })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "orchestrator-skill", name: "aidlc-compose", reason: "Formatter unavailable" } });
});

test("malformed output is a refusal for the requested scope", () => {
  const source = decodeLegacyRunners({ status: 0, stdout: "not JSON", stderr: "" });
  expect(source.read({ concept: "scope-command", name: scope("feature") })).toEqual({ ok: false,
    refusal: { kind: "render-failed", concept: "scope-command", name: "feature",
      reason: "The frozen runner formatter returned invalid JSON." } });
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
