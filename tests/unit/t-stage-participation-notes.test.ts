// covers: function:stageParticipationNote function:withAgentNotes function:briefNote
import { describe, expect, test } from "bun:test";
import { stageParticipationNote, validateDirective, withAgentNotes } from "../../core/tools/aidlc-directive.ts";

const invocation = "aidlc engine orchestrate";
function step(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { kind: "run-stage", stage: "rin-gate-1-framing", phase: "inception",
    stage_file: ".claude/aidlc-common/stages/inception/rin-gate-1-framing.md",
    lead_agent: "rin-lead", mode: "inline", gate: true, approval_mode: "autonomous",
    ceremony: { summary_confirmation: "off", learnings: "on" }, protocol_modules: [], ...extra };
}
function noted(extra: Record<string, unknown> = {}) { return withAgentNotes(step(extra), invocation); }

describe("stage participation reaches every worker without creating a human reply", () => {
  test("omitted policy keeps the human default", () => {
    expect(stageParticipationNote()).toContain("human approval");
    expect(stageParticipationNote()).toContain("do not add an approval gate where none is declared");
    expect(stageParticipationNote("human")).toBe(stageParticipationNote());
    expect(String(noted({ approval_mode: undefined }).participation_note)).toBe(stageParticipationNote());
  });
  test("autonomous work retains reserved decisions and verification", () => {
    const note = String(noted().participation_note);
    for (const text of ["without a routine interview", "Reserved operator decisions", "never invent", "summary confirmation", "review", "sensors", "freshness", "Explicit human checkpoints", "conductor owns"]) expect(note).toContain(text);
    expect(noted().brief_note).toBeUndefined();
  });
  for (const mode of ["subagent", "pipeline", "mob", "wave"]) {
    test(`${mode} carries the identical instruction and existing notes`, () => {
      const d = noted({ mode: mode === "wave" ? "inline" : mode, ...(mode === "wave" ? { wave: {} } : {}), other_work_note: "Leave other work alone.", brought_files_note: "Keep brought files." });
      expect(String(d.brief_note)).toContain(String(d.participation_note));
      expect(String(d.brief_note)).toEndWith("Leave other work alone. Keep brought files.");
    });
  }
  test("repeated projection removes stale answer-mode prompts", () => {
    const d = noted({ answer_mode: { mode: null, ask: true }, answer_mode_note: "Ask the person how to answer." });
    expect(d.answer_mode).toBeUndefined();
    expect(d.answer_mode_note).toBeUndefined();
    expect(withAgentNotes(d, invocation)).toEqual(d);
  });
  test("ordinary gate-only presentation does not resurrect human approval", () => {
    expect(String(noted({ gate_only: true }).gate_note)).toContain("without a human approval menu");
  });
  for (const checkpoint of ["construction_checkpoint", "swarm_checkpoint", "unit_gate"]) {
    test(`${checkpoint} keeps its human gate instruction`, () => {
      expect(String(noted({ gate_only: true, [checkpoint]: {} }).gate_note)).not.toContain("without a human approval menu");
    });
  }
  test("Unit and unresolved routing retain their instructions", () => {
    expect(noted({ unit_record_step: "Record this Unit." }).gate_note).toBe("Record this Unit.");
    expect(String(noted({ gate: "unresolved" }).gate_note)).toContain("skeleton");
  });
  test("the new note is known and type checked", () => {
    expect(JSON.stringify(validateDirective(step({ participation_note: "Follow the policy." })))).not.toContain("participation_note");
    expect(JSON.stringify(validateDirective(step({ participation_note: 7 })))).toContain("participation_note must be a non-empty string");
  });
});
