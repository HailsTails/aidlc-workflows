import { z } from "zod";
import type { AgentOrigin } from "../domain/agent-definition.ts";
import type { WorkerAdmissionBinding, WorkerPolicyBasis } from "../domain/worker-policy.ts";
import { finding, type Finding, type Outcome } from "../domain/model.ts";
import {
  createAgentMarkdownFormatters,
  type AgentMarkdownFormatters,
  type AgentNativeEmitter,
  type AgentEmissionInput,
} from "../domain/agent-native.ts";

export type KiroHook = {
  readonly matcher: string;
  readonly command: string;
  readonly timeoutMs: number;
};
export type KiroAgentProfile = {
  readonly origin: AgentOrigin;
  readonly name: string;
  readonly description: string;
  readonly prompt: string;
  readonly tools: readonly string[];
  readonly allowedTools: readonly string[];
  readonly shellCommands: readonly string[];
  readonly shellDenials: readonly string[] | null;
  readonly writePaths: readonly string[];
  readonly resources: readonly string[];
  readonly hooks: Readonly<Record<string, readonly KiroHook[]>>;
};
export type AuthoredKiroAgentProfile = KiroAgentProfile & { readonly state: "authored" };
export type SpecializedKiroAgentProfile = KiroAgentProfile & {
  readonly state: "specialized";
  readonly binding: WorkerAdmissionBinding;
  readonly targetOrigin: AgentOrigin;
  readonly targetBasis: WorkerPolicyBasis;
};
export type PreparedKiroAgentProfile = KiroAgentProfile & { readonly state: "prepared" };
const profileSchema = z.strictObject({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  description: z.string().min(1),
  prompt: z.string().startsWith("file://"),
  includeMcpJson: z.literal(true),
  tools: z.array(z.string()),
  allowedTools: z.array(z.string()),
  toolsSettings: z.unknown(),
  resources: z.array(z.string()),
  hooks: z.unknown(),
});
const shellTool = "execute_bash";
const writeTool = "fs_write";
const hookTimeout = "timeout_ms";
const nativeHookSchema = z.strictObject({
  matcher: z.string(),
  command: z.string(),
  [hookTimeout]: z.number().positive(),
});
const nativeProfileSchema = profileSchema.extend({
  toolsSettings: z.strictObject({
    [shellTool]: z.strictObject({
      allowedCommands: z.array(z.string()),
      deniedCommands: z.array(z.string()).optional(),
    }),
    [writeTool]: z.strictObject({ allowedPaths: z.array(z.string()) }),
  }),
  hooks: z.record(z.string(), z.array(nativeHookSchema)),
});
const nativeSelectorRole = ({ selector }: { readonly selector: string }): "delegation" | "other" => {
  const selected = selector.trim();
  const native = selected.startsWith("@builtin/") ? selected.slice("@builtin/".length) : selected;
  return selected === "@builtin" || ["use_subagent", "subagent", "invoke_sub_agent", "agent", "*"].includes(native) || ["subagent/", "use_subagent/", "invoke_sub_agent/"].some((prefix) => native.startsWith(prefix)) ? "delegation" : "other";
};
const leafToolFindings = ({ name, tools }: { readonly name: string; readonly tools: readonly string[] }): readonly Finding[] =>
  tools.filter((selector) => nativeSelectorRole({ selector }) === "delegation").map((selector) => finding({ code: "capability-gap", subject: name, detail: `delegated Kiro profiles must omit native delegation selector ${JSON.stringify(selector)}` }));
const translatedHooks = ({
  hooks,
}: {
  readonly hooks: z.infer<typeof nativeProfileSchema>["hooks"];
}): KiroAgentProfile["hooks"] =>
  Object.fromEntries(
    Object.entries(hooks).map(([event, entries]) => [
      event,
      entries.map((hook) => ({
        matcher: hook.matcher,
        command: hook.command,
        timeoutMs: hook[hookTimeout],
      })),
    ]),
  );
