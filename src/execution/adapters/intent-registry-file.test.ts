import { describe, expect, test } from "bun:test";
import { IntentRegistryFileSchema, type IntentRegistryFile } from "./intent-registry-file.ts";

const createdRow: IntentRegistryFile[number] = {
  uuid: "0193f6a2-7b4c-7d2e-9f1a-3c5b8e0d4a61",
  slug: "checkout-flow",
  dirName: "261108-checkout-flow",
  scope: "feature",
  repos: ["services/payments", "web/storefront"],
  repos_named: true,
  status: "in-flight",
  request: "q-intent-start-3",
};

const preSpikeRow: IntentRegistryFile[number] = {
  uuid: "5c1e9f2a-0b7d-4e3c-8a61-2f9d4b7e0c35",
  slug: "login-bug",
  status: "complete",
};

describe("IntentRegistryFileSchema", () => {
  test("reads a registry holding a full row and a row written before record folders", () => {
    expect(IntentRegistryFileSchema.parse([createdRow, preSpikeRow])).toEqual([
      createdRow,
      preSpikeRow,
    ]);
  });

  test("reads an empty registry", () => {
    expect(IntentRegistryFileSchema.parse([])).toEqual([]);
  });

  test("keeps only the fields a row is known to carry", () => {
    expect(IntentRegistryFileSchema.parse([{ ...preSpikeRow, owner: "sam" }])).toEqual([
      preSpikeRow,
    ]);
  });

  test("refuses a row whose uuid is not a uuid", () => {
    expect(
      IntentRegistryFileSchema.safeParse([{ ...preSpikeRow, uuid: "login-bug" }]),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_format", path: [0, "uuid"] }] },
    });
  });

  test("refuses a row that names its repos with anything but true", () => {
    expect(
      IntentRegistryFileSchema.safeParse([{ ...createdRow, repos_named: false }]),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_value", path: [0, "repos_named"] }] },
    });
  });

  test("refuses a row without a status", () => {
    expect(
      IntentRegistryFileSchema.safeParse([{ uuid: preSpikeRow.uuid, slug: preSpikeRow.slug }]),
    ).toMatchObject({
      success: false,
      error: { issues: [{ code: "invalid_type", path: [0, "status"] }] },
    });
  });
});
