// covers: function:decideManagedFileChange

import { expect, test } from "bun:test";
import { assessRecordedRetirement, classifyManagedContent, decideManagedFileChange, decideManagedFileRecord, decideRecordedRetirement, decideWorkspaceSeed, type ManagedContentAuthority, type ManagedFileFacts, type ManagedFileDecision, type ManagedFileRecordFacts, type ManagedFileRecordDecision, type RecordedRetirementFacts, type RecordedRetirementAttribution, type RecordedRetirementDecision } from "./aidlc-managed-file-decision.ts";

const OWNED: ManagedFileFacts = Object.freeze({
  target: Object.freeze({ kind: "file", hash: "old" }),
  sourceHash: "new",
  recordedHash: "old",
  releaseHash: undefined,
  attribution: "not-adopted",
  proof: "available",
  overwrite: "protect",
});
const CASES: readonly { name: string; facts: ManagedFileFacts; expected: ManagedFileDecision }[] = [
  { name: "fresh absent file", facts: { ...OWNED, target: { kind: "absent" }, recordedHash: undefined }, expected: { kind: "copy", action: "create", detail: undefined } },
  { name: "identical incoming file", facts: { ...OWNED, target: { kind: "file", hash: "new" } }, expected: { kind: "preserve" } },
  { name: "unchanged recorded file advances", facts: OWNED, expected: { kind: "copy", action: "update", detail: undefined } },
  { name: "model release proves ownership", facts: { ...OWNED, recordedHash: undefined, releaseHash: "old" }, expected: { kind: "copy", action: "update", detail: undefined } },
  { name: "exact copy-era adoption", facts: { ...OWNED, recordedHash: undefined, attribution: "adopted-copy" }, expected: { kind: "copy", action: "update", detail: "adopted exact copy-channel signature" } },
  { name: "user edit is protected", facts: { ...OWNED, target: { kind: "file", hash: "user" } }, expected: { kind: "conflict", detail: "locally modified or unowned" } },
  { name: "unowned existing file is protected", facts: { ...OWNED, target: { kind: "file", hash: "user" }, recordedHash: undefined }, expected: { kind: "conflict", detail: "locally modified or unowned" } },
  { name: "directory at managed file is protected", facts: { ...OWNED, target: { kind: "other" } }, expected: { kind: "conflict", detail: "locally modified or unowned" } },
  { name: "unproven merge blocks recorded ownership", facts: { ...OWNED, proof: "unproven" }, expected: { kind: "conflict", detail: "locally modified or unowned" } },
  { name: "unproven merge blocks copy-era attribution", facts: { ...OWNED, proof: "unproven", attribution: "adopted-copy" }, expected: { kind: "conflict", detail: "locally modified or unowned" } },
  { name: "identical bytes precede unproven proof", facts: { ...OWNED, target: { kind: "file", hash: "new" }, proof: "unproven" }, expected: { kind: "preserve" } },
  { name: "force explicitly replaces an edit", facts: { ...OWNED, target: { kind: "file", hash: "user" }, overwrite: "force" }, expected: { kind: "copy", action: "update", detail: undefined } },
  { name: "force preserves legacy non-file replacement", facts: { ...OWNED, target: { kind: "other" }, overwrite: "force" }, expected: { kind: "copy", action: "update", detail: undefined } },
  { name: "force bypasses unproven merge hold", facts: { ...OWNED, proof: "unproven", overwrite: "force" }, expected: { kind: "copy", action: "update", detail: undefined } },
  { name: "absent destination needs no prior ownership", facts: { ...OWNED, target: { kind: "absent" }, proof: "unproven" }, expected: { kind: "copy", action: "create", detail: undefined } },
  { name: "empty record is not new ownership proof", facts: { ...OWNED, target: { kind: "file", hash: "" }, recordedHash: "", releaseHash: "other" }, expected: { kind: "conflict", detail: "locally modified or unowned" } },
];

test.each([...CASES])("ordinary managed-file policy: $name", ({ facts, expected }) => {
  expect(decideManagedFileChange(facts)).toEqual(expected);
});

test("frozen collected facts remain unchanged", () => {
  expect(decideManagedFileChange(OWNED)).toEqual({ kind: "copy", action: "update", detail: undefined });
  expect(OWNED.target).toEqual({ kind: "file", hash: "old" });
  expect(OWNED.recordedHash).toBe("old");
});

