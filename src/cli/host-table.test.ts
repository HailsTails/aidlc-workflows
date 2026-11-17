import { expect, test } from "bun:test";
import { host } from "../kernel/fixtures/values.fixture.ts";
import { BINDING_HEADINGS, HOSTS, HOST_BUILD_REFUSALS, hostModule } from "./host-table.ts";

test("every registered host module builds, so the table reports no refusals", () => {
  expect(HOST_BUILD_REFUSALS).toEqual([]);
});

test("the table lists the seven hosts in registration order with their own folders", () => {
  expect(HOSTS[0]?.host).toEqual(host({ name: "claude", directory: ".claude" }));
  expect(HOSTS[1]?.host).toEqual(host({ name: "kiro", directory: ".kiro" }));
  expect(HOSTS[2]?.host).toEqual(host({ name: "kiro-ide", directory: ".kiro" }));
  expect(HOSTS[3]?.host).toEqual(host({ name: "codex", directory: ".codex" }));
  expect(HOSTS[4]?.host).toEqual(host({ name: "cursor", directory: ".cursor" }));
  expect(HOSTS[5]?.host).toEqual(host({ name: "opencode", directory: ".aidlc" }));
  expect(HOSTS[6]?.host).toEqual(host({ name: "copilot", directory: ".aidlc" }));
  expect(HOSTS).toHaveLength(7);
});

test("each module carries the binding heading its own folder declares", () => {
  expect(BINDING_HEADINGS).toEqual({
    claude: "Claude Code", kiro: "Kiro CLI", "kiro-ide": "Kiro IDE", codex: "Codex CLI",
    cursor: "Cursor", opencode: "opencode", copilot: "GitHub Copilot",
  });
});

test("a registered host is found by its identity and an unregistered one is not", () => {
  const claude = host({ name: "claude", directory: ".claude" });
  expect(hostModule(claude)).toBe(HOSTS[0]);
  expect(hostModule(host({ name: "fixture-host", directory: ".fixture" }))).toBeUndefined();
});
