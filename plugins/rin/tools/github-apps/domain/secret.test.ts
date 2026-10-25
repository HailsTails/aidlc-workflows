import { describe, expect, it } from "vitest";
import { secret } from "./secret.ts";

describe("secret", () => {
  it("reveals the sensitive text only when asked by name", () => {
    expect(secret("ghs_installation").reveal()).toBe("ghs_installation");
  });

  it("redacts itself when serialised", () => {
    expect(JSON.stringify({ token: secret("ghs_installation") })).toBe('{"token":"[redacted]"}');
  });

  it("redacts itself when interpolated", () => {
    expect(`token=${secret("ghs_installation").toString()}`).toBe("token=[redacted]");
  });

  it("redacts itself when inspected by the runtime", () => {
    expect(secret("ghs_installation")[Symbol.for("nodejs.util.inspect.custom")]?.()).toBe(
      "[redacted]",
    );
  });
});
