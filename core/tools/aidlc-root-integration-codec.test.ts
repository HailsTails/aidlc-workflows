// covers: function:encodeRootIntegration, function:decodeRootIntegrations

import { expect, test } from "bun:test";
import { decodeRootIntegrations, encodeRootIntegration } from "./aidlc-root-integration-codec.ts";

test.each(["jsonc-settings", "json-entries"])("%s ships over the older whole-file policy", (policy) => {
  expect(encodeRootIntegration({ integration: { path: "root.json", policy, optional: true } })).toEqual({ path: "root.json", policy: "whole-file", optional: true, extendedPolicy: policy });
});

test.each(["whole-file", "managed-block", "json-map", "json-array", "future-policy"])("other policies retain their declaration identity: %s", (policy) => {
  const integration = { path: "root.json", policy };
  expect(encodeRootIntegration({ integration })).toBe(integration);
  expect(integration).toEqual({ path: "root.json", policy });
});

test("an extended declaration gets a fresh shallow record with nested references retained", () => {
  const legacySignatures = { wholeFileHashes: ["retained-hash"] };
  const integration = { path: "root.json", policy: "json-entries", legacySignatures };
  const encoded = encodeRootIntegration({ integration });
  expect(encoded).not.toBe(integration);
  expect(encoded.legacySignatures).toBe(legacySignatures);
  expect(integration).toEqual({ path: "root.json", policy: "json-entries", legacySignatures: { wholeFileHashes: ["retained-hash"] } });
});

test("the encoded policy replaces an existing extension without changing field order", () => {
  expect(JSON.stringify(encodeRootIntegration({ integration: { extendedPolicy: "retired", policy: "json-entries", path: "root.json" } }))).toBe('{"extendedPolicy":"json-entries","policy":"whole-file","path":"root.json"}');
});

test.each(["jsonc-settings", "json-entries"])("a reader restores the recognized %s extension", (policy) => {
  expect(decodeRootIntegrations({ value: [{ path: "root.json", policy: "whole-file", extendedPolicy: policy, optional: true }] })).toEqual([{ path: "root.json", policy, optional: true }]);
});

test.each(["future-policy", null, 7, false])("an unrecognized extension is removed while retaining its base policy: %s", (extendedPolicy) => {
  expect(decodeRootIntegrations({ value: [{ path: "root.json", policy: "whole-file", extendedPolicy }] })).toEqual([{ path: "root.json", policy: "whole-file" }]);
});

test("the codec restores a recognized extension without adding base-policy validation", () => {
  expect(decodeRootIntegrations({ value: [{ path: "root.json", policy: "other-base", extendedPolicy: "json-entries" }] })).toEqual([{ path: "root.json", policy: "json-entries" }]);
});

test("direct declarations without an extension retain their object identity", () => {
  const integration = { path: "root.json", policy: "jsonc-settings" };
  expect(decodeRootIntegrations({ value: [integration] })).toContain(integration);
});

test.each([null, undefined, 42, "raw", true, { policy: "jsonc-settings" }])("non-array input is left to the caller's existing validation: %s", (wireIntegrations) => {
  expect(decodeRootIntegrations({ value: wireIntegrations })).toBe(wireIntegrations);
});

test("list positions and opaque non-object entries are preserved", () => {
  expect(decodeRootIntegrations({ value: [null, false, "raw", { policy: "whole-file" }, { policy: "whole-file", extendedPolicy: "json-entries" }] })).toEqual([null, false, "raw", { policy: "whole-file" }, { policy: "json-entries" }]);
});
