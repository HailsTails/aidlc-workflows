import type { AgentRenderingInputs } from "../../../projection/application/ports/agents.ts";
import { z } from "zod";
import { accepted, refused, type Result } from "../../../kernel/result.ts";
import type { CopyChannelAllows } from "../../../projection/application/ports/copy-channel.ts";
import type { AuthoredHostFile } from "../../../projection/domain/host-surface.ts";
import type { ProjectionRefusal } from "../../../projection/domain/projection.ts";
import type { DistributionChannel } from "../../../projection/domain/projected-file.ts";
import type { ProjectPath, SourcePath } from "../../../kernel/values.ts";

const fieldsSchema = z.array(z.object({ name: z.string(), content: z.unknown() }));
const objectSchema = z.preprocess((document: unknown) => {
  if (document === null || typeof document !== "object" || Array.isArray(document)) return undefined;
  return Object.entries(document).map(([name, content]) => ({ name, content }));
}, fieldsSchema).transform((fields) => Object.fromEntries(fields.map((field) => [field.name, field.content])));

const allowSchema = z.array(z.unknown());
const toolPattern = /^bun \(run \)\?\["']\?(\S+)\/tools\/\[A-Za-z0-9\._-\]\+\\\.ts\["']\?\( \.\*\)\?$/;
const escaped = (command: string): string => command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bunPattern = (path: string): string => `bun (run )?(${path}|"${path}"|'${path}')`;

type AllowDocument = {
  readonly fields: Record<string, unknown>;
  readonly settings: Record<string, unknown>;
  readonly bash: Record<string, unknown>;
  readonly entries: readonly unknown[];
};

const decode = (file: AuthoredHostFile): Result<AllowDocument | null, ProjectionRefusal> => {
  const text = file.content.kind === "text" ? file.content.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.content.bytes);
  try {
    const fields = objectSchema.safeParse(JSON.parse(text));
    if (!fields.success) return accepted(null);
    const settings = objectSchema.safeParse(fields.data["toolsSettings"]);
    if (!settings.success) return accepted(null);
    const bash = objectSchema.safeParse(settings.data["execute_bash"]);
    if (!bash.success) return accepted(null);
    const entries = allowSchema.safeParse(bash.data["allowedCommands"]);
    return entries.success ? accepted({
      fields: fields.data, settings: settings.data, bash: bash.data, entries: entries.data,
    }) : accepted(null);
  } catch {
    return refused({ kind: "render-failed", concept: "agent", name: file.source,
      reason: "The captured Kiro agent is not valid JSON." });
  }
};

const expand = (entry: unknown, allows: CopyChannelAllows): readonly unknown[] => {
  const match = typeof entry === "string" ? toolPattern.exec(entry) : null;
  if (!match) return [entry];
  const tools = `${match[1]  }/tools`;
  const dispatcher = bunPattern(`${tools  }/aidlc\\.ts`);
  return [
    `${dispatcher  } engine( .*)?`,
    ...allows.dispatcherCommands.map((command) => `${dispatcher  } ${  escaped(command)}`),
    ...allows.toolScripts.map((script) => `${bunPattern(`${tools  }/${  escaped(script.slice(0, -3))  }\\.ts`)  }( .*)?`),
  ];
};

const nativeEntries = (request: {
  readonly entries: readonly unknown[];
  readonly commands: readonly string[];
  readonly directory: ProjectPath;
  readonly namespace: string | null | undefined;
  readonly source: SourcePath;
}): Result<readonly unknown[], ProjectionRefusal> => {
  if (!request.namespace) return refused({ kind: "render-failed", concept: "agent", name: request.source,
    reason: "The native agent permissions require a trusted route namespace." });
  const trusted = `aidlc ${request.namespace} .*`;
  const rewritten = request.entries.map((command) => typeof command === "string" && command.startsWith("bun ")
    && command.includes(`${request.directory.replace(".", "\\.")}/tools/`) ? trusted : command);
  return accepted([...new Set(rewritten)].flatMap((command) => command === trusted
    ? [command, ...request.commands.map((command) => escaped(`aidlc ${command}`))] : [command]));
};
export const expandKiroAgentAllows = ({ file, allows, channel, directory, namespace }: {
  readonly file: AuthoredHostFile;
  readonly allows: CopyChannelAllows;
  readonly channel: DistributionChannel;
  readonly directory: ProjectPath;
  readonly namespace: string | null | undefined;
}): Result<{ readonly file: AuthoredHostFile; readonly expansion: "expanded" | "unchanged" }, ProjectionRefusal> => {
  const decoded = decode(file);
  if (!decoded.ok) return decoded;
  if (!decoded.value) return accepted({ file, expansion: "unchanged" });
  const { fields, settings, bash, entries } = decoded.value;
  const matched = entries.some((entry) => typeof entry === "string" && toolPattern.test(entry));
  const expanded = entries.flatMap((entry) => expand(entry, allows));
  const projected = channel === "native" ? nativeEntries({ entries: expanded, commands: allows.dispatcherCommands,
    directory, namespace, source: file.source }) : accepted(expanded);
  if (!projected.ok) return projected;
  const document = { ...fields, toolsSettings: { ...settings, ["execute_bash"]: {
    ...bash, allowedCommands: projected.value,
  } } };
  return accepted({ expansion: matched ? "expanded" : "unchanged", file: { ...file, content: {
    kind: "text", text: `${JSON.stringify(document, null, 2)  }\n`,
  } } });
};

export const prepareKiroAgentBatch = (inputs: AgentRenderingInputs)
: Result<readonly AuthoredHostFile[], ProjectionRefusal> => {
  const files = inputs.files.filter((file) => file.source.startsWith("agents/") && file.source.endsWith(".json"));
  const prepared = files.map((file) => {
    const reading = inputs.prepare(file);
    if (!reading.ok) return reading;
    const decoded = decode(reading.value);
    if (!decoded.ok) return decoded;
    return accepted({ file: reading.value,
      pattern: decoded.value?.entries.some((entry) => typeof entry === "string" && toolPattern.test(entry))
        ? "present" : "absent" });
  });
  const failed = prepared.find((reading) => !reading.ok);
  if (failed && !failed.ok) return failed;
  if (!prepared.some((reading) => reading.ok && reading.value.pattern === "present")) {
    return refused({ kind: "render-failed", concept: "agent", name: "kiro",
      reason: "[kiro] no agent names the tools-folder pattern to expand" });
  }
  return accepted(prepared.flatMap((reading) => reading.ok ? [reading.value.file] : []));
};
