import { expect, test } from "bun:test";
import { decideJsonMapEntry, type JsonMapEntryFacts, type JsonMapEntryDecision } from "./aidlc-json-map-decision.ts";

const OWNED: JsonMapEntryFacts = Object.freeze({
  incoming: Object.freeze({ kind: "present", hash: "new" }),
  current: Object.freeze({ kind: "present", hash: "old" }),
  recordedHash: "old",
  legacySignature: "unmatched",
  overwrite: "protect",
  addition: "allow",
});

const CASES: readonly { name: string; facts: JsonMapEntryFacts; expected: JsonMapEntryDecision }[] = [
  { name: "new entry", facts: { ...OWNED, current: { kind: "absent" }, recordedHash: undefined }, expected: { kind: "set", recordHash: "new" } },
  { name: "missing incoming entry skipped in present-only mode", facts: { ...OWNED, current: { kind: "absent" }, addition: "present-only" }, expected: { kind: "preserve" } },
  { name: "force cannot bypass present-only mode", facts: { ...OWNED, current: { kind: "absent" }, addition: "present-only", overwrite: "force" }, expected: { kind: "preserve" } },
  { name: "recorded entry update", facts: OWNED, expected: { kind: "set", recordHash: "new" } },
  { name: "present-only mode still updates existing entry", facts: { ...OWNED, addition: "present-only" }, expected: { kind: "set", recordHash: "new" } },
  { name: "edited recorded entry remains personal", facts: { ...OWNED, current: { kind: "present", hash: "user" } }, expected: { kind: "preserve" } },
  { name: "edited recorded entry accepts explicit force", facts: { ...OWNED, current: { kind: "present", hash: "user" }, overwrite: "force" }, expected: { kind: "set", recordHash: "new" } },
  { name: "recorded entry already equal keeps ownership without write", facts: { ...OWNED, current: { kind: "present", hash: "new" } }, expected: { kind: "record", hash: "new" } },
  { name: "force equal recorded entry follows update precedence", facts: { ...OWNED, current: { kind: "present", hash: "new" }, overwrite: "force" }, expected: { kind: "set", recordHash: "new" } },
  { name: "unowned entry cannot be force claimed", facts: { ...OWNED, recordedHash: undefined, overwrite: "force" }, expected: { kind: "preserve" } },
  { name: "equal unowned entry does not become owned", facts: { ...OWNED, recordedHash: undefined, current: { kind: "present", hash: "new" } }, expected: { kind: "preserve" } },
  { name: "legacy signature adopts exact entry", facts: { ...OWNED, recordedHash: undefined, legacySignature: "matched" }, expected: { kind: "set", recordHash: "new" } },
  { name: "legacy signature cannot override edited recorded entry", facts: { ...OWNED, current: { kind: "present", hash: "user" }, legacySignature: "matched" }, expected: { kind: "preserve" } },
  { name: "empty incoming record is not attribution", facts: { ...OWNED, recordedHash: "", overwrite: "force" }, expected: { kind: "preserve" } },
  { name: "empty record still permits exact legacy adoption", facts: { ...OWNED, recordedHash: "", legacySignature: "matched" }, expected: { kind: "set", recordHash: "new" } },
  { name: "retired unchanged entry removed", facts: { ...OWNED, incoming: { kind: "absent" } }, expected: { kind: "remove" } },
  { name: "retired edited entry preserved", facts: { ...OWNED, incoming: { kind: "absent" }, current: { kind: "present", hash: "user" } }, expected: { kind: "preserve" } },
  { name: "retired recorded edit can be forced", facts: { ...OWNED, incoming: { kind: "absent" }, current: { kind: "present", hash: "user" }, overwrite: "force" }, expected: { kind: "remove" } },
  { name: "absent retired entry is no-op", facts: { ...OWNED, incoming: { kind: "absent" }, current: { kind: "absent" }, overwrite: "force" }, expected: { kind: "preserve" } },
  { name: "unowned retirement cannot be forced", facts: { ...OWNED, incoming: { kind: "absent" }, recordedHash: undefined, overwrite: "force", legacySignature: "matched" }, expected: { kind: "preserve" } },
  { name: "retirement compares empty prior exactly", facts: { ...OWNED, incoming: { kind: "absent" }, recordedHash: "", current: { kind: "present", hash: "" } }, expected: { kind: "remove" } },
  { name: "retirement can force defined empty record", facts: { ...OWNED, incoming: { kind: "absent" }, recordedHash: "", overwrite: "force" }, expected: { kind: "remove" } },
  { name: "legacy proof alone cannot retire an entry", facts: { ...OWNED, incoming: { kind: "absent" }, recordedHash: undefined, legacySignature: "matched" }, expected: { kind: "preserve" } },
];

test.each([...CASES])("JSON-map entry authority: $name", ({ facts, expected }) => {
  expect(decideJsonMapEntry(facts)).toEqual(expected);
});

test("frozen observed facts remain unchanged", () => {
  expect(decideJsonMapEntry(OWNED)).toEqual({ kind: "set", recordHash: "new" });
  expect(OWNED).toEqual({ incoming: { kind: "present", hash: "new" }, current: { kind: "present", hash: "old" }, recordedHash: "old", legacySignature: "unmatched", overwrite: "protect", addition: "allow" });
});
