// Synthetic message and reply records exercise cleanup durability, not a real
// person's authorization. No test here appends or fabricates a HUMAN_TURN.
import { describe, expect, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as lib from "../../core/tools/aidlc-lib.ts";
import * as messages from "../../core/tools/aidlc-message-store.ts";
import * as plan from "../../core/tools/aidlc-plan-approval-ask.ts";
import { recordPlanApprovalHumanResponse } from "../../core/tools/aidlc-testing-posture.ts";
import { noteClaudeTurnPending, settleClaudeTurns } from "../../core/tools/aidlc-claude-turn-origin.ts";
import { claudeTurnsPending, settleClaudeTurnsFirst } from "../../core/tools/aidlc-claude-turn-pending.ts";
import { hostTurnFactRel, inspectHostTurnEvidence } from "../../core/tools/aidlc-turn-origin-evidence.ts";
import { REPO_ROOT, seedStateFile, seededStateFile } from "../harness/fixtures.ts";

function fixture(withWork = false) {
  const dir = mkdtempSync(join(tmpdir(), "t-host-origin-durable-"));
  mkdirSync(join(dir, "aidlc", "spaces", "default", "memory"), { recursive: true });
  writeFileSync(join(dir, "aidlc", "active-space"), "default\n");
  if (withWork) seedStateFile(dir, "state-mid-inception.md");
  const prompt = "Synthetic scheduled reply";
  const message = messages.saveMessage(dir, {
    session: "origin-fixture", at: new Date().toISOString(), source: "prompt", text: prompt, words: prompt,
    picker: null, settings: [], route: { scope: null, newIntent: false, skip: [], add: [], projectType: null },
  });
  const transcript = join(dir, "origin.jsonl");
  writeFileSync(transcript, `${JSON.stringify({ type: "user", promptId: "target", message: { role: "user", content: prompt }, turnOrigin: "scheduled" })}\n`);
  lib.withAuditLock(dir, () => noteClaudeTurnPending(dir, "origin-fixture", { message: message.id, transcript, promptId: "target" }));
  const messagePath = join(dir, "aidlc", ".aidlc-sessions", "messages", `${message.id}.json`);
  const factPath = join(dir, hostTurnFactRel(message.id));
  const protectedPath = lib.planApprovalRuntimeFile(dir, "protected-question-response-origin-fixture.json");
  lib.writeProtectedResponse(dir, { version: 1, session: "origin-fixture", challengeId: "a".repeat(32),
    words: prompt, replies: [{ words: prompt, messageId: message.id }],
    responseSha256: createHash("sha256").update(prompt).digest("hex") });
  const planPath = lib.planApprovalRuntimeFile(dir, `ask-${createHash("sha256").update("bare-space").digest("hex").slice(0, 24)}.json`);
  writeFileSync(planPath, JSON.stringify({ version: 1, intentId: "bare-space", askId: "b".repeat(32), targets: [{}],
    question: "Fixture question", choices: [], mode: "ask", replies: [{ text: prompt, messageId: message.id }] }));
  const legacyPath = lib.planApprovalRuntimeFile(dir, "response-origin-fixture.json");
  lib.writePlanApprovalResponse(dir, { version: 1, session: "origin-fixture", challengeId: "c".repeat(32), words: prompt,
    responseSha256: createHash("sha256").update(prompt).digest("hex"), replies: [{ words: prompt, messageId: message.id }] });
  return { dir, prompt, message, transcript, messagePath, factPath, protectedPath, planPath, legacyPath };
}
function restartSettle(dir: string) {
  const script = `import {settleClaudeTurnsFirst} from ${JSON.stringify(join(REPO_ROOT, "core/tools/aidlc-claude-turn-pending.ts"))}; settleClaudeTurnsFirst(${JSON.stringify(dir)});`;
  const result = spawnSync(process.execPath, ["-e", script], { encoding: "utf8", env: process.env });
  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
}
const raw = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, "utf8"));
const fact = (f: ReturnType<typeof fixture>) => raw(existsSync(f.factPath) ? f.factPath : join(f.dir, hostTurnFactRel(f.message.id, true)));

