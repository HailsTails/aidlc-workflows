import type { FileContent } from "../../../kernel/file-content.ts";
import type { DistributionChannel } from "../../../projection/domain/projected-file.ts";

export const kiroIdeNativePermissionText = ({ text, namespace }: {
  readonly text: string;
  readonly namespace: string;
}): string => text.replace(
  / {4}- capability: shell\n {6}effect: (?:allow|ask)\n[\s\S]*?(?=\n {4}- capability:|\n---|\n\S|$)/g,
  (block: string) => {
    const trusted = `- "aidlc ${namespace} *"`;
    return block
      .replaceAll('- "bun .kiro/tools/aidlc-*"', trusted)
      .replaceAll('- "bun .kiro/tools/aidlc*', '- "aidlc*')
      .replaceAll('- "bun .kiro/tools/aidlc.ts ', '- "aidlc ')
      .replaceAll(`- "aidlc ${namespace} engine `, `- "aidlc ${namespace} `)
      .replaceAll(`${trusted}\n        ${trusted}`, trusted);
  },
);

export const kiroIdeAgentPermissionContent = ({ content, channel, namespace }: {
  readonly content: FileContent;
  readonly channel: DistributionChannel;
  readonly namespace: string;
}): FileContent => {
  if (channel === "copy") return content;
  const text = content.kind === "text" ? content.text
    : new TextDecoder("utf-8", { ignoreBOM: true }).decode(content.bytes);
  return { kind: "text", text: kiroIdeNativePermissionText({ text, namespace }) };
};
