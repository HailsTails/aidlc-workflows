import type { AgentContext, AgentProjection, PreparedAgent } from "./agent-definition.ts";
import {
  createMarkdownAgentEmitter,
  type AgentEmissionInput,
  type AgentNativeEmitter,
} from "./agent-native.ts";
import { renderTokens, residue } from "./projection-content.ts";
import { pathStatus, finding, type Outcome } from "./model.ts";
import type { NativeResource } from "./native-rendering.ts";

export type AgentRenderingRules = {
  readonly text: typeof renderTokens;
  readonly residue: typeof residue;
};
export type AgentRenderer = {
  readonly render: (prepared: PreparedAgent) => Outcome<AgentProjection>;
};
export const createAgentRenderingRules = (): AgentRenderingRules => ({
  text: renderTokens,
  residue,
});
export const delegatedAgentPreflight = ({
  name,
  context,
}: {
  readonly name: string;
  readonly context: AgentContext;
}): string => {
  const shared = `\`${context.directory}/knowledge/aidlc-shared/\``;
  const exclusions =
    " (all but its format references `audit-format.md`, `knowledge-readme-template.md`, `memory-template.md`, `state-template.md` and `worktree-info-schema.md`: a step that needs one names it)";
  const reading =
    context.knowledgeRead === "kiro-chunks"
      ? "Kiro shows only part of a long file: read each one with your file tool in parts of at most 200 lines (offset and limit), from the first line to the last; a read that comes back cut short is not all of it. "
      : "";
  return (
    "<!-- aidlc-delegated-knowledge-preflight -->\n" +
    "**Delegated knowledge preflight (mandatory):** Before substantive work, " +
    "ensure every readable Markdown file under these directories is loaded, in order: " +
    `${shared}${context.sharedKnowledge === "methodology-only" ? exclusions : ""}, ` +
    `\`${context.directory}/knowledge/${name}/\`, ` +
    "`aidlc/spaces/<active-space>/knowledge/aidlc-shared/`, then " +
    `\`aidlc/spaces/<active-space>/knowledge/${name}/\`. ` +
    "A native resource preload satisfies this requirement; otherwise read the files now. " +
    reading +
    "The dispatch brief supplies rules and artifact paths separately."
  );
};
const contentContract = ({ context }: PreparedAgent) => ({
  harness: context.harness,
  harnessDir: context.directory,
  rulesSubdir: context.rulesSubdir,
  invocation: context.invocation,
  memoryRoot: context.memoryReference ?? "aidlc/active-memory",
});
const renderedEmission = ({
  prepared,
  rules,
}: {
  readonly prepared: PreparedAgent;
  readonly rules: AgentRenderingRules;
}): AgentEmissionInput => {
  const contract = contentContract(prepared);
  const text = rules.text({ text: prepared.personaBody, contract });
  const agentBody =
    prepared.context.memoryReference === null
      ? text
      : text.replaceAll(
          "aidlc/spaces/<active-space>/memory/",
          `${prepared.context.memoryReference}/`,
        );
  return {
    origin: prepared.agent.origin,
    binding: prepared.context,
    name: prepared.agent.name,
    frontmatter: rules.text({ text: prepared.agent.frontmatter, contract }),
    description: rules.text({ text: prepared.agent.description, contract }),
    body: agentBody,
    ...(prepared.context.harness === "copilot" ? { authoredBody: rules.text({ text: prepared.agent.body, contract }).replaceAll("aidlc/spaces/<active-space>/memory/", `${prepared.context.memoryReference ?? "aidlc/spaces/<active-space>/memory"}/`) } : {}),
    preflight: delegatedAgentPreflight({ name: prepared.agent.name, context: prepared.context }),
    nativeModel: prepared.nativeModel,
    policy: prepared.agent.policy,
  };
};
const renderedKnowledge = ({
  prepared,
  rules,
}: {
  readonly prepared: PreparedAgent;
  readonly rules: AgentRenderingRules;
}): readonly NativeResource[] =>
  prepared.knowledge.map((entry) => ({
    kind: "file",
    path: `${prepared.context.directory}/knowledge/${prepared.agent.name}/${entry.origin.path.split("/").at(-1)}`,
    body: rules.text({ text: entry.body, contract: contentContract(prepared) }),
  }));
const emissionFindings = ({
  resources,
  rules,
}: {
  readonly resources: readonly NativeResource[];
  readonly rules: AgentRenderingRules;
}) =>
  resources.flatMap((resource) => [
    ...(pathStatus({ path: resource.path }) === "unsafe"
      ? [
          finding({
            code: "invalid-destination",
            subject: resource.path,
            detail: "native agent resources require safe relative paths",
          }),
        ]
      : []),
    ...rules.residue({ text: resource.body, subject: resource.path }),
  ]);
type AgentFootprint = "bundle" | "definition";
const renderAgentFootprint = ({ prepared, rules, emitter, footprint }: { readonly prepared: PreparedAgent; readonly rules: AgentRenderingRules; readonly emitter: AgentNativeEmitter; readonly footprint: AgentFootprint }): Outcome<AgentProjection> => {
  const native = emitter.emit(renderedEmission({ prepared, rules }));
  if (native.status === "invalid") return native;
  const persona = nativePersona({ resources: native.value, subject: prepared.agent.name });
  if (persona.status === "invalid") return persona;
  const knowledge = footprint === "bundle" ? renderedKnowledge({ prepared, rules }) : [];
  const resources = [...native.value, ...knowledge];
  const findings = emissionFindings({ resources, rules });
  return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { origin: prepared.agent.origin, harness: prepared.context.harness, resources, participation: prepared.participation } };
};
const createFootprintRenderer = ({ rules, emitter, footprint }: { readonly rules: AgentRenderingRules; readonly emitter: AgentNativeEmitter; readonly footprint: AgentFootprint }): AgentRenderer => ({ render: (prepared) => renderAgentFootprint({ prepared, rules, emitter, footprint }) });
export const createAgentRenderer = ({ rules = createAgentRenderingRules(), emitter = createMarkdownAgentEmitter() }: { readonly rules?: AgentRenderingRules; readonly emitter?: AgentNativeEmitter } = {}): AgentRenderer => createFootprintRenderer({ rules, emitter, footprint: "bundle" });
export const createAgentDefinitionRenderer = ({ rules = createAgentRenderingRules(), emitter = createMarkdownAgentEmitter() }: { readonly rules?: AgentRenderingRules; readonly emitter?: AgentNativeEmitter } = {}): AgentRenderer => createFootprintRenderer({ rules, emitter, footprint: "definition" });
const nativePersona = ({
  resources,
  subject,
}: {
  readonly resources: readonly NativeResource[];
  readonly subject: string;
}): Outcome<readonly NativeResource[]> => {
  if (!resources.some((resource) => resource.kind === "file"))
    return {
      status: "invalid",
      findings: [
        finding({
          code: "missing-body",
          subject,
          detail: "native agent emitter must produce a persona file",
        }),
      ],
    };
  return { status: "ok", value: resources };
};
