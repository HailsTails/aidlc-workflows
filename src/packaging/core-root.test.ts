import { expect, mock, test } from "bun:test";
import { accepted } from "../kernel/result.ts";
import { createBuildPackaging } from "./core-root.ts";

test("Packaging captures one build version and binds it into its stamp", () => {
  const version = mock(() => accepted("2.11.4-preview.20261109.1"));
  const packaging = createBuildPackaging(version);
  expect(version).toHaveBeenCalledTimes(1);
  expect(packaging.stamp({ kind: "text", text: 'export const AIDLC_VERSION = "2.11.3";' }))
    .toEqual(accepted({ kind: "text", text: 'export const AIDLC_VERSION = "2.11.4-preview.20261109.1";' }));
});
