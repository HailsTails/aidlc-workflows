// Audit-edge contracts use literal persisted fields; policy has its own observation-only suite.
import { expect, mock, test } from "bun:test";
import { collaboratorFault } from "../../tests/harness/collaborator-fault.ts";
import { auditAttemptFloor, auditAttemptObservations, auditIsolatedAttemptField, auditIsolatedAttemptState } from "./aidlc-attempt-audit.ts";
import type { AttemptAction, AttemptWorkflow } from "./aidlc-attempt-boundary.ts";
import type { AuditAttemptRequest } from "./aidlc-attempt-audit.ts";
import type { AuditShardEvent } from "./aidlc-record-core.ts";

function row(changes: Partial<AuditShardEvent> = {}): AuditShardEvent {
  return { event: "STAGE_STARTED", timestamp: "10", shard: "a", shardIndex: 0, pos: 4, block: "**Stage**: build\n**Workflow**: single-stage:build\n**Scope**: feature", ...changes };
}
const pipeline: AuditAttemptRequest = { scope: { stage: "build", mode: "pipeline", rejection: "reset" }, jumpTarget: () => "misses" };
const isolated: AuditAttemptRequest = { ...pipeline, scope: { stage: "build", mode: "isolated", rejection: "reset" } };

const decodeCases: { label: string; block: string; stage: string | null; workflow: AttemptWorkflow }[] = [
  { label: "missing fields", block: "unrecognized", stage: null, workflow: { mode: "pipeline" } },
  { label: "ordinary workflow", block: "**Stage**: build\n**Workflow**: feature", stage: "build", workflow: { mode: "pipeline" } },
  { label: "trimmed bullet fields", block: "- **Stage**: build \r\n- **Workflow**: single-stage:build ", stage: "build", workflow: { mode: "isolated", stage: "build" } },
  { label: "duplicate fields use the first", block: "**Stage**: build\n**Stage**: test\n**Workflow**: feature\n**Workflow**: single-stage:build", stage: "build", workflow: { mode: "pipeline" } },
  { label: "empty values", block: "**Stage**: \n**Workflow**: single-stage:", stage: "", workflow: { mode: "isolated", stage: "" } },
  { label: "no indentation recovery", block: " **Stage**: build\n **Workflow**: single-stage:build", stage: null, workflow: { mode: "pipeline" } },
  { label: "prefix is case sensitive", block: "**Stage**: build\n**Workflow**: Single-stage:build", stage: "build", workflow: { mode: "pipeline" } },
  { label: "nested stream text remains exact", block: "**Stage**: build\n**Workflow**: single-stage:build:again", stage: "build", workflow: { mode: "isolated", stage: "build:again" } },
  { label: "existing reader sees fenced field text", block: "```\n**Stage**: build\n**Workflow**: single-stage:build\n```", stage: "build", workflow: { mode: "isolated", stage: "build" } },
];
test.each(decodeCases)("$label", ({ block, stage, workflow }) => {
  const source = row({ block });
  expect(auditAttemptObservations([source], isolated)).toEqual([{ source, stage, workflow, action: "stage-start" }]);
  expect(auditAttemptObservations([source], isolated)[0].source).toBe(source);
});

const actionCases: { event: string; action: AttemptAction }[] = [
  { event: "WORKFLOW_STARTED", action: "workflow-start" },
  { event: "STAGE_STARTED", action: "stage-start" },
  { event: "STAGE_COMPLETED", action: "stage-complete" },
  { event: "GATE_REJECTED", action: "rejection" },
  { event: "STAGE_JUMPED", action: "unrelated" },
  { event: "UNRECOGNIZED", action: "unrelated" },
];
test.each(actionCases)("decode $event", ({ event, action }) => {
  expect(auditAttemptObservations([row({ event })], isolated)[0].action).toBe(action);
});

