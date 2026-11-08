import { afterEach, expect, test } from "bun:test";
import { createSourceModuleFixtures } from "./source-module-fixture.ts";

const fixtures = createSourceModuleFixtures();
afterEach(fixtures.cleanup);

test("module fixtures replace exact authored text and load the owned module", async () => {
  const root = fixtures.create([]);
  fixtures.write({ root, relative: "entry.ts", text: 'export const marker = "before";' });
  fixtures.change({ root, relative: "entry.ts", before: '"before"', after: '"after"' });
  const loaded = await fixtures.load({ root, relative: "entry.ts" });
  expect(loaded.marker).toBe("after");
  expect(fixtures.read({ root, relative: "entry.ts" })).toBe('export const marker = "after";');
  expect(() => fixtures.change({ root, relative: "entry.ts", before: "absent", after: "ignored" })).toThrow("exactly one occurrence");
});

test("module fixtures reject ambiguous replacements", () => {
  const root = fixtures.create([]);
  fixtures.write({ root, relative: "entry.ts", text: "duplicate duplicate" });
  expect(() => fixtures.change({ root, relative: "entry.ts", before: "duplicate", after: "ignored" })).toThrow("exactly one occurrence");
  expect(fixtures.read({ root, relative: "entry.ts" })).toBe("duplicate duplicate");
});
