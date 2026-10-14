import { describe, expect, test } from "vitest";
import { defaultPathOperations } from "../rin-harness-path-operations.ts";
import { defaultReviewProcessPort } from "./review-process-port.ts";

const runtime = defaultReviewProcessPort();

describe("review process boundary", () => {
  test("returns owned status/text data from synchronous execution", () => {
    const result = runtime.runSync({ program: "bun", args: ["--version"] });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect(Object.keys(result).sort()).toEqual(["status", "stderr", "stdout"]);
  });

  test("returns owned data after asynchronous child completion", async () => {
    const result = await runtime.run({ program: "bun", args: ["--version"] });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect(Object.keys(result).sort()).toEqual(["status", "stderr", "stdout"]);
  });

  test("a child that exits without reading its input still reports its status", async () => {
    const result = await runtime.run({ program: "bun", args: ["-e", "process.exit(3)"], input: "x".repeat(8_000_000) });
    expect(result.status).toBe(3);
  });

  test("startup failures do not expose Node error properties", async () => {
    await expect(runtime.run({ program: "__rin_review_missing_executable__", args: [] })).rejects.not.toHaveProperty("code");
  });
});


const paths = defaultPathOperations();
const fileUrlFailure = (url: string): unknown => {
  try { paths.fromFileUrl({ url }); return undefined; }
  catch (error) { return error; }
};

describe("review module location boundary", () => {
  test("malformed URLs expose no Node error properties", () => {
    expect(() => paths.fromFileUrl({ url: "not-a-url" })).toThrow(Error);
    expect(fileUrlFailure("not-a-url")).not.toHaveProperty("code");
  });

  test("non-file schemes expose no Node error properties", () => {
    expect(() => paths.fromFileUrl({ url: "https://invalid.test/module" })).toThrow(Error);
    expect(fileUrlFailure("https://invalid.test/module")).not.toHaveProperty("code");
  });
});


const syncCommandFailure = (): unknown => {
  try { runtime.runSync({ program: "\0", args: [] }); return undefined; }
  catch (error) { return error; }
};

describe("subprocess argument failure confinement", () => {
  test("synchronous launch validation exposes only an owned Error", () => {
    expect(() => runtime.runSync({ program: "\0", args: [] })).toThrow(Error);
    expect(syncCommandFailure()).toMatchObject({ name: "Error" });
    expect(syncCommandFailure()).not.toHaveProperty("code");
    expect(syncCommandFailure()).not.toHaveProperty("cause");
  });

  test("asynchronous launch validation rejects with an owned Error", async () => {
    await expect(runtime.run({ program: "\0", args: [] })).rejects.toMatchObject({ name: "Error" });
    await expect(runtime.run({ program: "\0", args: [] })).rejects.not.toHaveProperty("code");
    await expect(runtime.run({ program: "\0", args: [] })).rejects.not.toHaveProperty("cause");
  });
});
