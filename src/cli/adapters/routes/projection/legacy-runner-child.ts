import { z } from "zod";
import type { FileSystem } from "../../../../kernel/file-system-port.ts";
import { accepted, refused, type Result } from "../../../../kernel/result.ts";
import type { FrozenCommandSet, FrozenCommandSubject } from "../../../../projection/domain/frozen-command.ts";

type ChildCommandGenerator = {
  discover(): { readonly stages: readonly { readonly slug: string; render(): string }[];
    readonly scopes: Readonly<Record<string, { readonly description: string }>>; readonly selected: readonly string[] };
  renderScope(name: string, description: string): string;
  renderInit(): string;
  renderCompose(): string;
  regenerate(): void;
};

type ChildCommandPlan = {
  readonly selectedScopeDescription: (request: { readonly name: string; readonly selected: readonly string[];
    readonly scopes: Readonly<Record<string, { readonly description: string }>> }) => Result<string | null, string>;
  readonly duplicateNativeCommand: (commands: readonly {
    readonly subject: FrozenCommandSubject; readonly nativeName: string | null;
  }[]) => { readonly subject: FrozenCommandSubject; readonly files: null; readonly reason: string } | null;
  readonly selectLegacyDocuments: (request: { readonly nativeName: string; readonly paths: readonly string[] }) =>
    Result<{ readonly skill: string;
      readonly companions: readonly { readonly path: string; readonly within: string }[] }, string>;
};

type ChildCommandRendering = (request: {
  readonly stages: readonly string[]; readonly scopes: readonly string[]; readonly folder: URL;
  readonly generator: ChildCommandGenerator; readonly output: Pick<FileSystem, "readTree">;
  readonly plan: ChildCommandPlan;
}) => Promise<FrozenCommandSet>;

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

const message = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const createFrozenCommandGenerator = (capability: unknown): Result<ChildCommandGenerator, string> => {
  const admitted = generatorSchema.safeParse(capability);
  if (!admitted.success) return refused("The frozen runner capability API is invalid.");
  const generator = admitted.data;
  return accepted({
    discover: () => {
      const runnable = generator.runnableStages();
      const scopes = generator.discoverScopes();
      const selected = generator.defaultScopeBatch(scopes);
      return { stages: runnable.map((stage) => ({ slug: stage.slug,
        render: () => generator.renderStageRunner(stage) })), scopes, selected };
    },
    renderScope: (name, description) => generator.renderRunner(name, description),
    renderInit: () => generator.renderInitRunner(),
    renderCompose: () => generator.renderComposeRunner(),
    regenerate: () => generator.regenerateRunnerSurfaces(),
  });
};

const wireReply = (reply: FrozenCommandSet) => ({ ...reply,
  entries: reply.entries.map((entry) => ({ ...entry, files: entry.files?.map((file) => ({ ...file,
    content: file.content.kind === "bytes" ? { kind: "bytes" as const, bytes: Array.from(file.content.bytes) }
      : file.content,
  })) ?? null })),
});

export const runChildWithCapability = async (request: {
  readonly input: z.infer<typeof childSchema>;
  readonly capability: unknown;
  readonly output: Pick<FileSystem, "readTree">;
  readonly plan: ChildCommandPlan;
  readonly render: ChildCommandRendering;
}) => {
  const admitted = createFrozenCommandGenerator(request.capability);
  if (!admitted.ok) return { entries: [], failure: admitted.refusal };
  return wireReply(await request.render({ generator: admitted.value, stages: request.input.stages,
    scopes: request.input.scopes, folder: new URL(request.input.output), output: request.output, plan: request.plan }));
};

export const runChild = async (request: {
  readonly raw: unknown;
  readonly output: Pick<FileSystem, "readTree">;
  readonly plan: ChildCommandPlan;
  readonly render: ChildCommandRendering;
  readonly load: (module: URL) => Promise<unknown>;
}) => {
  const decoded = childSchema.safeParse(request.raw);
  if (!decoded.success) return { entries: [], failure: "The frozen runner request is invalid." };
  try {
    return await runChildWithCapability({ input: decoded.data, output: request.output, plan: request.plan,
      render: request.render, capability: await request.load(new URL(decoded.data.module)) });
  } catch (error) {
    return { entries: [], failure: message(error) };
  }
};

