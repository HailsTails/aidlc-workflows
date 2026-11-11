import { host } from "../../kernel/fixtures/values.fixture.ts";
import { expect, test } from "bun:test";
import { kiroHostIdentity, KIRO_BINDING_HEADING, KIRO_HOST_DATA, KIRO_TOKENS, KIRO_AUTHORED_PLACEMENTS } from "./host-data.ts";

test("Kiro declares its v2 layout and conversation surface", () => {
  expect(KIRO_HOST_DATA.productName).toBe("Kiro CLI");
  expect(KIRO_HOST_DATA.configNextStep).toBe("run `kiro-cli --v2` (Kiro CLI 2.21.4 or later; for an older one, see the AI-DLC Kiro CLI guide), then `/aidlc --doctor`");
  expect(KIRO_HOST_DATA.rulesFolder).toBe("steering");
  expect(KIRO_HOST_DATA.kiroLayout).toBe("agent-v1");
  expect(KIRO_HOST_DATA.hostShell).toEqual({ env: ["KIRO_SESSION_ID"] });
  expect(KIRO_HOST_DATA.newChatStep).toEqual({ text: "type /chat new, then <entry>" });
  expect(KIRO_TOKENS).toEqual({ ["SKILL_INVOKE"]: null, ["OPTION_LETTERS"]: "A-E" });
});

test("Kiro supplies plugin agent frontmatter for each distribution channel", () => {
  expect(KIRO_HOST_DATA.pluginAgentFrontmatter).toEqual({
    copy: ['tools: ["read", "write", "shell"]', "includeMcpJson: true"],
    native: ['tools: ["read", "write", "shell"]', "includeMcpJson: true"],
  });
});

test("Kiro places ancillary authored files without taking the settings producer's inputs", () => {
  expect(KIRO_AUTHORED_PLACEMENTS).toEqual([
    { source: "hooks/aidlc-kiro-adapter.ts", destination: ".kiro/hooks/aidlc-kiro-adapter.ts" },
    { source: "settings/mcp.json", destination: ".kiro/settings/mcp.json" },
    { source: "dot-gitignore", destination: ".gitignore" },
  ]);
});

test("Kiro owns its protocol binding heading", () => {
  expect(KIRO_BINDING_HEADING).toBe("Kiro CLI");
});

test("Kiro owns its checked distribution identity and native directory", () => {
  expect(kiroHostIdentity()).toEqual({ ok: true, value: host({ name: "kiro", directory: ".kiro" }) });
});
