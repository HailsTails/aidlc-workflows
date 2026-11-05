import { expect, mock, test } from "bun:test";
import { createSqlitePublicationRepository, createPublicationRules, createSqlitePublicationOperations } from "./sqlite-publication.ts";
import { createPublicationRuleFixture, createPublicationOperationsFixture, createPublicationSession, firstPublication, firstSnapshot, publicationPayload } from "../../__tests__/publication-fixtures.ts";
test("reads native rows through the injected repository transaction", async () => {
  expect(await createSqlitePublicationRepository({ path: "unused", operations: createPublicationOperationsFixture(), rules: createPublicationRuleFixture() }).read()).toEqual({ status: "ok", value: firstSnapshot });
});
test("a malformed stored pair fails before publication", async () => {
  const session = { ...createPublicationSession(), rows: mock().mockReturnValue([{ revision: 1 }]) };
  expect(await createSqlitePublicationRepository({ path: "unused", operations: createPublicationOperationsFixture({ session }), rules: createPublicationRuleFixture() }).publish({ expectedHead: firstPublication.token, artifactPair: publicationPayload })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "projection-publication", detail: "persisted publications require complete archive/ownership pairs and a versioned digest chain" }] });
  expect(session.append).not.toHaveBeenCalled();
});
test("CAS refusal does not append a pair", async () => {
  const session = createPublicationSession();
  expect(await createSqlitePublicationRepository({ path: "unused", operations: createPublicationOperationsFixture({ session }), rules: createPublicationRuleFixture() }).publish({ expectedHead: null, artifactPair: publicationPayload })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "publication head changed; reload its artifact and ownership together before producing again" }] });
  expect(session.append).not.toHaveBeenCalled();
});
test("inserts a complete first pair inside the injected transaction", async () => {
  const session = { ...createPublicationSession(), rows: mock().mockReturnValue([]) };
  expect(await createSqlitePublicationRepository({ path: "unused", operations: createPublicationOperationsFixture({ session }), rules: createPublicationRuleFixture() }).publish({ expectedHead: null, artifactPair: publicationPayload })).toEqual({ status: "ok", value: firstSnapshot });
  expect(session.append).toHaveBeenCalledWith({ publication: firstPublication });
});
test("the production content rules reproduce the independent abc digest", () => {
  expect(createPublicationRules().digest({ bytes: new Uint8Array([97, 98, 99]) })).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(createPublicationRules().encode({ text: "abc" })).toEqual(new Uint8Array([97, 98, 99]));
});
test("production operations remain deferred until invoked", () => {
  expect(createSqlitePublicationOperations({ path: "unused" })).toEqual({ run: expect.any(Function) });
});
test("an in-memory path cannot masquerade as persisted publication", async () => {
  const action = mock();
  expect(await createSqlitePublicationOperations({ path: ":memory:" }).run({ mode: "write", action })).toEqual({ status: "invalid", findings: [{ code: "invalid-input", subject: "projection-publication", detail: "publication requires a persistent SQLite file path" }] });
  expect(action).not.toHaveBeenCalled();
});
