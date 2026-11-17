import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { AuthoredContent, CapturedMethodFiles, CapturedSourceFile,
  FrontmatterParser, MarkdownOutliner } from "../application/ports.ts";
import { agentSlug, type Owner } from "../domain/identities.ts";
import type { HookDeclaration } from "../domain/hooks.ts";
import type { KnowledgeDocument } from "../domain/knowledge.ts";
import { methodSourcePath, type MethodSource, type MethodSourceKind,
  type MethodSourceLocation } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import { ruleLayerFor } from "../domain/method-rule-layer.ts";
import type { RuleLayer } from "../domain/rule.ts";
import { authoredValue, translated } from "./authored-markdown.ts";
import { readAgent } from "./read-agent.ts";
import { readRule } from "./read-rule.ts";
import { readScope } from "./read-scope.ts";
import { readSensor } from "./read-sensor.ts";
import { readStage } from "./read-stage.ts";

type Decoder<Definition> = (source: MethodSourceLocation, text: string) =>
  Result<Definition, readonly MethodRefusal[]>;

type Group<Definition> = { readonly definitions: readonly Definition[];
  readonly files: readonly MethodSource[] };

const sourceText = (content: FileContent): string => content.kind === "text" ? content.text
  : new TextDecoder("utf-8", { fatal: true }).decode(content.bytes);

const capture = <Definition>(request: { readonly file: CapturedSourceFile;
  readonly kind: MethodSourceKind; readonly owner: Owner; readonly decode: Decoder<Definition> }):
  Result<{ readonly definition: Definition; readonly file: MethodSource }, readonly MethodRefusal[]> => {
  const path = authoredValue(methodSourcePath({ kind: request.kind, within: request.file.within }));
  const source: MethodSourceLocation = { owner: request.owner, path };
  const text = translated(source, () => sourceText(request.file.content));
  if (!text.ok) return text;
  const decoded = request.decode(source, text.value);
  return decoded.ok ? accepted({ definition: decoded.value,
    file: { ...source, content: request.file.content } }) : decoded;
};

const decodeGroup = <Definition>(request: { readonly files: readonly CapturedSourceFile[];
  readonly kind: MethodSourceKind; readonly owner: Owner; readonly decode: Decoder<Definition> }):
  Result<Group<Definition>, readonly MethodRefusal[]> => {
  const decoded = request.files.map((file) => capture({ file, kind: request.kind,
    owner: request.owner, decode: request.decode }));
  const issues = decoded.flatMap((admission) => admission.ok ? [] : admission.refusal);
  return issues.length > 0 ? refused(issues) : accepted({
    definitions: decoded.flatMap((admission) => admission.ok ? [admission.value.definition] : []),
    files: decoded.flatMap((admission) => admission.ok ? [admission.value.file] : []),
  });
};

const knowledgeDecoder: Decoder<KnowledgeDocument> = (source) => translated(source, () => {
  const folder = source.path.split("/")[1] ?? "";
  return { source: source.path, owner: source.owner,
    audience: folder === "aidlc-shared" ? { kind: "shared" } : {
      kind: "agent", agent: authoredValue(agentSlug(folder)) },
  };
});

export const decodeAuthoredContent = (request: { readonly files: CapturedMethodFiles;
  readonly outliner: MarkdownOutliner; readonly parser: FrontmatterParser;
  readonly hooks: readonly HookDeclaration[]; readonly owner: Owner;
  readonly ruleLayer: (path: MethodSource["path"]) => RuleLayer | null }):
  Result<AuthoredContent, readonly MethodRefusal[]> => {
  const decode = <Definition>(group: { readonly files: readonly CapturedSourceFile[];
    readonly kind: MethodSourceKind; readonly decode: Decoder<Definition> }) =>
    decodeGroup({ owner: request.owner, ...group });
  const stages = decode({ files: request.files.stages, kind: "stage", decode: (source, raw) =>
    readStage({ source, raw, outliner: request.outliner, parser: request.parser }) });
  const agents = decode({ files: request.files.agents, kind: "agent", decode: (source, raw) =>
    readAgent({ source, raw, outliner: request.outliner, parser: request.parser }) });
  const scopes = decode({ files: request.files.scopes, kind: "scope", decode: (source, raw) =>
    readScope({ source, raw, parser: request.parser }) });
  const sensors = decode({ files: request.files.sensors, kind: "sensor", decode: (source, raw) =>
    readSensor({ source, raw, parser: request.parser }) });
  const rules = decode({ files: request.files.rules, kind: "rule", decode: (source, raw) => {
    const layer = request.ruleLayer(source.path);
    return layer ? readRule({ source, raw, layer, parser: request.parser }) : accepted(null);
  } });
  const knowledge = decode({ files: request.files.knowledge, kind: "knowledge", decode: knowledgeDecoder });
  const groups = [stages, agents, scopes, sensors, rules, knowledge];
  const issues = groups.flatMap((admission) => admission.ok ? [] : admission.refusal);
  if (!stages.ok || !agents.ok || !scopes.ok || !sensors.ok || !rules.ok || !knowledge.ok) {
    return refused(issues);
  }
  return accepted({ core: {
    stages: stages.value.definitions.map((reading) => reading.stage),
    agents: agents.value.definitions, scopes: scopes.value.definitions.map((reading) => reading.scope),
    sensors: sensors.value.definitions, rules: rules.value.definitions.filter((rule) => rule !== null),
    knowledge: knowledge.value.definitions, hooks: request.hooks,
    memberships: [...stages.value.definitions.flatMap((reading) => reading.memberships),
      ...scopes.value.definitions.flatMap((reading) => reading.memberships)],
    freeformDefaults: scopes.value.definitions.flatMap((reading) => reading.freeformDefaults),
  }, files: groups.flatMap((admission) => admission.ok ? admission.value.files : []) });
};

export const decodeAuthoredCore = (request: { readonly files: CapturedMethodFiles;
  readonly outliner: MarkdownOutliner; readonly parser: FrontmatterParser;
  readonly hooks: readonly HookDeclaration[] }): Result<AuthoredContent, readonly MethodRefusal[]> =>
  decodeAuthoredContent({ ...request, owner: { kind: "core" },
    ruleLayer: (path) => ruleLayerFor({ path, policy: { kind: "core" } }) });