describe("confirmed host origin outlives cleanup", () => {
  test("failed withdrawals and deletion cannot spend the message; restart finishes from the fact alone", () => {
    const f = fixture();
    const protectedFailure = spyOn(lib, "withdrawProtectedReplyWords").mockImplementation(() => { throw new Error("injected protected cleanup failure"); });
    const planFailure = spyOn(plan, "withdrawPlanApprovalReplies").mockImplementation(() => { throw new Error("injected plan cleanup failure"); });
    const deletionFailure = spyOn(messages, "forgetMessage").mockImplementation(() => { throw new Error("injected message deletion failure"); });
    try {
      expect("message" in messages.proveMessage(f.dir, f.message.id, "request", { request: true })).toBe(true);
      settleClaudeTurns(f.dir);
      expect(existsSync(f.messagePath)).toBe(true);
      expect(fact(f).cleanup).toBeDefined();
      expect(raw(f.protectedPath).replies).toHaveLength(1);
      expect(raw(f.planPath).replies).toHaveLength(1);
      expect(messages.readMessage(f.dir, f.message.id)).toBeNull();
      expect(messages.listMessages(f.dir)).toEqual([]);
      expect("refusal" in messages.proveMessage(f.dir, f.message.id, "request", { request: true })).toBe(true);
      expect(lib.readProtectedResponse(f.dir, "origin-fixture")).toBeNull();
      expect(plan.readPlanApprovalAsk(f.dir, "bare-space")?.replies).toEqual([]);
      expect(claudeTurnsPending(f.dir)).toBe(false);
      protectedFailure.mockRestore(); planFailure.mockRestore(); deletionFailure.mockRestore();
      unlinkSync(f.transcript);
      restartSettle(f.dir);
      expect(fact(f).cleanup).toBeUndefined();
      expect(existsSync(f.messagePath)).toBe(false);
      expect(existsSync(f.protectedPath)).toBe(false);
      expect(raw(f.planPath).replies).toEqual([]);
      const ids = [f.message.id, "1234abcd"];
      expect(messages.mintMessageId(f.dir, () => ids.shift()!)).toBe("1234abcd");
      restartSettle(f.dir);
      expect(inspectHostTurnEvidence(f.dir, f.message.id).kind).toBe("host");
    } finally {
      protectedFailure.mockRestore(); planFailure.mockRestore(); deletionFailure.mockRestore();
      rmSync(f.dir, { recursive: true, force: true });
    }
  });

  test("failed initial persistence keeps negative evidence for this command and retains the retry key", () => {
    const f = fixture();
    const write = lib.writeRecordFileNoFollow;
    const failure = spyOn(lib, "writeRecordFileNoFollow").mockImplementation((root, path, data) => {
      if (path === hostTurnFactRel(f.message.id)) throw new Error("injected evidence write failure");
      return write(root, path, data);
    });
    try {
      settleClaudeTurns(f.dir);
      expect(existsSync(f.factPath)).toBe(false);
      expect(claudeTurnsPending(f.dir)).toBe(true);
      expect(existsSync(f.messagePath)).toBe(true);
      expect(inspectHostTurnEvidence(f.dir, f.message.id).kind).toBe("host");
      expect("refusal" in messages.proveMessage(f.dir, f.message.id, "request", { request: true })).toBe(true);
      failure.mockRestore();
      settleClaudeTurnsFirst(f.dir);
      expect(fact(f).cleanup).toBeUndefined();
      expect(claudeTurnsPending(f.dir)).toBe(false);
    } finally { failure.mockRestore(); rmSync(f.dir, { recursive: true, force: true }); }
  });

  test("failed compaction leaves the full durable fact for an idempotent restart", () => {
    const f = fixture();
    const write = lib.writeRecordFileNoFollow;
    const failure = spyOn(lib, "writeRecordFileNoFollow").mockImplementation((root, path, data) => {
      if (path === hostTurnFactRel(f.message.id) && !("cleanup" in JSON.parse(String(data)))) throw new Error("injected compaction failure");
      return write(root, path, data);
    });
    try {
      settleClaudeTurns(f.dir);
      expect(fact(f).cleanup).toBeDefined();
      expect(existsSync(f.messagePath)).toBe(false);
      failure.mockRestore(); unlinkSync(f.transcript); restartSettle(f.dir);
      expect(fact(f).cleanup).toBeUndefined();
      expect(inspectHostTurnEvidence(f.dir, f.message.id).kind).toBe("host");
    } finally { failure.mockRestore(); rmSync(f.dir, { recursive: true, force: true }); }
  });

  test.each(["invalid json", "invalid shape", "directory"])("%s is unavailable negative evidence, not absence", (shape) => {
    const f = fixture();
    try {
      mkdirSync(join(f.dir, "aidlc", ".aidlc-sessions", "host-turns"), { recursive: true });
      if (shape === "directory") mkdirSync(f.factPath);
      else writeFileSync(f.factPath, shape === "invalid json" ? "{" : JSON.stringify({ kind: "person" }));
      expect(inspectHostTurnEvidence(f.dir, f.message.id).kind).toBe("unavailable");
      expect(messages.readMessage(f.dir, f.message.id)).toBeNull();
      expect(() => messages.mintMessageId(f.dir, () => f.message.id)).toThrow("origin evidence is unavailable");
      expect("refusal" in messages.proveMessage(f.dir, f.message.id, "request", { request: true })).toBe(true);
    } finally { rmSync(f.dir, { recursive: true, force: true }); }
  });
});


