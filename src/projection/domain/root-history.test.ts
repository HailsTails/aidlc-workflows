import { expect, mock, test } from "bun:test";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { accept } from "../../kernel/fixtures/accept.ts";
import { path } from "../../kernel/fixtures/values.fixture.ts";
import { rootHistoryContent, serializeRootHistory, type RootSerialization, type RootHistorySnapshot } from "./root-history.ts";
import { nativePolicyObligation } from "./native-policy.ts";

const current: RootSerialization = { path: path("AGENTS.md"), mode: "regular", content: { kind: "text", text: "Native\n" },
  origin: { kind: "rendered", concept: "onboarding", name: "AGENTS.md" } };
const historical: RootSerialization = { ...current, content: { kind: "text", text: "Copy authoring, native tokens\n" } };
type RootSerializer = (view: "current" | "copy-authoring") => Result<RootSerialization, string>;

test("the actual serializer records both successful views and preserves the source origin", () => {
  const serialize = mock<RootSerializer>()
    .mockReturnValueOnce(accepted(current)).mockReturnValueOnce(accepted(historical));
  const file = accept(serializeRootHistory({ serialize, mismatch: "Destination changed" }));
  expect(file).toEqual<Omit<RootSerialization, "origin"> & { readonly origin: {
    readonly kind: "root-history"; readonly source: RootSerialization["origin"]; readonly history: RootHistorySnapshot;
  } }>({ ...current, origin: { kind: "root-history", source: current.origin,
    history: { path: path("AGENTS.md"), mode: "regular", text: "Native\n", copyAuthoring: "Copy authoring, native tokens\n" } } });
  expect(serialize.mock.calls).toEqual([["current"], ["copy-authoring"]]);
  expect(rootHistoryContent(file)).toBe("Copy authoring, native tokens\n");
  expect(nativePolicyObligation(file)).toBeUndefined();
});

test("current refusal prevents the historical serialization", () => {
  const serialize = mock().mockReturnValue(refused("Current failed"));
  expect(serializeRootHistory({ serialize, mismatch: "Destination changed" })).toEqual(refused("Current failed"));
  expect(serialize.mock.calls).toEqual([["current"]]);
});

test("historical serialization refusal remains data", () => {
  const serialize = mock().mockReturnValueOnce(accepted(current)).mockReturnValueOnce(refused("Historical failed"));
  expect(serializeRootHistory({ serialize, mismatch: "Destination changed" })).toEqual(refused("Historical failed"));
});

test.each([
  { ...historical, path: path("OTHER.md") },
  { ...historical, mode: "executable" as const },
])("two serializer views must retain destination and mode: %j", (changed) => {
  const serialize = mock().mockReturnValueOnce(accepted(current)).mockReturnValueOnce(accepted(changed));
  expect(serializeRootHistory({ serialize, mismatch: "Destination changed" })).toEqual(refused("Destination changed"));
});

test.each([
  { path: path("OTHER.md") },
  { mode: "executable" as const },
  { content: { kind: "text" as const, text: "Changed\n" } },
  { content: { kind: "bytes" as const, bytes: new Uint8Array([78]) } },
])("changed snapshots cannot supply compatibility signatures: %j", (change) => {
  const serialize = mock().mockReturnValueOnce(accepted(current)).mockReturnValueOnce(accepted(historical));
  const file = accept(serializeRootHistory({ serialize, mismatch: "Destination changed" }));
  expect(rootHistoryContent({ ...file, ...change })).toBeUndefined();
});

test("ordinary projected files retain their existing signature behavior", () => {
  expect(rootHistoryContent(current)).toBeUndefined();
});
