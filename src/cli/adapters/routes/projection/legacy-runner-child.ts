import { z } from "zod";
import { readEveryEntry, type TreeFile, type FileSystem } from "../../../../kernel/file-system-port.ts";
import type { Result } from "../../../../kernel/result.ts";
import { ENTRY_SHORTCUTS, type CommandSubject, type EntryShortcut } from "../../../../projection/domain/native-command.ts";

const childSchema = z.object({ module: z.url({ protocol: /^file$/ }), output: z.url({ protocol: /^file$/ }),
  stages: z.array(z.string()), scopes: z.array(z.string()) });
const frozenStageSchema = z.looseObject({ slug: z.string() });
const frozenScopesSchema = z.record(z.string(), z.looseObject({ description: z.string() }));
const generatorSchema = z.object({
  runnableStages: z.function({ input: [], output: z.array(frozenStageSchema) }),
  discoverScopes: z.function({ input: [], output: frozenScopesSchema }),
  defaultScopeBatch: z.function({ input: [frozenScopesSchema], output: z.array(z.string()) }),
  renderStageRunner: z.function({ input: [frozenStageSchema], output: z.string() }),
  renderRunner: z.function({ input: [z.string(), z.string()], output: z.string() }),
  renderInitRunner: z.function({ input: [], output: z.string() }),
  renderComposeRunner: z.function({ input: [], output: z.string() }),
  regenerateRunnerSurfaces: z.function({ input: [], output: z.void() }),
});

type ChildSubject = { readonly concept: CommandSubject["concept"]; readonly name: string };
type ChildPlan = {
  readonly selectedScopeDescription: (request: {
    readonly name: string;
    readonly selected: readonly string[];
    readonly scopes: Readonly<Record<string, { readonly description: string }>>;
  }) => Result<string | null, string>;
  readonly duplicateNativeCommand: (commands: readonly {
    readonly subject: ChildSubject;
    readonly nativeName: string | null;
  }[]) => { readonly subject: ChildSubject; readonly files: null; readonly reason: string } | null;
  readonly selectLegacyDocuments: (request: {
    readonly nativeName: string;
    readonly paths: readonly string[];
  }) => Result<{
    readonly skill: string;
    readonly companions: readonly { readonly path: string; readonly within: string }[];
  }, string>;
};
type ChildCommand = { readonly subject: ChildSubject; readonly markdown: string | null;
  readonly nativeName: string | null; readonly reason: string | null };
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
const renderedCommand = (subject: ChildSubject, render: () => string | null): ChildCommand => {
  try {
    const markdown = render();
    const nativeName = markdown === null ? null : /^name: +([^\r\n]+)$/m.exec(markdown)?.[1];
    return markdown === null || nativeName ? { subject, markdown, nativeName: nativeName ?? null, reason: null }
      : { subject, markdown: null, nativeName: null, reason: "The frozen command has no native name." };
  } catch (error) {
    return { subject, markdown: null, nativeName: null, reason: message(error) };
  }
};

const renderFrozenCommands = ({ generator, input, plan }: {
  readonly generator: z.infer<typeof generatorSchema>;
  readonly input: z.infer<typeof childSchema>;
  readonly plan: ChildPlan;
}) => {
  const runnable = generator.runnableStages();
  const discovered = generator.discoverScopes();
  const selected = generator.defaultScopeBatch(discovered);
  const shortcuts: Record<EntryShortcut, () => string> = {
    "aidlc-init": () => generator.renderInitRunner(), "aidlc-compose": () => generator.renderComposeRunner(),
  };
  return [
    ...input.stages.map((name) => renderedCommand({ concept: "stage-command", name }, () => {
      const node = runnable.find((stage) => stage.slug === name);
      return node ? generator.renderStageRunner(node) : null;
    })),
    ...input.scopes.map((name): ChildCommand => {
      const subject: ChildSubject = { concept: "scope-command", name };
      const selection = plan.selectedScopeDescription({ name, selected, scopes: discovered });
      if (!selection.ok) return { subject, markdown: null, nativeName: null, reason: selection.refusal };
      return renderedCommand(subject, () => selection.value === null ? null
        : generator.renderRunner(name, selection.value));
    }),
    ...ENTRY_SHORTCUTS.map((name) => renderedCommand({ concept: "orchestrator-skill", name }, shortcuts[name])),
  ];
};

const commandDocuments = ({ command, files, plan }: {
  readonly command: ChildCommand; readonly files: readonly TreeFile[]; readonly plan: ChildPlan;
}) => {
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
      return [{ nativeName, within, content: { kind: "bytes", bytes: Array.from(bytes) }, mode: "regular" }];
    }),
  ] };
};

export const runChildWithCapability = async (request: {
  readonly input: z.infer<typeof childSchema>;
  readonly capability: unknown;
  readonly output: Pick<FileSystem, "readTree">;
  readonly plan: ChildPlan;
}) => {
  const admitted = generatorSchema.safeParse(request.capability);
  if (!admitted.success) return { entries: [], failure: "The frozen runner capability API is invalid." };
  const generator = admitted.data;
  const commands = renderFrozenCommands({ generator, input: request.input, plan: request.plan });
  const collision = request.plan.duplicateNativeCommand(commands);
  if (collision) return { failure: null, entries: [collision] };
  const broken = commands.find((command) => command.reason !== null);
  if (broken) return { failure: null, entries: [{ subject: broken.subject, files: null, reason: broken.reason }] };
  generator.regenerateRunnerSurfaces();
  const output = await request.output.readTree({ folder: new URL(request.input.output), select: readEveryEntry });
  if (!output.ok) return { entries: [], failure: `The frozen runner output could not be read: ${output.refusal.code}` };
  if (output.value.unreadable.length > 0) return { entries: [], failure: output.value.unreadable
    .map((file) => `The frozen runner output could not be read: ${file.within}: ${file.code}`).join("\n") };
  return { failure: null, entries: commands.map((command) => commandDocuments({ command, files: output.value.files, plan: request.plan })) };
};

export const runChild = async (request: {
  readonly raw: unknown;
  readonly output: Pick<FileSystem, "readTree">;
  readonly plan: ChildPlan;
  readonly load: (module: URL) => Promise<unknown>;
}) => {
  const decoded = childSchema.safeParse(request.raw);
  if (!decoded.success) return { entries: [], failure: "The frozen runner request is invalid." };
  try {
    return await runChildWithCapability({ input: decoded.data, output: request.output, plan: request.plan,
      capability: await request.load(new URL(decoded.data.module)) });
  } catch (error) {
    return { entries: [], failure: message(error) };
  }
};