test("a compact fact stranded before archive is discovered and moved without weakening evidence", () => {
  const f = fixture();
  const archive = join(f.dir, hostTurnFactRel(f.message.id, true));
  const write = lib.writeRecordFileNoFollow;
  const failure = spyOn(lib, "writeRecordFileNoFollow").mockImplementation((root, path, data) => {
    const result = write(root, path, data);
    if (path === hostTurnFactRel(f.message.id) && !("cleanup" in JSON.parse(String(data)))) mkdirSync(archive, { recursive: true });
    return result;
  });
  try {
    settleClaudeTurns(f.dir);
    expect(raw(f.factPath).cleanup).toBeUndefined();
    expect(inspectHostTurnEvidence(f.dir, f.message.id).kind).toBe("host");
    expect("refusal" in messages.proveMessage(f.dir, f.message.id, "request", { request: true })).toBe(true);
    failure.mockRestore();
    rmSync(archive, { recursive: true });
    unlinkSync(f.transcript);
    restartSettle(f.dir);
    expect(existsSync(f.factPath)).toBe(false);
    expect(raw(archive).kind).toBe("host");
  } finally { failure.mockRestore(); rmSync(f.dir, { recursive: true, force: true }); }
});

test("an observer classifies negative evidence without locks, directories or cleanup writes", () => {
  const f = fixture();
  const before = process.env.AIDLC_STOP_HOOK_PROBE;
  const capture = () => readdirSync(f.dir, { recursive: true, withFileTypes: true }).map(entry => {
    const path = join(entry.parentPath, entry.name);
    return [path, entry.isFile() ? readFileSync(path, "base64") : "directory"];
  }).sort((a, b) => a[0]!.localeCompare(b[0]!));
  try {
    const files = capture();
    process.env.AIDLC_STOP_HOOK_PROBE = "1";
    settleClaudeTurns(f.dir);
    expect(capture()).toEqual(files);
    expect(existsSync(f.factPath)).toBe(false);
    expect(inspectHostTurnEvidence(f.dir, f.message.id).kind).toBe("host");
    expect(messages.readMessage(f.dir, f.message.id)).toBeNull();
    expect(claudeTurnsPending(f.dir)).toBe(true);
  } finally {
    if (before === undefined) delete process.env.AIDLC_STOP_HOOK_PROBE; else process.env.AIDLC_STOP_HOOK_PROBE = before;
    rmSync(f.dir, { recursive: true, force: true });
  }
});

test.each([false, true])("guard readers and transactions reject a host response, with repeat-text legacy=%s left unbound", (legacy) => {
  const f = fixture(true);
  let failure: { mockRestore(): void } | undefined;
  try {
    const state = readFileSync(seededStateFile(f.dir), "utf8");
    lib.writeActiveDirectiveMarker(f.dir, { kind: "ask", stage: "requirements-analysis", ask_type: "guard-recovery",
      state_sha256: lib.stateDigest(state), remedies: [{ op: "request-changes", action: "Ask what should change.", interaction: "human-input" }] });
    expect(lib.consumeSharedDirectiveAsk(f.dir, f.prompt, undefined, f.message.id)).toBe(true);
    if (legacy) {
      // A later same-text reply from an old caller carries no message identity.
      lib.transactActiveDirective(f.dir, marker => ({ marker: { ...marker!, revision: marker!.revision! + 1,
        guard_recovery_response: { ...marker!.guard_recovery_response!, message_id: undefined } }, result: undefined }));
    }
    const markerPath = lib.transactActiveDirective(f.dir, (marker, target) => ({ marker, preserve: true, result: target.markerPath }));
    const transaction = lib.transactActiveDirective;
    failure = spyOn(lib, "transactActiveDirective").mockImplementation(<T,>(...args: Parameters<typeof lib.transactActiveDirective<T>>): T => {
      if (args[4] === true) throw new Error("injected guard cleanup failure");
      return transaction(...args);
    });
    settleClaudeTurns(f.dir);
    expect(raw(markerPath).guard_recovery_response).toBeDefined();
    expect(lib.readActiveDirectiveMarker(f.dir, state)?.guard_recovery_response !== undefined).toBe(legacy);
    const visible = transaction(f.dir, marker => ({ marker, preserve: true, result: marker?.guard_recovery_response }));
    expect(visible !== undefined).toBe(legacy);
    if (!legacy) expect(() => lib.recordGuardRecoveryChoice(f.dir, "request-changes", true)).toThrow("has not replied");
    failure.mockRestore();
    settleClaudeTurnsFirst(f.dir);
    // Modern IDs withdraw exactly their response. Old unbound words are not guessed.
    expect(raw(markerPath).guard_recovery_response !== undefined).toBe(legacy);
    expect(lib.consumeSharedDirectiveAsk(f.dir, f.prompt, undefined, "1234abcd")).toBe(true);
    expect(lib.readActiveDirectiveMarker(f.dir, state)?.guard_recovery_response?.message_id).toBe("1234abcd");
  } finally { failure?.mockRestore(); rmSync(f.dir, { recursive: true, force: true }); }
});

