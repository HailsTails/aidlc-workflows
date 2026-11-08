import type { FileContent } from "../../kernel/file-content.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { sourcePath } from "../../kernel/values.ts";
import type { MarkdownOutliner } from "../application/ports.ts";
import type { CapturedSourceFile, SourceFiles } from "../application/source-files.ts";
import { agentSlug } from "../domain/identities.ts";
import type { HookDeclaration } from "../domain/hooks.ts";
import type { KnowledgeDocument } from "../domain/knowledge.ts";
import type { CoreContent } from "../domain/method.ts";
import { methodSourcePath, type MethodSource, type MethodSourceKind,
  type MethodSourceLocation } from "../domain/method-source.ts";
import type { MethodRefusal } from "../domain/refusals.ts";
import type { Rule, RuleLayer } from "../domain/rule.ts";
import { PHASES } from "../domain/vocabulary.ts";
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
  readonly kind: MethodSourceKind; readonly decode: Decoder<Definition> }):
  Result<{ readonly definition: Definition; readonly file: MethodSource }, readonly MethodRefusal[]> => {
  const path = authoredValue(methodSourcePath({ kind: request.kind, within: request.file.within }));
  const source: MethodSourceLocation = { owner: { kind: "core" }, path };
  const text = translated(source, () => sourceText(request.file.content));
  if (!text.ok) return text;
  const decoded = request.decode(source, text.value);
  return decoded.ok ? accepted({ definition: decoded.value,
    file: { ...source, content: request.file.content } }) : decoded;
};

const readGroup = async <Definition>(request: { readonly sourceFiles: SourceFiles;
  readonly directory: string; readonly kind: MethodSourceKind; readonly decode: Decoder<Definition> }):
  Promise<Result<Group<Definition>, readonly MethodRefusal[]>> => {
  const captured = await request.sourceFiles.read(authoredValue(sourcePath(request.directory)));
  const decoded = captured.map((file) => capture({ file, kind: request.kind, decode: request.decode }));
  const issues = decoded.flatMap((admission) => admission.ok ? [] : admission.refusal);
  return issues.length > 0 ? refused(issues) : accepted({
    definitions: decoded.flatMap((admission) => admission.ok ? [admission.value.definition] : []),
    files: decoded.flatMap((admission) => admission.ok ? [admission.value.file] : []),
  });
};

const ruleLayer = (path: string): RuleLayer | null => {
  const name = path.replace(/^memory\//, "").replace(/\.md$/, "");
  if (name === "org" || name === "team" || name === "project") return { kind: name };
  const phase = PHASES.find((candidate) => name === `phases/${candidate}`);
  return phase ? { kind: "phase", phase } : null;
};

const ruleDecoder: Decoder<Rule | null> = (source, raw) => {
  const layer = ruleLayer(source.path);
  return layer ? readRule({ source, raw, layer }) : accepted(null);
};

const knowledgeDecoder: Decoder<KnowledgeDocument> = (source) => translated(source, () => {
  const folder = source.path.split("/")[1] ?? "";
  return { source: source.path, owner: source.owner,
    audience: folder === "aidlc-shared" ? { kind: "shared" } : {
      kind: "agent", agent: authoredValue(agentSlug(folder)) },
  };
});

export const readAuthoredCore = async (request: { readonly sourceFiles: SourceFiles;
  readonly outliner: MarkdownOutliner; readonly hooks: readonly HookDeclaration[] }):
  Promise<Result<{ readonly core: CoreContent; readonly files: readonly MethodSource[] },
    readonly MethodRefusal[]>> => {
  const read = <Definition>(captureRequest: { readonly directory: string;
    readonly kind: MethodSourceKind; readonly decode: Decoder<Definition> }) =>
    readGroup({ sourceFiles: request.sourceFiles, ...captureRequest });
  const stages = await read({ directory: "aidlc-common/stages", kind: "stage", decode: (source, raw) =>
    readStage({ source, raw, outliner: request.outliner }) });
  const agents = await read({ directory: "agents", kind: "agent", decode: (source, raw) =>
    readAgent({ source, raw, outliner: request.outliner }) });
  const scopes = await read({ directory: "scopes", kind: "scope", decode: readScope });
  const sensors = await read({ directory: "sensors", kind: "sensor", decode: readSensor });
  const rules = await read({ directory: "memory", kind: "rule", decode: ruleDecoder });
  const knowledge = await read({ directory: "knowledge", kind: "knowledge", decode: knowledgeDecoder });
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
