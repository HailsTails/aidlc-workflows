import { expect, test } from "bun:test";
import { createTemporaryDirectoryOperations } from "./temporary-directory.ts";
import { successful } from "../../__tests__/support.ts";
test("an unallocated directory is refused as data before filesystem cleanup", async () => {
  expect(await createTemporaryDirectoryOperations().remove({ root: "user-project" })).toEqual({ status: "invalid", findings: [{ code: "foreign-content", subject: "user-project", detail: "cleanup requires a root allocated by this directory instance" }] });
});
test("composition: an owned temporary directory is released after use", async () => {
  const directories = createTemporaryDirectoryOperations();
  const root = successful(await directories.allocate());
  await Bun.write(`${root}/probe.txt`, "private output");
  expect(await directories.remove({ root })).toEqual({ status: "ok", value: "removed" });
  expect(await Bun.file(`${root}/probe.txt`).exists()).toBe(false);
});