test.each(["protected", "plan", "guard", "legacy plan"])("unreadable %s material keeps cleanup active until its original owner can read it", (kind) => {
  const f = fixture(kind === "guard");
  try {
    let path = kind === "protected" ? f.protectedPath : kind === "legacy plan" ? f.legacyPath : f.planPath;
    if (kind === "guard") {
      const state = readFileSync(seededStateFile(f.dir), "utf8");
      lib.writeActiveDirectiveMarker(f.dir, { kind: "ask", stage: "requirements-analysis", ask_type: "guard-recovery",
        state_sha256: lib.stateDigest(state), remedies: [{ op: "request-changes", action: "Ask what should change.", interaction: "human-input" }] });
      expect(lib.consumeSharedDirectiveAsk(f.dir, f.prompt, undefined, f.message.id)).toBe(true);
      path = lib.transactActiveDirective(f.dir, (marker, target) => ({ marker, preserve: true, result: target.markerPath }));
    }
    const bytes = readFileSync(path);
    // An unreadable directory replaces the leaf, without permissions changes.
    unlinkSync(path); mkdirSync(path);
    settleClaudeTurns(f.dir);
    expect(raw(f.factPath).cleanup).toBeDefined();
    expect(inspectHostTurnEvidence(f.dir, f.message.id).kind).toBe("host");
    expect(existsSync(join(f.dir, hostTurnFactRel(f.message.id, true)))).toBe(false);
    rmSync(path, { recursive: true }); writeFileSync(path, bytes);
    unlinkSync(f.transcript);
    restartSettle(f.dir);
    expect(existsSync(f.factPath)).toBe(false);
    expect(fact(f).cleanup).toBeUndefined();
    if (kind === "protected" || kind === "legacy plan") expect(existsSync(path)).toBe(false);
    if (kind === "plan") expect(raw(path).replies).toEqual([]);
    if (kind === "guard") expect(raw(path).guard_recovery_response).toBeUndefined();
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
test.each(["missing session", "missing words"])("malformed protected response with %s never completes cleanup", (kind) => {
  const f = fixture();
  try {
    const bytes = readFileSync(f.protectedPath);
    const bad = kind === "missing session" ? {} : { ...raw(f.protectedPath), words: undefined };
    writeFileSync(f.protectedPath, JSON.stringify(bad));
    settleClaudeTurns(f.dir);
    expect(raw(f.factPath).cleanup).toBeDefined();
    writeFileSync(f.protectedPath, bytes);
    unlinkSync(f.transcript);
    restartSettle(f.dir);
    expect(existsSync(f.factPath)).toBe(false);
    expect(existsSync(f.protectedPath)).toBe(false);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
test("legacy response attribution preserves its exact word suffix and more than sixteen separate replies", () => {
  const f = fixture();
  try {
    lib.writePlanApprovalChallenge(f.dir, { version: 1, session: "origin-fixture", challengeId: "c".repeat(32),
      options: ["Approve Plan", "Request Changes"], requireExactOptionLabels: false, hashedOptionLabels: false,
      targetId: "fixture", intentId: "bare-space", runFloor: "fixture", fingerprint: "f".repeat(64), questionsFile: "fixture.md",
      promptSha256: "a".repeat(64), directiveEpoch: "fixture", sourceFloor: "fixture", markerRevision: 1, plannedSourceSha256: "b".repeat(64) });
    const other = Array.from({ length: 20 }, (_, i) => `Other synthetic reply ${i}`);
    for (let i = 0; i < other.length; i++) {
      expect(recordPlanApprovalHumanResponse(f.dir, "origin-fixture", other[i], undefined, i.toString(16).padStart(8, "0")).recorded).toBe(true);
    }
    expect(lib.readPlanApprovalResponse(f.dir, "origin-fixture")?.words).toBe([f.prompt, ...other].join("\n"));
    settleClaudeTurns(f.dir);
    expect(lib.readPlanApprovalResponse(f.dir, "origin-fixture")?.words).toBe(other.join("\n"));
    let expected = other.join("\n");
    for (const text of ["x".repeat(8000), "abc", "y".repeat(7999), "tail"]) {
      expected = `${expected}\n${text}`.slice(-8000);
      expect(recordPlanApprovalHumanResponse(f.dir, "origin-fixture", text, undefined, "abcd1234").recorded).toBe(true);
      expect(lib.readPlanApprovalResponse(f.dir, "origin-fixture")?.words).toBe(expected);
    }
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});