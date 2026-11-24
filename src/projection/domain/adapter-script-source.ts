import type { FileContent } from "../../kernel/file-content.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import type { NativeCommandRoutes } from "./native-command.ts";
import type { DistributionChannel } from "./projected-file.ts";

type AdapterScriptPart = { readonly kind: "literal"; readonly text: string }
  | { readonly kind: "self-invocation"; readonly copy: string };

export type CapturedAdapterScript = {
  readonly host: HostIdentity;
  readonly captured: FileContent;
  readonly parts: readonly AdapterScriptPart[];
};

const escaped = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const captureAdapterScript = (request: {
  readonly host: HostIdentity; readonly source: string; readonly content: FileContent;
}): CapturedAdapterScript => {
  const captured: FileContent = request.content.kind === "text" ? { ...request.content }
    : { kind: "bytes", bytes: new Uint8Array(request.content.bytes) };
  const script = escaped(`${request.host.directory}/${request.source}`);
  const json = String.raw`\bbun\s+\\"\$CLAUDE_PROJECT_DIR/${script}\\"`;
  const plain = String.raw`\bbun\s+(?:"?(?:\$\{?CLAUDE_PROJECT_DIR\}?/)?${script}"?)`;
  const mentions = new RegExp(`${json}|${plain}`, "gi");
  const text = captured.kind === "text" ? captured.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(captured.bytes);
  const parts: AdapterScriptPart[] = [];
  let through = 0;
  for (const mention of text.matchAll(mentions)) {
    parts.push({ kind: "literal", text: text.slice(through, mention.index) },
      { kind: "self-invocation", copy: mention[0] });
    through = mention.index + mention[0].length;
  }
  parts.push({ kind: "literal", text: text.slice(through) });
  return { host: { ...request.host }, captured, parts };
};

export const renderAdapterScript = (request: {
  readonly script: CapturedAdapterScript; readonly channel: DistributionChannel;
  readonly commands: Pick<NativeCommandRoutes, "trusted">;
}): FileContent => request.channel === "copy"
  || !request.script.parts.some(part => part.kind === "self-invocation") ? request.script.captured
  : { kind: "text", text: request.script.parts.map(part => part.kind === "literal" ? part.text
    : request.commands.trusted(`adapter ${request.script.host.distribution}`)).join("") };
