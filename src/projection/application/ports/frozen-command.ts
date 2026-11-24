import type { FileSystem } from "../../../kernel/file-system-port.ts";
import type { Result } from "../../../kernel/result.ts";
import type { FrozenCommandSubject } from "../../domain/frozen-command.ts";
import type { FrozenCommandSet } from "../../domain/frozen-command.ts";

export type FrozenCommandDiscovery = {
  readonly stages: readonly { readonly slug: string; render(): string }[];
  readonly scopes: Readonly<Record<string, { readonly description: string }>>;
  readonly selected: readonly string[];
};

export interface FrozenCommandGenerator {
  discover(): FrozenCommandDiscovery;
  renderScope(name: string, description: string): string;
  renderInit(): string;
  renderCompose(): string;
  regenerate(): void;
}

export type FrozenCommandPlan = {
  readonly selectedScopeDescription: (request: {
    readonly name: string; readonly selected: readonly string[];
    readonly scopes: FrozenCommandDiscovery["scopes"];
  }) => Result<string | null, string>;
  readonly duplicateNativeCommand: (commands: readonly {
    readonly subject: FrozenCommandSubject; readonly nativeName: string | null;
  }[]) => { readonly subject: FrozenCommandSubject; readonly files: null; readonly reason: string } | null;
  readonly selectLegacyDocuments: (request: { readonly nativeName: string; readonly paths: readonly string[] }) =>
    Result<{ readonly skill: string;
      readonly companions: readonly { readonly path: string; readonly within: string }[] }, string>;
};

export type FrozenCommandRequest = {
  readonly stages: readonly string[]; readonly scopes: readonly string[]; readonly folder: URL;
  readonly generator: FrozenCommandGenerator; readonly output: Pick<FileSystem, "readTree">;
  readonly plan: FrozenCommandPlan;
};

export type RenderFrozenCommandSet = (request: FrozenCommandRequest) => Promise<FrozenCommandSet>;
