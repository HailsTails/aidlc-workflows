import { expect, test } from "bun:test";
import { source } from "../../kernel/fixtures/values.fixture.ts";
import { createSourceFiles } from "./source-files.ts";

const files = createSourceFiles(new URL("../../../core/", import.meta.url));

test("the filesystem edge captures sorted, portable source names and raw bytes", async () => {
  const captured = await files.read(source("scopes"));
  expect(captured).toMatchObject([
    { within: "aidlc-bugfix.md", content: { kind: "bytes", bytes: expect.any(Uint8Array) } },
    { within: "aidlc-classic.md" }, { within: "aidlc-enterprise.md" },
    { within: "aidlc-express.md" }, { within: "aidlc-feature.md" },
    { within: "aidlc-infra.md" }, { within: "aidlc-mvp.md" }, { within: "aidlc-poc.md" },
    { within: "aidlc-refactor.md" }, { within: "aidlc-security-patch.md" },
    { within: "aidlc-workshop.md" },
  ]);
});
