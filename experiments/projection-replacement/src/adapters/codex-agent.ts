import { finding } from "../domain/model.ts";
import {
  createAgentMarkdownFormatters,
  type AgentMarkdownFormatters,
  type AgentEmissionInput,
  type AgentNativeEmitter,
} from "../domain/agent-native.ts";

const codexRole = (input: AgentEmissionInput): string => {
  const instructions = `${input.preflight}\n\n${input.body.trimStart()}`
    .trimEnd()
    .replaceAll("\\", "\\\\")
    .replaceAll('"""', '\\"\\"\\"');
  return [
    `name = ${JSON.stringify(input.name)}`,
    `description = ${JSON.stringify(input.description.replace(/\s+/g, " ").trim())}`,
    ...(input.nativeModel.model === null
      ? []
      : [`model = ${JSON.stringify(input.nativeModel.model)}`]),
    ...(input.nativeModel.effort === null
      ? []
      : [`model_reasoning_effort = ${JSON.stringify(input.nativeModel.effort)}`]),
    `developer_instructions = """\n${instructions}\n"""`,
    "",
  ].join("\n");
};
export const createCodexAgentEmitter = ({
  formatters = createAgentMarkdownFormatters(),
}: {
  readonly formatters?: AgentMarkdownFormatters;
} = {}): AgentNativeEmitter => ({
  emit: (input) => {
    if (input.binding.harness !== "codex")
      return {
        status: "invalid",
        findings: [
          finding({
            code: "harness-mismatch",
            subject: input.name,
            detail: "Codex role emitter requires codex",
          }),
        ],
      };
    const frontmatter = formatters.frontmatter({
      frontmatter: input.frontmatter,
      nativeModel: input.nativeModel,
      effortKey: "effort",
      removeKeys: [],
      additions: [],
    });
    return {
      status: "ok",
      value: [
        { kind: "file", path: `.codex/agents/${input.name}.toml`, body: codexRole(input) },
        {
          kind: "file",
          path: `.codex/agents/${input.name}.md`,
          body: formatters.persona({ input, frontmatter }),
        },
      ],
    };
  },
});
