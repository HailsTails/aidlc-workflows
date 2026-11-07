import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../core/platform-ports/file-text-port.ts";
import { overlaidFileText } from "./overlaid-file-text.ts";

const base: FileTextPort = {
  read: ({ path }) => ({ outcome: "ok", value: `base text of ${path}` }),
  exists: () => "absent",
  write: vi.fn<FileTextPort["write"]>(),
};

const overlay = overlaidFileText({ base, files: { "/repo/package.json": "overlaid text" } });

describe("overlaidFileText", () => {
  it("reads an overlaid file's text", () => {
    expect(overlay.read({ path: "/repo/package.json" })).toEqual({ outcome: "ok", value: "overlaid text" });
  });

  it("reads an overlaid file named with backslashes", () => {
    expect(overlay.read({ path: "\\repo\\package.json" })).toEqual({ outcome: "ok", value: "overlaid text" });
  });

  it("reads any other file through the base", () => {
    expect(overlay.read({ path: "/repo/README.md" })).toEqual({ outcome: "ok", value: "base text of /repo/README.md" });
  });

  it("finds an overlaid file present", () => {
    expect(overlay.exists({ path: "/repo/package.json" })).toBe("present");
  });

  it("asks the base whether any other file exists", () => {
    expect(overlay.exists({ path: "/repo/README.md" })).toBe("absent");
  });

  it("writes through the base", () => {
    expect(overlay.write).toBe(base.write);
  });
});
