import { finding } from "../domain/model.ts";
import {
  createAgentMarkdownFormatters,
  type AgentMarkdownFormatters,
  type AgentNativeEmitter,
} from "../domain/agent-native.ts";

export const createCopilotAgentEmitter = ({
  formatters = createAgentMarkdownFormatters(),
}: {
  readonly formatters?: AgentMarkdownFormatters;
} = {}): AgentNativeEmitter => ({
  emit: (input) => {
    if (input.binding.harness !== "copilot")
      return {
        status: "invalid",
        findings: [
          finding({
            code: "harness-mismatch",
            subject: input.name,
            detail: "Copilot agent emitter requires copilot",
          }),
        ],
      };
    if (input.nativeModel.model !== null || input.nativeModel.effort !== null)
      return {
        status: "invalid",
        findings: [
          finding({
            code: "capability-gap",
            subject: input.name,
            detail: "Copilot worker agents inherit the session model and effort",
          }),
        ],
      };
    const frontmatter = formatters.frontmatter({
      frontmatter: input.frontmatter,
      nativeModel: { model: null, effort: null },
      effortKey: "effort",
      removeKeys: ["disallowedTools"],
      additions: ['tools: ["read", "edit", "search", "execute", "web", "todo"]'],
    });
    const engineFrontmatter = formatters.frontmatter({
      frontmatter: input.frontmatter,
      nativeModel: { model: null, effort: null },
      effortKey: "effort",
      removeKeys: [],
      additions: [],
    });
    return {
      status: "ok",
      value: [
        {
          kind: "file",
          path: `.github/agents/${input.name}.md`,
          body: formatters.persona({ input, frontmatter }),
        },
        {
          kind: "file",
          path: `.aidlc/agents/${input.name}.md`,
          body: formatters.persona({ input, frontmatter: engineFrontmatter }),
        },
      ],
    };
  },
});
