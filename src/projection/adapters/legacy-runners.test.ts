import { expect, test } from "bun:test";
import { accepted } from "../../kernel/result.ts";
import { decodeLegacyRunners } from "./legacy-runners.ts";

test("the frozen boundary retains every command companion file", () => {
  expect(decodeLegacyRunners({ status: 0, stderr: "", stdout: `{
    "stages":{"example":[
      {"nativeName":"aidlc-example","within":"SKILL.md","text":"Stage\\n","mode":"regular"},
      {"nativeName":"aidlc-example","within":"agents/openai.yaml","text":"Guard\\n","mode":"regular"}
    ],"bootstrap":null},"scopes":{},"workflow":[]
  }` })).toEqual(accepted({ stages: { example: [
    { nativeName: "aidlc-example", within: "SKILL.md",
      content: { kind: "text", text: "Stage\n" }, mode: "regular" },
    { nativeName: "aidlc-example", within: "agents/openai.yaml",
      content: { kind: "text", text: "Guard\n" }, mode: "regular" },
  ], bootstrap: null }, scopes: {}, workflow: [] }));
});

test("a frozen formatter failure returns a refusal", () => {
  expect(decodeLegacyRunners({ status: 1, stdout: "", stderr: "Missing captured input" }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "stage-command",
      name: "runner-context", reason: "Missing captured input" } });
});

test("malformed formatter output refuses instead of becoming an empty command set", () => {
  expect(decodeLegacyRunners({ status: 0, stdout: "not JSON", stderr: "" }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "stage-command",
      name: "runner-context", reason: "The frozen runner formatter returned invalid JSON." } });
});

test("missing command collections are rejected", () => {
  expect(decodeLegacyRunners({ status: 0, stdout: "{}", stderr: "" }))
    .toEqual({ ok: false, refusal: { kind: "render-failed", concept: "stage-command",
      name: "runner-context", reason: "The frozen runner formatter returned invalid documents." } });
});