const RETIREMENT_FACTS: readonly { name: string; facts: RecordedRetirementFacts; expected: RecordedRetirementAttribution }[] = [
  { name: "missing target", facts: { target: { kind: "absent" }, recordedHash: "old", proof: "unproven" }, expected: { kind: "absent" } },
  { name: "missing target ignores supplied proof", facts: { target: { kind: "absent" }, recordedHash: "old", proof: "proven-retired" }, expected: { kind: "absent" } },
  { name: "recorded bytes", facts: { target: { kind: "file", hash: "old" }, recordedHash: "old", proof: "unproven" }, expected: { kind: "recorded" } },
  { name: "different bytes", facts: { target: { kind: "file", hash: "user" }, recordedHash: "old", proof: "unproven" }, expected: { kind: "unproven" } },
  { name: "proven retirement needs no observed hash", facts: { target: { kind: "file", hash: undefined }, recordedHash: "old", proof: "proven-retired" }, expected: { kind: "recorded" } },
  { name: "nonregular target", facts: { target: { kind: "other" }, recordedHash: "old", proof: "unproven" }, expected: { kind: "unproven" } },
  { name: "nonregular proof cannot attribute", facts: { target: { kind: "other" }, recordedHash: "old", proof: "proven-retired" }, expected: { kind: "unproven" } },
  { name: "undefined hash does not match record", facts: { target: { kind: "file", hash: undefined }, recordedHash: "old", proof: "unproven" }, expected: { kind: "unproven" } },
];

test.each([...RETIREMENT_FACTS])("recorded retirement attribution: $name", ({ facts, expected }) => {
  expect(assessRecordedRetirement(facts)).toEqual(expected);
});

const RETIREMENT_DECISIONS: readonly { name: string; facts: Parameters<typeof decideRecordedRetirement>[0]; expected: RecordedRetirementDecision }[] = [
  { name: "absent no-op", facts: { attribution: { kind: "absent" }, kiroProof: "unproven", overwrite: "protect" }, expected: { kind: "absent" } },
  { name: "absent wins over force and Kiro", facts: { attribution: { kind: "absent" }, kiroProof: "attributed", overwrite: "force" }, expected: { kind: "absent" } },
  { name: "recorded removal", facts: { attribution: { kind: "recorded" }, kiroProof: "unproven", overwrite: "protect" }, expected: { kind: "remove", cause: "recorded" } },
  { name: "recorded attribution precedes extra proof", facts: { attribution: { kind: "recorded" }, kiroProof: "attributed", overwrite: "force" }, expected: { kind: "remove", cause: "recorded" } },
  { name: "unowned conflict", facts: { attribution: { kind: "unproven" }, kiroProof: "unproven", overwrite: "protect" }, expected: { kind: "conflict", detail: "removed upstream but locally modified" } },
  { name: "Kiro attribution", facts: { attribution: { kind: "unproven" }, kiroProof: "attributed", overwrite: "protect" }, expected: { kind: "remove", cause: "kiro-upgrade" } },
  { name: "explicit force", facts: { attribution: { kind: "unproven" }, kiroProof: "unproven", overwrite: "force" }, expected: { kind: "remove", cause: "explicit-force" } },
  { name: "Kiro bookkeeping survives force", facts: { attribution: { kind: "unproven" }, kiroProof: "attributed", overwrite: "force" }, expected: { kind: "remove", cause: "kiro-upgrade" } },
];

test.each([...RETIREMENT_DECISIONS])("recorded retirement decision: $name", ({ facts, expected }) => {
  expect(decideRecordedRetirement(facts)).toEqual(expected);
});

const RETAINED_RECORD: ManagedFileRecordFacts = Object.freeze({
  mode: "retain",
  target: Object.freeze({ kind: "file", hash: "old" }),
  priorHash: "old",
  recordHash: "new",
  composedHash: undefined,
  regeneration: "regenerated",
  modelStamp: "unstamped",
});

