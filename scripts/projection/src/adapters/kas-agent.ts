import { z } from "zod";
import type { AgentOrigin } from "../domain/agent-definition.ts";
import type { WorkerAdmissionBinding, WorkerPolicyBasis } from "../domain/worker-policy.ts";
import { finding, type Outcome } from "../domain/model.ts";
import {
  createAuthoredYaml,
  canonicalYamlMappingText,
  type AuthoredYaml,
} from "./authored-yaml.ts";
import {
  createAgentMarkdownFormatters,
  type AgentMarkdownFormatters,
  type AgentNativeEmitter,
} from "../domain/agent-native.ts";

export type KasWorkerPolicy = {
  readonly origin: AgentOrigin;
  readonly name: string;
  readonly lines: readonly string[];
  readonly contract: KasPolicyContract;
};
export type SpecializedKasWorkerPolicy = KasWorkerPolicy & { readonly binding: WorkerAdmissionBinding; readonly targetOrigin: AgentOrigin; readonly targetBasis: WorkerPolicyBasis };
export const specializeKasWorkerPolicy = ({ policy, binding, targetPolicy, targetBasis = { kind: "native-source" } }: {
  readonly policy: KasWorkerPolicy;
  readonly binding: WorkerAdmissionBinding;
  readonly targetPolicy?: KasWorkerPolicy;
  readonly targetBasis?: WorkerPolicyBasis;
}): Outcome<SpecializedKasWorkerPolicy> => {
  if (policy.name !== binding.template.name || policy.origin.pin !== binding.template.origin.pin || policy.origin.path !== binding.template.origin.path)
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: binding.target.name, detail: "KAS specialization requires the bound native policy template" })] };
  if (targetPolicy === undefined)
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: binding.target.name, detail: "KAS specialization requires the complete target native policy; command admissions alone do not establish policy equivalence" })] };
  const targetPin = targetBasis.kind === "native-source" ? targetPolicy.origin.pin : targetBasis.pin;
  if (targetPolicy.name !== binding.target.name || targetPin !== binding.target.origin.pin)
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: binding.target.name, detail: "KAS target policy must name the bound target and source pin" })] };
  if (JSON.stringify(policy.contract) !== JSON.stringify(targetPolicy.contract))
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: binding.target.name, detail: "KAS native policies differ; preserve the target permissions or prepare explicit source-backed differences" })] };
  return { status: "ok", value: { ...targetPolicy, origin: policy.origin, binding, targetOrigin: targetPolicy.origin, targetBasis } };
};
const workerLines = z.array(z.string()).min(2);
const workerPolicySchema = z.strictObject({
  tools: z.array(z.enum(["read", "write", "shell"])).min(1),
  includeMcpJson: z.literal(true).optional(),
  permissions: z.strictObject({
    rules: z.array(
      z.strictObject({
        capability: z.enum(["shell", "fs_read", "filesystem", "fs_write"]),
        effect: z.enum(["allow", "ask", "deny"]),
        match: z.array(z.string()).min(1),
        exclude: z.array(z.string()).optional(),
      }),
    ),
  }),
});
export type KasPolicyContract = z.infer<typeof workerPolicySchema>;
export const parseKasWorkerPolicy = ({
  input,
  origin,
  name,
  yaml = createAuthoredYaml(),
}: {
  readonly input: unknown;
  readonly origin: AgentOrigin;
  readonly name: string;
  readonly yaml?: AuthoredYaml;
}): Outcome<KasWorkerPolicy> => {
  const parsed = workerLines.safeParse(input);
  if (!parsed.success)
    return {
      status: "invalid",
      findings: [
        finding({
          code: "invalid-input",
          subject: origin.path,
          detail: "expected native worker policy lines from the selected KAS manifest",
        }),
      ],
    };
  const canonical = canonicalYamlMappingText({ text: parsed.data.join("\n") });
  const decoded = yaml.decode({ text: canonical });
  if (decoded.status === "invalid") return decoded;
  const policy = workerPolicySchema.safeParse(decoded.value);
  if (!policy.success)
    return {
      status: "invalid",
      findings: [
        finding({
          code: "capability-gap",
          subject: name,
          detail:
            "KAS worker policy requires valid leaf tools and complete native permission rules",
        }),
      ],
    };
  return { status: "ok", value: { origin, name, lines: canonical.split("\n"), contract: policy.data } };
};
export const createKasAgentEmitter = ({
  policy,
  inlinePersona = false,
  formatters = createAgentMarkdownFormatters(),
}: {
  readonly policy?: KasWorkerPolicy;
  readonly inlinePersona?: boolean;
  readonly formatters?: AgentMarkdownFormatters;
} = {}): AgentNativeEmitter => ({
  emit: (input) => {
    if (input.binding.harness !== "kiro-ide")
      return {
        status: "invalid",
        findings: [
          finding({
            code: "harness-mismatch",
            subject: input.name,
            detail: "KAS agent emitter requires kiro-ide",
          }),
        ],
      };
    if (policy === undefined)
      return {
        status: "invalid",
        findings: [
          finding({
            code: "capability-gap",
            subject: input.name,
            detail:
              "KAS native worker permissions must be prepared from the selected harness policy",
          }),
        ],
      };
    if (policy.name !== input.name || policy.origin.pin !== input.origin.pin)
      return {
        status: "invalid",
        findings: [
          finding({
            code: "foreign-content",
            subject: input.name,
            detail: "KAS worker permissions belong to another persona or source pin",
          }),
        ],
      };
    const frontmatter = formatters.frontmatter({
      frontmatter: input.frontmatter,
      nativeModel: input.nativeModel,
      effortKey: "effortLevel",
      removeKeys: ["disallowedTools"],
      additions: policy.lines,
    });
    return {
      status: "ok",
      value: [
        ...(inlinePersona ? [{ kind: "file" as const, path: `.kiro/aidlc-common/personas/${input.name}.md`, body: formatters.persona({ input, frontmatter: formatters.frontmatter({ frontmatter: input.frontmatter, nativeModel: input.nativeModel, effortKey: "effortLevel", removeKeys: ["disallowedTools"], additions: [] }) }) }] : []),
        {
          kind: "file",
          path: `.kiro/agents/${input.name}.md`,
          body: formatters.persona({ input, frontmatter }),
        },
      ],
    };
  },
});
