import { describe, expect, test } from "bun:test";
import { assessDependencies, type DependencySource } from "../../core/tools/workflow-plugin-dependencies/assessment.ts";
import { decodeOwnership, decodeState } from "../../core/tools/workflow-plugin-dependencies/persisted-records.ts";

// Test-only legacy corpus adapter. Production uses the component directly.
interface WorkflowPluginFacts {
  readonly space: string;
  readonly recordName: string | null;
  readonly displayName: string;
  readonly registryClosed: boolean;
  readonly state: {
    readonly status: string;
    readonly scope: string | null;
    readonly stages: readonly {
      readonly slug: string;
      readonly state: string;
      readonly suffix: string;
    }[];
  } | null;
}

interface WorkflowPluginOwnership {
  readonly scopes: readonly { readonly name: string; readonly plugin?: string }[];
  readonly stages: readonly { readonly slug: string; readonly phase: string; readonly plugin?: string }[];
}

type WorkflowPluginDependency = {
  readonly plugin: string;
  readonly workflow: Pick<WorkflowPluginFacts, "space" | "recordName" | "displayName">;
} & (
  | { readonly kind: "scope"; readonly scope: string }
  | { readonly kind: "stage"; readonly stage: string }
);


function workflowPluginDependencies(input: { enabled: ReadonlySet<string>; ownership: WorkflowPluginOwnership; workflows: readonly WorkflowPluginFacts[] }): WorkflowPluginDependency[] {
  const source: DependencySource = {
    ownership: () => decodeOwnership(input.ownership.scopes, input.ownership.stages),
    visitWorkflows: (visit) => input.workflows.forEach((facts) => visit({
      identity: { space: facts.space, name: facts.recordName, displayName: facts.displayName },
      lifecycle: facts.registryClosed ? "completed" : "other",
      readState: () => facts.state === null ? null : decodeState({ status: facts.state.status, scope: facts.state.scope, rows: facts.state.stages }),
    })),
  };
  return assessDependencies(source, input.enabled).map((reason) => {
    const workflow = { space: reason.workflow.space, recordName: reason.workflow.name, displayName: reason.workflow.displayName };
    return reason.kind === "scope" ? { kind: "scope", plugin: reason.plugin, workflow, scope: reason.scope } : { kind: "stage", plugin: reason.plugin, workflow, stage: reason.stage };
  });
}

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