const RECORD_CASES: readonly { name: string; facts: ManagedFileRecordFacts; expected: ManagedFileRecordDecision }[] = [
  { name: "regenerated unchanged file advances", facts: RETAINED_RECORD, expected: { kind: "record", hash: "new" } },
  { name: "local edit retains old ownership", facts: { ...RETAINED_RECORD, target: { kind: "file", hash: "user" } }, expected: { kind: "record", hash: "old" } },
  { name: "unchanged regeneration fact retains old record", facts: { ...RETAINED_RECORD, regeneration: "unchanged" }, expected: { kind: "record", hash: "old" } },
  { name: "missing target retains old record", facts: { ...RETAINED_RECORD, target: { kind: "absent" } }, expected: { kind: "record", hash: "old" } },
  { name: "nonregular target ignores stamped composition", facts: { ...RETAINED_RECORD, target: { kind: "other" }, composedHash: "composed", modelStamp: "stamped" }, expected: { kind: "record", hash: "old" } },
  { name: "unowned edit stays unrecorded", facts: { ...RETAINED_RECORD, priorHash: undefined, target: { kind: "file", hash: "user" } }, expected: { kind: "unrecorded" } },
  { name: "stamp and composition cannot manufacture prior proof", facts: { ...RETAINED_RECORD, priorHash: undefined, target: { kind: "file", hash: "user" }, composedHash: "composed", modelStamp: "stamped" }, expected: { kind: "unrecorded" } },
  { name: "stamped composition advances existing record", facts: { ...RETAINED_RECORD, target: { kind: "file", hash: "model" }, composedHash: "composed", modelStamp: "stamped" }, expected: { kind: "record", hash: "composed" } },
  { name: "composition alone does not attribute edit", facts: { ...RETAINED_RECORD, target: { kind: "file", hash: "user" }, composedHash: "composed" }, expected: { kind: "record", hash: "old" } },
  { name: "stamp alone does not attribute edit", facts: { ...RETAINED_RECORD, target: { kind: "file", hash: "user" }, modelStamp: "stamped" }, expected: { kind: "record", hash: "old" } },
  { name: "stamped composition requires regeneration", facts: { ...RETAINED_RECORD, target: { kind: "file", hash: "model" }, composedHash: "composed", modelStamp: "stamped", regeneration: "unchanged" }, expected: { kind: "record", hash: "old" } },
  { name: "unchanged target uses composed record", facts: { ...RETAINED_RECORD, composedHash: "composed" }, expected: { kind: "record", hash: "composed" } },
  { name: "release advance starts first record", facts: { ...RETAINED_RECORD, mode: "advance", priorHash: undefined, target: { kind: "absent" }, regeneration: "unchanged" }, expected: { kind: "record", hash: "new" } },
  { name: "release advance uses composed record", facts: { ...RETAINED_RECORD, mode: "advance", composedHash: "composed", target: { kind: "file", hash: "user" } }, expected: { kind: "record", hash: "composed" } },
  { name: "normalized record value remains authoritative", facts: { ...RETAINED_RECORD, recordHash: "normalized" }, expected: { kind: "record", hash: "normalized" } },
  { name: "undefined equality preserves existing policy", facts: { ...RETAINED_RECORD, priorHash: undefined, target: { kind: "file", hash: undefined } }, expected: { kind: "record", hash: "new" } },
  { name: "empty composed record is defined", facts: { ...RETAINED_RECORD, composedHash: "" }, expected: { kind: "record", hash: "" } },
];

test.each([...RECORD_CASES])("managed ownership record: $name", ({ facts, expected }) => {
  expect(decideManagedFileRecord(facts)).toEqual(expected);
});

const CONTENT_CASES: readonly { path: string; expected: ManagedContentAuthority }[] = [
  { path: "aidlc/active-space", expected: { kind: "workspace-seed" } },
  { path: "aidlc/spaces/default/memory/org.md", expected: { kind: "workspace-seed" } },
  { path: "aidlc/spaces/custom/memory/phases/construction.md", expected: { kind: "workspace-seed" } },
  { path: "aidlc/spaces/a/memory/", expected: { kind: "workspace-seed" } },
  { path: "aidlc/spaces/../memory/project.md", expected: { kind: "workspace-seed" } },
  { path: "aidlc/spaces/a\\b/memory/team.md", expected: { kind: "workspace-seed" } },
  { path: "aidlc/sessions/current.json", expected: { kind: "workspace-state" } },
  { path: "aidlc/spaces/default/intents/current.json", expected: { kind: "workspace-state" } },
  { path: "aidlc/active-space.extra", expected: { kind: "workspace-state" } },
  { path: "aidlc/active-space/child", expected: { kind: "workspace-state" } },
  { path: "aidlc/spaces/default/memory", expected: { kind: "workspace-state" } },
  { path: "aidlc/spaces//memory/org.md", expected: { kind: "workspace-state" } },
  { path: "aidlc/spaces/a/nested/memory/org.md", expected: { kind: "workspace-state" } },
  { path: "aidlc/spaces/a/memory-extra/org.md", expected: { kind: "workspace-state" } },
  { path: "aidlc/", expected: { kind: "workspace-state" } },
  { path: ".claude/tools/aidlc.ts", expected: { kind: "release-managed" } },
  { path: "aidlc", expected: { kind: "release-managed" } },
  { path: "aidlc-extra/active-space", expected: { kind: "release-managed" } },
  { path: "Aidlc/active-space", expected: { kind: "release-managed" } },
  { path: "aidlc\\active-space", expected: { kind: "release-managed" } },
  { path: "./aidlc/active-space", expected: { kind: "release-managed" } },
  { path: "", expected: { kind: "release-managed" } },
];

test.each([...CONTENT_CASES])("managed content authority: $path", ({ path, expected }) => {
  expect(classifyManagedContent({ path })).toEqual(expected);
});

test("existing workspace seed is project-owned", () => {
  expect(decideWorkspaceSeed({ target: "present" })).toEqual({ kind: "preserve", detail: "project-owned seed" });
});

test("missing workspace seed is created", () => {
  expect(decideWorkspaceSeed({ target: "absent" })).toEqual({ kind: "create" });
});
