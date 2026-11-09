import { expect, test } from "bun:test";
import { legacySettingsSchemaData } from "./legacy-settings-schema.ts";

test("runtime settings data retains the shipped JSON schema identity and version requirement", () => {
  expect(legacySettingsSchemaData()).toEqual({ kind: "text", text: expect.stringContaining(
    '"$id": "aidlc-settings.schema.json",\n  "title": "AI-DLC settings",\n  "type": "object",' +
    '\n  "additionalProperties": false,\n  "required": [\n    "schemaVersion"\n  ]',
  ) });
});
