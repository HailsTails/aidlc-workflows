import { readEveryEntry, type TreeFile } from "../../kernel/file-system-port.ts";
import { ENTRY_SHORTCUTS, type EntryShortcut } from "../domain/native-command.ts";
import type { FrozenCommandEntry, FrozenCommandSet, FrozenCommandSubject } from "../domain/frozen-command.ts";
import type { FrozenCommandPlan, FrozenCommandRequest } from "./ports/frozen-command.ts";

type RenderedCommand = { readonly subject: FrozenCommandSubject; readonly markdown: string | null;
  readonly nativeName: string | null; readonly reason: string | null };

const renderedCommand = (subject: FrozenCommandSubject, render: () => string | null): RenderedCommand => {
  try {
    const markdown = render();
    const nativeName = markdown === null ? null : /^name: +([^\r\n]+)$/m.exec(markdown)?.[1];
    return markdown === null || nativeName ? { subject, markdown, nativeName: nativeName ?? null, reason: null }
      : { subject, markdown: null, nativeName: null, reason: "The frozen command has no native name." };
  } catch (error) {
    return { subject, markdown: null, nativeName: null,
      reason: error instanceof Error ? error.message : String(error) };
  }
};

const renderCommands = ({ generator, stages, scopes, plan }: FrozenCommandRequest) => {
  const discovered = generator.discover();
  const shortcuts: Record<EntryShortcut, () => string> = {
    "aidlc-init": () => generator.renderInit(), "aidlc-compose": () => generator.renderCompose(),
  };
  return [
    ...stages.map((name) => renderedCommand({ concept: "stage-command", name }, () => {
      const node = discovered.stages.find((stage) => stage.slug === name);
      return node ? node.render() : null;
    })),
    ...scopes.map((name): RenderedCommand => {
      const subject: FrozenCommandSubject = { concept: "scope-command", name };
      const selection = plan.selectedScopeDescription({ name, selected: discovered.selected, scopes: discovered.scopes });
      if (!selection.ok) return { subject, markdown: null, nativeName: null, reason: selection.refusal };
      return renderedCommand(subject, () => selection.value === null ? null
        : generator.renderScope(name, selection.value));
    }),
    ...ENTRY_SHORTCUTS.map((name) => renderedCommand({ concept: "orchestrator-skill", name }, shortcuts[name])),
  ];
};

const commandDocuments = ({ command, files, plan }: {
  readonly command: RenderedCommand; readonly files: readonly TreeFile[]; readonly plan: FrozenCommandPlan;
}): FrozenCommandEntry => {
  const nativeName = command.nativeName;
  if (command.markdown === null || nativeName === null) {
    return { subject: command.subject, files: null, reason: command.reason };
  }
  const selected = plan.selectLegacyDocuments({ nativeName, paths: files.map((file) => file.path) });
  if (!selected.ok) return { subject: command.subject, files: null, reason: selected.refusal };
  const companions = new Map(selected.value.companions.map((file) => [file.path, file.within]));
  return { subject: command.subject, reason: null, files: [
    { nativeName, within: "SKILL.md", content: { kind: "text", text: command.markdown }, mode: "regular" },
    ...files.flatMap((file) => {
      const within = companions.get(file.path);
      if (within === undefined) return [];
      const bytes = file.content.kind === "bytes" ? file.content.bytes : new TextEncoder().encode(file.content.text);
      return [{ nativeName, within, content: { kind: "bytes" as const, bytes }, mode: "regular" as const }];
    }),
  ] };
};

export const renderFrozenCommandSet = async (request: FrozenCommandRequest): Promise<FrozenCommandSet> => {
  const commands = renderCommands(request);
  const collision = request.plan.duplicateNativeCommand(commands);
  if (collision) return { failure: null, entries: [collision] };
  const broken = commands.find((command) => command.reason !== null);
  if (broken) return { failure: null, entries: [{ subject: broken.subject, files: null, reason: broken.reason }] };
  request.generator.regenerate();
  const output = await request.output.readTree({ folder: request.folder, select: readEveryEntry });
  if (!output.ok) return { entries: [], failure: `The frozen runner output could not be read: ${output.refusal.code}` };
  if (output.value.unreadable.length > 0) return { entries: [], failure: output.value.unreadable
    .map((file) => `The frozen runner output could not be read: ${file.within}: ${file.code}`).join("\n") };
  return { failure: null, entries: commands.map((command) => commandDocuments({ command, files: output.value.files,
    plan: request.plan })) };
};
