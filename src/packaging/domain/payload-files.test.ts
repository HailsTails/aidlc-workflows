import { expect, test } from "bun:test";
import { hash, path } from "../../kernel/fixtures/values.fixture.ts";
import type { PayloadFile } from "./payload.ts";
import { orderedPayloadFiles } from "./payload-files.ts";

const textFile: PayloadFile = { path: path(".claude/example.md"),
  hash: hash("sha256:0000000000000000000000000000000000000000000000000000000000000000"),
  content: { kind: "text", text: "Authored content\n" }, mode: "regular",
  origin: { kind: "version-stamp" },
};

test("one destination cannot have two owners even with identical bytes", () => {
  expect(orderedPayloadFiles([textFile, textFile])).toMatchObject({ ok: false,
    refusal: [{ kind: "duplicate-path", path: ".claude/example.md" }] });
});

test("an admitted payload retains the exact content and origin", () => {
  expect(orderedPayloadFiles([textFile])).toEqual({ ok: true, value: [textFile] });
});
