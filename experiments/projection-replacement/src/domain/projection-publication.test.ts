import { expect, test } from "bun:test";
import { inspectPublicationHistory, preparePublication } from "./projection-publication.ts";
import { createPublicationRuleFixture, emptyPublication, firstPublication, firstSnapshot, publicationPayload } from "../../__tests__/publication-fixtures.ts";
test("builds a first publication using independent SHA-256 vectors", () => {
  expect(preparePublication({ snapshot: emptyPublication, expectedHead: null, artifactPair: publicationPayload, rules: createPublicationRuleFixture() })).toEqual({ status: "ok", value: firstPublication });
});
test("reads a complete digest-proven committed pair", () => {
  expect(inspectPublicationHistory({ publications: [firstPublication], rules: createPublicationRuleFixture() })).toEqual({ status: "ok", value: firstSnapshot });
});
test("an empty store has an explicit absent head", () => {
  expect(inspectPublicationHistory({ publications: [], rules: createPublicationRuleFixture() })).toEqual({ status: "ok", value: emptyPublication });
});
test("stale producers cannot replace a newer head", () => {
  expect(preparePublication({ snapshot: firstSnapshot, expectedHead: null, artifactPair: publicationPayload, rules: createPublicationRuleFixture() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "publication head changed; reload its artifact and ownership together before producing again" }] });
});
test("a changed archive refuses history admission", () => {
  expect(inspectPublicationHistory({ publications: [{ ...firstPublication, archive: new Uint8Array([100]) }], rules: createPublicationRuleFixture() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "published bytes or history changed; preserve the store and resolve its ownership before publishing" }] });
});
test("unchanged archive bytes cannot hide changed ownership JSON", () => {
  expect(inspectPublicationHistory({ publications: [{ ...firstPublication, ownershipJson: "changed" }], rules: createPublicationRuleFixture() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "published bytes or history changed; preserve the store and resolve its ownership before publishing" }] });
});
test("a valid pair digest cannot bypass a missing predecessor", () => {
  expect(inspectPublicationHistory({ publications: [{ ...firstPublication, revision: 2, previous: firstPublication.token, token: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }], rules: createPublicationRuleFixture() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "published bytes or history changed; preserve the store and resolve its ownership before publishing" }] });
});
test("a valid pair and predecessor cannot bypass a revision gap", () => {
  expect(inspectPublicationHistory({ publications: [firstPublication, { ...firstPublication, revision: 3, previous: firstPublication.token, token: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }], rules: createPublicationRuleFixture() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "published bytes or history changed; preserve the store and resolve its ownership before publishing" }] });
});
test("a valid pair and revision cannot bypass an incorrect predecessor", () => {
  expect(inspectPublicationHistory({ publications: [firstPublication, { ...firstPublication, revision: 2, token: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" }], rules: createPublicationRuleFixture() })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "projection-publication", detail: "published bytes or history changed; preserve the store and resolve its ownership before publishing" }] });
});
test("archive bytes alone cannot publish without an ownership record", () => {
  expect(preparePublication({ snapshot: emptyPublication, expectedHead: null, artifactPair: { ...publicationPayload, ownershipJson: "" }, rules: createPublicationRuleFixture() })).toEqual({ status: "invalid", findings: [{ code: "empty-integration", subject: "projection-publication", detail: "publication requires both native archive bytes and ownership JSON" }] });
});
test("does not publish half a pair", () => {
  expect(preparePublication({ snapshot: emptyPublication, expectedHead: null, artifactPair: { ...publicationPayload, archive: new Uint8Array() }, rules: createPublicationRuleFixture() })).toEqual({ status: "invalid", findings: [{ code: "empty-integration", subject: "projection-publication", detail: "publication requires both native archive bytes and ownership JSON" }] });
});
