import { describe, expect, test } from "bun:test";
import { workflowPluginDependencies, type WorkflowPluginFacts, type WorkflowPluginOwnership } from "../../core/tools/aidlc-workflow-plugin-dependencies.ts";

const ownership: WorkflowPluginOwnership = {
  scopes: [{ name: "feature" }, { name: "validation", plugin: "quality" }],
  stages: [
    { slug: "bootstrap", phase: "initialization", plugin: "quality" },
    { slug: "implement", phase: "construction" },
    { slug: "check", phase: "construction", plugin: "quality" },
  ],
};
const workflow: WorkflowPluginFacts = {
  space: "team",
  recordName: "change-deadbeef",
  displayName: "team/change-deadbeef",
  registryClosed: false,
  state: { status: "Running", scope: "validation", stages: [] },
};
const identity = { space: "team", recordName: "change-deadbeef", displayName: "team/change-deadbeef" };

describe("workflow plugin requirements", () => {
  test("scope ownership remains required even when only a core stage is pending", () => {
    expect(workflowPluginDependencies({
      enabled: new Set(["aidlc"]), ownership,
      workflows: [{ ...workflow, state: { status: "Running", scope: "validation", stages: [{ slug: "implement", state: "pending", suffix: "EXECUTE" }] } }],
    })).toEqual([{ kind: "scope", plugin: "quality", workflow: identity, scope: "validation" }]);
  });

  test("scope and remaining stages retain occurrence order without merging identical plugin or short-name identities", () => {
    expect(workflowPluginDependencies({
      enabled: new Set(["aidlc"]), ownership,
      workflows: [
        { ...workflow, state: { status: "Running", scope: "validation", stages: [{ slug: "check", state: "in-progress", suffix: "EXECUTE" }] } },
        { ...workflow, space: "other", displayName: "other/change-deadbeef" },
      ],
    })).toEqual([
      { kind: "scope", plugin: "quality", workflow: identity, scope: "validation" },
      { kind: "stage", plugin: "quality", workflow: identity, stage: "check" },
      { kind: "scope", plugin: "quality", workflow: { space: "other", recordName: "change-deadbeef", displayName: "other/change-deadbeef" }, scope: "validation" },
    ]);
  });

  test.each(["pending", "in-progress", "awaiting-approval", "revising"])("%s EXECUTE stages retain their plugin requirement", (state) => {
    expect(workflowPluginDependencies({
      enabled: new Set(["aidlc"]), ownership,
      workflows: [{ ...workflow, state: { status: "Running", scope: "feature", stages: [{ slug: "check", state, suffix: "EXECUTE (planned)" }] } }],
    })).toEqual([{ kind: "stage", plugin: "quality", workflow: identity, stage: "check" }]);
  });

  test("completed, skipped, non-EXECUTE, initialization and unknown stage rows do not require plugins", () => {
    expect(workflowPluginDependencies({
      enabled: new Set(["aidlc"]), ownership,
      workflows: [{ ...workflow, state: { status: "Running", scope: "unknown", stages: [
        { slug: "check", state: "completed", suffix: "EXECUTE" },
        { slug: "check", state: "skipped", suffix: "EXECUTE" },
        { slug: "check", state: "pending", suffix: "SKIP" },
        { slug: "check", state: "pending", suffix: " EXECUTE" },
        { slug: "bootstrap", state: "pending", suffix: "EXECUTE" },
        { slug: "unowned", state: "pending", suffix: "EXECUTE" },
      ] } }],
    })).toEqual([]);
  });

  test.each(["Completed", "Archived"])("%s state closes requirements even if its registry is still open", (status) => {
    expect(workflowPluginDependencies({
      enabled: new Set(), ownership,
      workflows: [{ ...workflow, state: { status, scope: "validation", stages: [{ slug: "check", state: "pending", suffix: "EXECUTE" }] } }],
    })).toEqual([]);
  });

  test("closed registry, absent record and absent state have no requirements", () => {
    expect(workflowPluginDependencies({
      enabled: new Set(), ownership,
      workflows: [{ ...workflow, registryClosed: true }, { ...workflow, recordName: null }, { ...workflow, state: null }],
    })).toEqual([]);
  });

  test.each(["Parked", "completed", "", "Running"])("upstream %s status retains requirements rather than inventing a lifecycle rule", (status) => {
    expect(workflowPluginDependencies({
      enabled: new Set(["aidlc"]), ownership,
      workflows: [{ ...workflow, state: { status, scope: "validation", stages: [] } }],
    })).toEqual([{ kind: "scope", plugin: "quality", workflow: identity, scope: "validation" }]);
  });

  test("unowned definitions belong to core and the effective enabled set is authoritative", () => {
    expect(workflowPluginDependencies({
      enabled: new Set(["quality"]), ownership,
      workflows: [{ ...workflow, state: { status: "Running", scope: "feature", stages: [{ slug: "implement", state: "pending", suffix: "EXECUTE" }, { slug: "check", state: "pending", suffix: "EXECUTE" }] } }],
    })).toEqual([
      { kind: "scope", plugin: "aidlc", workflow: identity, scope: "feature" },
      { kind: "stage", plugin: "aidlc", workflow: identity, stage: "implement" },
    ]);
  });

  test("known enabled ownership and absent ownership create no diagnostic", () => {
    expect(workflowPluginDependencies({
      enabled: new Set(["quality"]), ownership,
      workflows: [workflow, { ...workflow, state: { status: "Running", scope: null, stages: [] } }],
    })).toEqual([]);
  });
});
