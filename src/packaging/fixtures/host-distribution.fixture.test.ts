import { describe, expect, test } from "bun:test";
import { path } from "../../kernel/fixtures/values.fixture.ts";
import { claudeLayoutFixture } from "./claude-layout.fixture.ts";
import {
  claudeHostDistributionFixture,
  cursorNativeReleaseFixture,
  kiroIdeHostDistributionFixture,
} from "./host-distribution.fixture.ts";

describe("host distribution fixtures", () => {
  test("give claude its layout, an empty listing and no native changes", () => {
    expect(claudeHostDistributionFixture).toMatchObject({
      layout: claudeLayoutFixture,
      listing: {},
      native: { replacements: [], copyOnly: [] },
    });
  });

  test("give kiro-ide a CLI-first setup and a native replacement", () => {
    expect(kiroIdeHostDistributionFixture).toMatchObject({
      listing: { cliFirst: { env: ["KIRO_CLI"] } },
      native: { replacements: [{ from: "bun .kiro/tools/aidlc.ts", to: "aidlc" }] },
      plugin: { format: "kiro-ide", catalogue: "none" },
    });
  });

  test("mark cursor's installer as a copy-only file", () => {
    expect(cursorNativeReleaseFixture.copyOnly).toEqual([path("install.ts")]);
  });
});
