import { describe, expect, test } from "vitest";
import { parseSettings, readSettingsFile } from "./settings-parse.ts";

const validSettings = JSON.stringify({
  permissions: { allow: ["Bash(ls *)"] },
  hooks: {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [{ type: "command", command: "bun guard.ts" }],
      },
    ],
    PostToolUse: [],
  },
});

describe("parseSettings", () => {
  test("parses a valid settings shape", () => {
    const result = parseSettings(validSettings);
    expect(result).toEqual({
      outcome: "parsed",
      settings: {
        permissions: { allow: ["Bash(ls *)"] },
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "bun guard.ts" }],
            },
          ],
          PostToolUse: [],
        },
      },
    });
  });

  test("reports unreadable when the payload is not JSON", () => {
    const result = parseSettings("{ not json");
    expect(result.outcome).toBe("failed");
    expect(result.outcome === "failed" ? result.failure.reason : null).toBe(
      "unreadable",
    );
  });

  test("reports invalid-shape when hooks.PreToolUse is absent", () => {
    const result = parseSettings(JSON.stringify({ hooks: {} }));
    expect(result).toEqual({
      outcome: "failed",
      failure: { reason: "invalid-shape" },
    });
  });

  test("preserves unmodelled top-level and entry keys", () => {
    const result = parseSettings(
      JSON.stringify({
        model: "opus",
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "bun guard.ts" }],
            },
          ],
        },
      }),
    );
    expect(result.outcome === "parsed" ? result.settings.model : null).toBe(
      "opus",
    );
  });
});

describe("readSettingsFile", () => {
  test("parses the content the reader returns", () => {
    const result = readSettingsFile({
      path: "settings.json",
      readFile: () => validSettings,
    });
    expect(result.outcome).toBe("parsed");
  });

  test("passes the requested path to the reader", () => {
    const seenPaths: string[] = [];
    readSettingsFile({
      path: ".claude/settings.json",
      readFile: (path) => {
        seenPaths.push(path);
        return validSettings;
      },
    });
    expect(seenPaths).toEqual([".claude/settings.json"]);
  });

  test("reports unreadable when the reader throws", () => {
    const result = readSettingsFile({
      path: "absent.json",
      readFile: () => {
        throw new Error("ENOENT: no such file or directory");
      },
    });
    expect(result).toEqual({
      outcome: "failed",
      failure: {
        reason: "unreadable",
        detail: "Error: ENOENT: no such file or directory",
      },
    });
  });

  test("reports invalid-shape when the reader returns a wrong shape", () => {
    const result = readSettingsFile({
      path: "settings.json",
      readFile: () => JSON.stringify({ hooks: {} }),
    });
    expect(result).toEqual({
      outcome: "failed",
      failure: { reason: "invalid-shape" },
    });
  });
});
