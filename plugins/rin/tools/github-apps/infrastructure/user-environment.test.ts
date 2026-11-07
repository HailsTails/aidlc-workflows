import { afterEach, describe, expect, it, vi } from "vitest";
import { createProcessUserEnvironment } from "./user-environment.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createProcessUserEnvironment", () => {
  it("reads a variable from the process environment", () => {
    vi.stubEnv("RIN_GITHUB_APPS_CREDENTIALS_DIR", "/keys");

    expect(createProcessUserEnvironment().variable("RIN_GITHUB_APPS_CREDENTIALS_DIR")).toBe(
      "/keys",
    );
  });

  it("names this user's home directory as an absolute path", () => {
    expect(createProcessUserEnvironment().homeDirectory()).toMatch(/^(?:[A-Za-z]:)?[\\/]/);
  });
});
