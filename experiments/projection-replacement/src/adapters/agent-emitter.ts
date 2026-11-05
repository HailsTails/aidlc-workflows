import type { AgentHarness } from "../domain/agent-definition.ts";
import { createMarkdownAgentEmitter, type AgentNativeEmitter } from "../domain/agent-native.ts";
import { createCodexAgentEmitter } from "./codex-agent.ts";
import { createCopilotAgentEmitter } from "./copilot-agent.ts";
import { createOpencodeAgentEmitter } from "./opencode-agent.ts";
import { createKasAgentEmitter } from "./kas-agent.ts";
import { createKiroAgentEmitter } from "./kiro-agent.ts";

export const createAgentEmitter = ({
  harness,
}: {
  readonly harness: AgentHarness;
}): AgentNativeEmitter => {
  switch (harness) {
    case "claude":
      return createMarkdownAgentEmitter();
    case "cursor":
      return createMarkdownAgentEmitter();
    case "codex":
      return createCodexAgentEmitter();
    case "copilot":
      return createCopilotAgentEmitter();
    case "opencode":
      return createOpencodeAgentEmitter();
    case "kiro":
      return createKiroAgentEmitter();
    case "kiro-ide":
      return createKasAgentEmitter();
  }
};
