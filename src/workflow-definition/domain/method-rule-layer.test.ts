import { expect, test } from "bun:test";
import { methodSource } from "../fixtures/method-source.fixture.ts";
import { ruleLayerFor } from "./method-rule-layer.ts";

test("core memory files keep only the named layers and phases", () => {
  expect(ruleLayerFor({ path: methodSource({ kind: "rule", within: "org.md" }),
    policy: { kind: "core" } })).toEqual({ kind: "org" });
  expect(ruleLayerFor({ path: methodSource({ kind: "rule", within: "team.md" }),
    policy: { kind: "core" } })).toEqual({ kind: "team" });
  expect(ruleLayerFor({ path: methodSource({ kind: "rule", within: "project.md" }),
    policy: { kind: "core" } })).toEqual({ kind: "project" });
  expect(ruleLayerFor({ path: methodSource({ kind: "rule", within: "phases/inception.md" }),
    policy: { kind: "core" } })).toEqual({ kind: "phase", phase: "inception" });
  expect(ruleLayerFor({ path: methodSource({ kind: "rule", within: "custom.md" }),
    policy: { kind: "core" } })).toBeNull();
});

test("plugin rules use the same phase owner and their declared fallback level", () => {
  expect(ruleLayerFor({ path: methodSource({ kind: "rule", within: "phases/inception.md" }),
    policy: { kind: "plugin", level: "team" } })).toEqual({ kind: "phase", phase: "inception" });
  expect(ruleLayerFor({ path: methodSource({ kind: "rule", within: "custom.md" }),
    policy: { kind: "plugin", level: "org" } })).toEqual({ kind: "org" });
});
