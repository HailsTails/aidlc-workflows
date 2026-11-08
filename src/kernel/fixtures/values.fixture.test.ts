import { describe, expect, test } from "bun:test";
import { at, distribution, hash, host, path, source, version } from "./values.fixture.ts";

const DEVELOPER_AGENT_HASH =
  "sha256:a730e4d4268c7906dd85885f4c2de66d3af4f045d2eb0ac03ddd48c08d3c5326";

describe("path", () => {
  test("returns a portable project path", () => {
    expect(path(".claude/agents/aidlc-developer-agent.md")).toBe<string>(
      ".claude/agents/aidlc-developer-agent.md",
    );
  });

  test("throws for an unportable project path", () => {
    expect(() => path(".claude\\agents")).toThrow(
      'Fixture value refused: {"kind":"invalid-path","base":"project","raw":".claude\\\\agents"}',
    );
  });
});

describe("source", () => {
  test("returns a portable source path", () => {
    expect(source("src/cli/main.ts")).toBe<string>("src/cli/main.ts");
  });

  test("throws for an unportable source path", () => {
    expect(() => source("src/../main.ts")).toThrow(
      'Fixture value refused: {"kind":"invalid-path","base":"source","raw":"src/../main.ts"}',
    );
  });
});

describe("distribution", () => {
  test("returns a distribution id", () => {
    expect(distribution("kiro-ide")).toBe<string>("kiro-ide");
  });

  test("throws for a name that is not kebab case", () => {
    expect(() => distribution("Kiro")).toThrow(
      'Fixture value refused: {"kind":"invalid-distribution-id","raw":"Kiro"}',
    );
  });
});

describe("hash", () => {
  test("returns a content hash", () => {
    expect(hash(DEVELOPER_AGENT_HASH)).toBe<string>(DEVELOPER_AGENT_HASH);
  });

  test("throws for a hash without its algorithm", () => {
    expect(() => hash("a730e4d4")).toThrow(
      'Fixture value refused: {"kind":"invalid-content-hash","raw":"a730e4d4"}',
    );
  });
});

describe("version", () => {
  test("returns a framework version", () => {
    expect(version("2.12.0")).toBe<string>("2.12.0");
  });

  test("throws for a version with a leading v", () => {
    expect(() => version("v2.12.0")).toThrow(
      'Fixture value refused: {"kind":"invalid-framework-version","raw":"v2.12.0"}',
    );
  });
});

describe("at", () => {
  test("returns a UTC timestamp", () => {
    expect(at("2026-11-08T09:30:00Z")).toBe<string>("2026-11-08T09:30:00Z");
  });

  test("throws for a timestamp with an offset", () => {
    expect(() => at("2026-11-08T09:30:00+01:00")).toThrow(
      'Fixture value refused: {"kind":"invalid-timestamp","raw":"2026-11-08T09:30:00+01:00"}',
    );
  });
});

describe("host", () => {
  test("pairs the distribution with its directory", () => {
    expect(host({ name: "claude", directory: ".claude" })).toEqual<{
      distribution: string;
      directory: string;
    }>({ distribution: "claude", directory: ".claude" });
  });

  test("throws for a directory that is not a portable path", () => {
    expect(() => host({ name: "claude", directory: ".claude/" })).toThrow(
      'Fixture value refused: {"kind":"invalid-path","base":"project","raw":".claude/"}',
    );
  });
});
