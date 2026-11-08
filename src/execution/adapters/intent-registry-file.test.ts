import { describe, expect, test } from "bun:test";
import { IntentRegistryFileSchema } from "./intent-registry-file.ts";

const CREATED_ROW = `{
  "uuid": "0193f6a2-7b4c-7d2e-9f1a-3c5b8e0d4a61", "slug": "checkout-flow",
  "dirName": "261108-checkout-flow", "scope": "feature",
  "repos": ["services/payments", "web/storefront"], "repos_named": true,
  "status": "in-flight", "request": "q-intent-start-3"
}`;

const PRE_SPIKE_ROW = `{
  "uuid": "5c1e9f2a-0b7d-4e3c-8a61-2f9d4b7e0c35", "slug": "login-bug", "status": "complete"
}`;

const REGISTRY = `[${CREATED_ROW}, ${PRE_SPIKE_ROW}]`;

const PRE_SPIKE_REGISTRY = `[${PRE_SPIKE_ROW}]`;

const REGISTRY_WITH_AN_OWNER = `[{
  "uuid": "5c1e9f2a-0b7d-4e3c-8a61-2f9d4b7e0c35", "slug": "login-bug", "status": "complete",
  "owner": "sam"
}]`;

const REFUSED_REGISTRIES = [
  {
    shape: "a row whose uuid is not a uuid",
    text: '[{ "uuid": "login-bug", "slug": "login-bug", "status": "complete" }]',
    issues: [{ code: "invalid_format", path: [0, "uuid"] }],
  },
  {
    shape: "a row that names its repos with anything but true",
    text: `[{
      "uuid": "0193f6a2-7b4c-7d2e-9f1a-3c5b8e0d4a61", "slug": "checkout-flow",
      "status": "in-flight", "repos": ["web/storefront"], "repos_named": false
    }]`,
    issues: [{ code: "invalid_value", path: [0, "repos_named"] }],
  },
  {
    shape: "a row without a status",
    text: '[{ "uuid": "5c1e9f2a-0b7d-4e3c-8a61-2f9d4b7e0c35", "slug": "login-bug" }]',
    issues: [{ code: "invalid_type", path: [0, "status"] }],
  },
];

describe("IntentRegistryFileSchema", () => {
  test("reads a registry holding a full row and a row written before record folders", () => {
    expect(IntentRegistryFileSchema.parse(JSON.parse(REGISTRY))).toEqual(JSON.parse(REGISTRY));
  });

  test("reads an empty registry", () => {
    expect(IntentRegistryFileSchema.parse(JSON.parse("[]"))).toEqual([]);
  });

  test("keeps only the fields a row is known to carry", () => {
    expect(IntentRegistryFileSchema.parse(JSON.parse(REGISTRY_WITH_AN_OWNER))).toEqual(
      JSON.parse(PRE_SPIKE_REGISTRY),
    );
  });

  test.each(REFUSED_REGISTRIES)("refuses $shape", ({ text, issues }) => {
    expect(IntentRegistryFileSchema.safeParse(JSON.parse(text))).toMatchObject({
      success: false,
      error: { issues },
    });
  });
});
