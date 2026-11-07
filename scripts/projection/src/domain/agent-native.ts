import type { AgentHarnessBinding, AgentOrigin, AgentExecutionPolicy } from "./agent-definition.ts";
import { finding, type NativeTier, type Outcome } from "./model.ts";
import type { NativeResource } from "./native-rendering.ts";

export type AgentEmissionInput = {
  readonly origin: AgentOrigin;
  readonly binding: AgentHarnessBinding;
  readonly name: string;
  readonly description: string;
  readonly frontmatter: string;
  readonly body: string;
  readonly preflight: string;
  readonly nativeModel: NativeTier;
  readonly policy: AgentExecutionPolicy;
};
export type AgentNativeEmitter = {
  readonly emit: (input: AgentEmissionInput) => Outcome<readonly NativeResource[]>;
};
export type AgentFrontmatterInput = {
  readonly frontmatter: string;
  readonly nativeModel: NativeTier;
  readonly effortKey: "effort" | "variant" | "effortLevel";
  readonly removeKeys: readonly string[];
  readonly additions: readonly string[];
};
export const projectAgentFrontmatter = (input: AgentFrontmatterInput): string => {
  const fields = [
    ...(input.nativeModel.model === null ? [] : [`model: ${input.nativeModel.model}`]),
    ...(input.nativeModel.effort === null
      ? []
      : [`${input.effortKey}: ${input.nativeModel.effort}`]),
  ];
  const kept = input.frontmatter.split("\n").flatMap((line) => {
    if (input.removeKeys.includes(line.slice(0, line.indexOf(":")))) return [];
    if (/^(?:tier|model):/.test(line)) return fields;
    return [line];
  });
  return [...kept, ...input.additions].join("\n");
};
export const markdownAgentPersona = ({
  input,
  frontmatter,
}: {
  readonly input: AgentEmissionInput;
  readonly frontmatter: string;
}): string => `---\n${frontmatter}\n---\n${input.preflight}\n\n${input.body}`;
export type AgentMarkdownFormatters = {
  readonly frontmatter: typeof projectAgentFrontmatter;
  readonly persona: typeof markdownAgentPersona;
};
export const createAgentMarkdownFormatters = (): AgentMarkdownFormatters => ({
  frontmatter: projectAgentFrontmatter,
  persona: markdownAgentPersona,
});
export const createMarkdownAgentEmitter = (): AgentNativeEmitter => ({
  emit: (input) => {
    if (input.binding.harness !== "claude" && input.binding.harness !== "cursor")
      return {
        status: "invalid",
        findings: [
          finding({
            code: "capability-gap",
            subject: input.name,
            detail: `${input.binding.harness} requires its own native agent emitter`,
          }),
        ],
      };
    const frontmatter = projectAgentFrontmatter({
      frontmatter: input.frontmatter,
      nativeModel: input.nativeModel,
      effortKey: "effort",
      removeKeys: [],
      additions: [],
    });
    return {
      status: "ok",
      value: [
        {
          kind: "file",
          path: `${input.binding.directory}/agents/${input.name}.md`,
          body: markdownAgentPersona({ input, frontmatter }),
        },
      ],
    };
  },
});