export const parseKiroAgentProfile = ({
  text,
  origin,
}: {
  readonly text: string;
  readonly origin: AgentOrigin;
}): Outcome<AuthoredKiroAgentProfile> => {
  try {
    const decoded: unknown = JSON.parse(text);
    const parsed = nativeProfileSchema.safeParse(decoded);
    if (!parsed.success)
      return {
        status: "invalid",
        findings: [
          finding({ code: "invalid-input", subject: origin.path, detail: parsed.error.message }),
        ],
      };
    const profile = parsed.data;
    const leafFindings = leafToolFindings(profile);
    if (leafFindings.length > 0) return { status: "invalid", findings: leafFindings };
    return {
      status: "ok",
      value: {
        state: "authored",
        origin,
        name: profile.name,
        description: profile.description,
        prompt: profile.prompt,
        tools: profile.tools,
        allowedTools: profile.allowedTools,
        shellCommands: profile.toolsSettings[shellTool].allowedCommands,
        shellDenials: profile.toolsSettings[shellTool].deniedCommands ?? null,
        writePaths: profile.toolsSettings[writeTool].allowedPaths,
        resources: profile.resources,
        hooks: translatedHooks({ hooks: profile.hooks }),
      },
    };
  } catch {
    return {
      status: "invalid",
      findings: [
        finding({
          code: "invalid-json",
          subject: origin.path,
          detail: "expected authored Kiro agent JSON",
        }),
      ],
    };
  }
};
export type KiroProfilePreparation = {
  readonly profile: AuthoredKiroAgentProfile | SpecializedKiroAgentProfile;
  readonly shellCommands: readonly string[];
  readonly sharedResources: readonly string[] | null;
  readonly invocation: string;
  readonly hookSuffix: string;
};
const projectedWorkerIdentity = ({ profile, binding }: {
  readonly profile: AuthoredKiroAgentProfile;
  readonly binding: WorkerAdmissionBinding;
}): Outcome<KiroAgentProfile> => {
  const guard = `{{INVOKE}} engine adapter kiro state-transition-guard ${profile.name}`;
  const resources = profile.resources.map((resource) => resource === `file://.kiro/agents/${profile.name}.md` ? `file://.kiro/agents/${binding.target.name}.md` : resource === `file://.kiro/knowledge/${profile.name}/*.md` ? `file://.kiro/knowledge/${binding.target.name}/*.md` : resource);
  const hooks = Object.fromEntries(Object.entries(profile.hooks).map(([event, entries]) => [event, entries.map((hook) => ({ ...hook, command: hook.command === guard ? `{{INVOKE}} engine adapter kiro state-transition-guard ${binding.target.name}` : hook.command }))]));
  if (resources.some((resource) => resource.includes(profile.name)) || Object.values(hooks).flat().some((hook) => hook.command.includes(profile.name)))
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: binding.target.name, detail: "Kiro template contains role-specific resource or hook bindings that require explicit preparation" })] };
  return { status: "ok", value: { ...profile, name: binding.target.name, prompt: `file://${binding.target.name}.md`, resources, hooks } };
};
const nativeWorkerBehavior = ({ profile }: { readonly profile: KiroAgentProfile }): Readonly<Record<string, unknown>> => ({
  prompt: profile.prompt, tools: profile.tools, allowedTools: profile.allowedTools,
  shellCommands: profile.shellCommands, shellDenials: profile.shellDenials, writePaths: profile.writePaths, resources: profile.resources,
  hooks: Object.entries(profile.hooks).sort(([left], [right]) => left.localeCompare(right)).map(([event, hooks]) => [event, hooks.map((hook) => ({ matcher: hook.matcher, command: hook.command, timeoutMs: hook.timeoutMs }))]),
});
export const specializeKiroWorkerProfile = ({ profile, binding, targetProfile, targetBasis = { kind: "native-source" } }: {
  readonly profile: AuthoredKiroAgentProfile;
  readonly binding: WorkerAdmissionBinding;
  readonly targetProfile?: AuthoredKiroAgentProfile;
  readonly targetBasis?: WorkerPolicyBasis;
}): Outcome<SpecializedKiroAgentProfile> => {
  if (profile.name !== binding.template.name || profile.origin.pin !== binding.template.origin.pin || profile.origin.path !== binding.template.origin.path || profile.prompt !== `file://${profile.name}.md`)
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: binding.target.name, detail: "Kiro specialization requires the bound authored policy template" })] };
  if (targetProfile === undefined)
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: binding.target.name, detail: "Kiro specialization requires the complete target native policy; command admissions alone do not establish policy equivalence" })] };
  const targetPin = targetBasis.kind === "native-source" ? targetProfile.origin.pin : targetBasis.pin;
  if (targetProfile.name !== binding.target.name || targetPin !== binding.target.origin.pin)
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: binding.target.name, detail: "Kiro target policy must name the bound target and source pin" })] };
  const projected = projectedWorkerIdentity({ profile, binding });
  if (projected.status === "invalid") return projected;
  const projectedBehavior = nativeWorkerBehavior({ profile: projected.value });
  const targetBehavior = nativeWorkerBehavior({ profile: targetProfile });
  const differences = Object.keys(projectedBehavior).filter((field) => JSON.stringify(projectedBehavior[field]) !== JSON.stringify(targetBehavior[field]));
  if (differences.length > 0)
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: binding.target.name, detail: `Kiro native policies differ in ${differences.join(", ")}; preserve the target policy or prepare explicit source-backed differences` })] };
  return { status: "ok", value: { ...targetProfile, state: "specialized", binding, origin: profile.origin, targetOrigin: targetProfile.origin, targetBasis } };
};
const escapeKiroPattern = ({ text }: { readonly text: string }): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export type KiroCommandPatternDialect = "paired-quotes" | "optional-quotes";
export const kiroCopyCommandPatterns = ({
  dispatcherCommands,
  toolScripts,
  dialect,
}: {
  readonly dispatcherCommands: readonly string[];
  readonly toolScripts: readonly string[];
  readonly dialect: KiroCommandPatternDialect;
}): readonly string[] => {
  if (dialect === "optional-quotes") {
    const prefix = "bun (run )?[\"']?\\.kiro/tools/";
    const dispatcher = `${prefix}aidlc\\.ts["']?`;
    const scripts = toolScripts.map((script) => escapeKiroPattern({ text: script.slice(0, -3) }));
    return [
      `${dispatcher} engine( .*)?`,
      ...dispatcherCommands.map(
        (command) => `${dispatcher} ${escapeKiroPattern({ text: command })}`,
      ),
      ...(scripts.length === 0 ? [] : [`${prefix}(${scripts.join("|")})\\.ts["']?( .*)?`]),
    ];
  }
  const launcher =
    "bun (run )?(\\.kiro/tools/aidlc\\.ts|\"\\.kiro/tools/aidlc\\.ts\"|'\\.kiro/tools/aidlc\\.ts')";
  return [
    `${launcher} engine( .*)?`,
    ...dispatcherCommands.map((command) => `${launcher} ${escapeKiroPattern({ text: command })}`),
    ...toolScripts.map((script) => {
      const path = `\\.kiro/tools/${escapeKiroPattern({ text: script })}`;
      return `bun (run )?(${path}|"${path}"|'${path}')( .*)?`;
    }),
  ];
};
export const prepareKiroAgentProfile = (
  input: KiroProfilePreparation,
): Outcome<PreparedKiroAgentProfile> => {
  if (input.shellCommands.length === 0)
    return {
      status: "invalid",
      findings: [
        finding({
          code: "capability-gap",
          subject: input.profile.name,
          detail: "Kiro shell grants require resolved dispatcher/tool allowances",
        }),
      ],
    };
  if (
    input.profile.shellCommands.length !== 1 ||
    input.profile.shellCommands[0] !==
      "bun (run )?[\"']?\\.kiro/tools/[A-Za-z0-9._-]+\\.ts[\"']?( .*)?"
  )
    return {
      status: "invalid",
      findings: [
        finding({
          code: "capability-gap",
          subject: input.profile.name,
          detail:
            "Kiro grant preparation requires the authored tool-script pattern; custom allowances need their own policy preparation",
        }),
      ],
    };
  const hooks = Object.fromEntries(
    Object.entries(input.profile.hooks).map(([event, entries]) => [
      event,
      entries.map((hook) => ({
        ...hook,
        command: hook.command.replaceAll("{{INVOKE}}", () => input.invocation) + input.hookSuffix,
      })),
    ]),
  );
  const resources = input.profile.resources.flatMap((resource) =>
    resource === "file://.kiro/knowledge/aidlc-shared/*.md" && input.sharedResources !== null
      ? input.sharedResources
      : [resource],
  );
  return {
    status: "ok",
    value: {
      ...input.profile,
      state: "prepared",
      shellCommands: [...input.shellCommands],
      resources,
      hooks,
    },
  };
};
const nativeKiroProfile = ({
  profile,
  model,
}: {
  readonly profile: KiroAgentProfile;
  readonly model: string | null;
}): string => {
  const toolsSettings = Object.fromEntries([
    [
      "execute_bash",
      {
        allowedCommands: profile.shellCommands,
        ...(profile.shellDenials === null ? {} : { deniedCommands: profile.shellDenials }),
      },
    ],
    ["fs_write", { allowedPaths: profile.writePaths }],
  ]);
  const hooks = Object.fromEntries(
    Object.entries(profile.hooks).map(([event, entries]) => [
      event,
      entries.map((hook) =>
        Object.fromEntries([
          ["matcher", hook.matcher],
          ["command", hook.command],
          ["timeout_ms", hook.timeoutMs],
        ]),
      ),
    ]),
  );
  const serialized = JSON.stringify(
    {
      name: profile.name,
      description: profile.description,
      prompt: profile.prompt,
      includeMcpJson: true,
      tools: profile.tools,
      allowedTools: profile.allowedTools,
      toolsSettings,
      resources: profile.resources,
      hooks,
      ...(model === null ? {} : { model }),
    },
    null,
    2,
  );
  return `${serialized}\n`;
};
export type KiroEmissionPrerequisites = {
  readonly profile: PreparedKiroAgentProfile;
  readonly promptAdditions: readonly string[];
};
const kiroEmissionPrerequisites = ({
  input,
  profile,
  promptAdditions,
}: {
  readonly input: AgentEmissionInput;
  readonly profile: PreparedKiroAgentProfile | undefined;
  readonly promptAdditions: readonly string[] | undefined;
}): Outcome<KiroEmissionPrerequisites> => {
  if (input.binding.harness !== "kiro")
    return {
      status: "invalid",
      findings: [
        finding({
          code: "harness-mismatch",
          subject: input.name,
          detail: "Kiro JSON emitter requires kiro",
        }),
      ],
    };
  if (profile === undefined)
    return {
      status: "invalid",
      findings: [
        finding({
          code: "capability-gap",
          subject: input.name,
          detail: "Kiro agent-v1/v2 requires an authored native JSON profile and prepared grants",
        }),
      ],
    };
  const leafFindings = leafToolFindings(profile);
  if (leafFindings.length > 0) return { status: "invalid", findings: leafFindings };
  if (
    promptAdditions === undefined ||
    (promptAdditions.length > 0 && promptAdditions[0] !== 'tools: ["read", "write", "shell"]')
  )
    return {
      status: "invalid",
      findings: [
        finding({
          code: "capability-gap",
          subject: input.name,
          detail: "Kiro prompt metadata must be supplied by the selected harness manifest",
        }),
      ],
    };
  return { status: "ok", value: { profile, promptAdditions } };
};
const compatibleKiroProfile = ({
  input,
  prerequisites,
}: {
  readonly input: AgentEmissionInput;
  readonly prerequisites: KiroEmissionPrerequisites;
}): Outcome<KiroEmissionPrerequisites> => {
  const { profile } = prerequisites;
  if (
    profile.name !== input.name ||
    profile.prompt !== `file://${input.name}.md` ||
    profile.origin.pin !== input.origin.pin
  )
    return {
      status: "invalid",
      findings: [
        finding({
          code: "foreign-content",
          subject: input.name,
          detail: "Kiro native profile must reference this persona and source pin",
        }),
      ],
    };
  if (input.nativeModel.effort !== null)
    return {
      status: "invalid",
      findings: [
        finding({
          code: "capability-gap",
          subject: input.name,
          detail: "Kiro agent JSON has no native per-agent effort field",
        }),
      ],
    };
  return { status: "ok", value: prerequisites };
};
export const createKiroAgentEmitter = ({
  profile,
  promptAdditions,
  modelOverride,
  formatters = createAgentMarkdownFormatters(),
}: {
  readonly profile?: PreparedKiroAgentProfile;
  readonly promptAdditions?: readonly string[];
  readonly modelOverride?: string | null;
  readonly formatters?: AgentMarkdownFormatters;
} = {}): AgentNativeEmitter => ({
  emit: (input) => {
    const prerequisites = kiroEmissionPrerequisites({ input, profile, promptAdditions });
    if (prerequisites.status === "invalid") return prerequisites;
    const compatible = compatibleKiroProfile({ input, prerequisites: prerequisites.value });
    if (compatible.status === "invalid") return compatible;
    const frontmatter = formatters.frontmatter({
      frontmatter: input.frontmatter,
      nativeModel: input.nativeModel,
      effortKey: "effort",
      removeKeys: ["disallowedTools"],
      additions: compatible.value.promptAdditions,
    });
    return {
      status: "ok",
      value: [
        {
          kind: "file",
          path: `.kiro/agents/${input.name}.md`,
          body: formatters.persona({ input, frontmatter }),
        },
        {
          kind: "file",
          path: `.kiro/agents/${input.name}.json`,
          body: nativeKiroProfile({
            profile: compatible.value.profile,
            model: modelOverride === undefined ? input.nativeModel.model : modelOverride,
          }),
        },
      ],
    };
  },
});