test("pipeline consults every jump in row order before excluding isolated workflows", () => {
  const jumpTarget = mock<AuditAttemptRequest["jumpTarget"]>().mockReturnValue("reaches");
  const first = row({ event: "STAGE_JUMPED", block: "**Workflow**: single-stage:other" });
  const second = row({ event: "STAGE_JUMPED", block: "**Workflow**: feature", pos: 9 });
  const floor = auditAttemptFloor([first, row(), second], { ...pipeline, jumpTarget });
  expect(jumpTarget.mock.calls).toEqual([["**Workflow**: single-stage:other", "build"], ["**Workflow**: feature", "build"]]);
  expect(floor?.rows).toEqual([second]);
  expect(floor?.rows[0]).toBe(second);
});

test("isolated decisions never consult jumps", () => {
  const jumpTarget = mock<AuditAttemptRequest["jumpTarget"]>().mockReturnValue("reaches");
  expect(auditAttemptFloor([row({ event: "STAGE_JUMPED" }), row()], { ...isolated, jumpTarget })?.timestamp).toBe("10");
  expect(jumpTarget).not.toHaveBeenCalled();
});

test("a jump dependency fault escapes unchanged and stops subsequent interpretation", () => {
  const failure = new Error("jump dependency unavailable");
  const jumpTarget = mock<AuditAttemptRequest["jumpTarget"]>().mockReturnValue("misses")
    .mockReturnValueOnce("reaches").mockImplementationOnce(collaboratorFault(failure));
  const query = mock(() => auditAttemptFloor([
    row({ event: "STAGE_JUMPED", block: "first" }),
    row({ event: "STAGE_JUMPED", block: "second" }),
    row({ event: "STAGE_JUMPED", block: "unvisited" }),
  ], { ...pipeline, jumpTarget }));
  expect(query).toThrow("jump dependency unavailable");
  expect(query.mock.results[0]?.value).toBe(failure);
  expect(jumpTarget.mock.calls).toEqual([["first", "build"], ["second", "build"]]);
});

const fieldCases = [
  { label: "present", block: "**Stage**: build\n**Workflow**: single-stage:build\n**Scope**: feature", expected: "feature" },
  { label: "missing", block: "**Stage**: build\n**Workflow**: single-stage:build", expected: null },
  { label: "first duplicate", block: "**Stage**: build\n**Workflow**: single-stage:build\n**Scope**: first\n**Scope**: second", expected: "first" },
  { label: "empty", block: "**Stage**: build\n**Workflow**: single-stage:build\n**Scope**: ", expected: "" },
  { label: "other stage", block: "**Stage**: test\n**Workflow**: single-stage:build\n**Scope**: feature", expected: null },
  { label: "other stream", block: "**Stage**: build\n**Workflow**: single-stage:test\n**Scope**: feature", expected: null },
];
test.each(fieldCases)("field $label", ({ block, expected }) => {
  expect(auditIsolatedAttemptField([row({ block })], { stage: "build", field: "Scope" })).toBe(expected);
});

test("latest start field uses stable sort and never falls back when that row omits it", () => {
  const earlier = row({ pos: 3 });
  const last = row({ block: "**Stage**: build\n**Workflow**: single-stage:build" });
  expect(auditIsolatedAttemptField([last, earlier], { stage: "build", field: "Scope" })).toBeNull();
  expect(auditIsolatedAttemptField([earlier, row({ block: "**Stage**: build\n**Workflow**: single-stage:build\n**Depth**: deep" })], { stage: "build", field: "Depth" })).toBe("deep");
});

test("the audit adapter reports an open start, its completion, and a cross-shard ambiguity", () => {
  expect(auditIsolatedAttemptState([row()], "build")).toBe("open");
  expect(auditIsolatedAttemptState([row(), row({ event: "STAGE_COMPLETED", pos: 5 })], "build")).toBe("completed");
  expect(auditIsolatedAttemptState([row(), row({ event: "STAGE_COMPLETED", shard: "b" })], "build")).toBe("ambiguous");
});
