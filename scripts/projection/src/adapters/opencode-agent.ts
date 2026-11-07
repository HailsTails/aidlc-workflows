import { finding } from "../domain/model.ts";
import {
  createAgentMarkdownFormatters,
  type AgentMarkdownFormatters,
  type AgentNativeEmitter,
} from "../domain/agent-native.ts";

export const createOpencodeAgentEmitter = ({
  formatters = createAgentMarkdownFormatters(),
}: {
  readonly formatters?: AgentMarkdownFormatters;
} = {}): AgentNativeEmitter => ({
  emit: (input) => {
    if (input.binding.harness !== "opencode")
      return {
        status: "invalid",
        findings: [
          finding({
            code: "harness-mismatch",
            subject: input.name,
            detail: "OpenCode agent emitter requires opencode",
          }),
        ],
      };
    const frontmatter = formatters.frontmatter({
      frontmatter: input.frontmatter,
      nativeModel: input.nativeModel,
      effortKey: "variant",
      removeKeys: ["disallowedTools", "maxTurns"],
      additions: ["mode: subagent", ...(input.policy.turnLimit === null ? [] : [`steps: ${input.policy.turnLimit}`]), "permission:", "  task: deny"],
    });
    const engineFrontmatter = formatters.frontmatter({
      frontmatter: input.frontmatter,
      nativeModel: input.nativeModel,
      effortKey: "variant",
      removeKeys: [],
      additions: [],
    });
    return {
      status: "ok",
      value: [
        {
          kind: "file",
          path: `.opencode/agents/${input.name}.md`,
          body: formatters.persona({ input: { ...input, body: input.body.replace(/`maxTurns: (\d+)`/g, "`steps: $1`") }, frontmatter }),
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
