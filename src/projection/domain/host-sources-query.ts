import { brand, type Brand } from "../../kernel/brand.ts";
import { asFolder } from "../../kernel/file-system-port.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import { accepted, refused, type Result } from "../../kernel/result.ts";
import { distributionId, projectPath, sourcePath, type KernelRefusal, type SourcePath } from "../../kernel/values.ts";

export type HostSourcesInput = {
  readonly name: string;
  readonly directory: string;
  readonly root: URL;
  readonly copied: readonly string[];
  readonly required: readonly string[];
};

export type HostSourcesQuery = Brand<{
  readonly host: HostIdentity;
  readonly root: URL;
  readonly sources: readonly SourcePath[];
  readonly required: readonly SourcePath[];
}, "HostSourcesQuery">;

export const hostSourcesQuery = (
  input: HostSourcesInput,
  declared: readonly string[],
): Result<HostSourcesQuery, readonly KernelRefusal[]> => {
  const distribution = distributionId(input.name);
  if (!distribution.ok) return refused([distribution.refusal]);
  const directory = projectPath(input.directory);
  if (!directory.ok) return refused([directory.refusal]);
  const required = [...input.required, ...declared];
  const paths = [...new Set([...input.copied, ...required])].map(sourcePath);
  const failures = paths.flatMap((path) => path.ok ? [] : [path.refusal]);
  if (failures.length > 0) return refused(failures);
  const sources = paths.flatMap((path) => path.ok ? [path.value] : []);
  const root = input.root.href;
  return accepted(brand<HostSourcesQuery>(Object.freeze({
    host: Object.freeze({ distribution: distribution.value, directory: directory.value }),
    get root() { return new URL(root); },
    sources: Object.freeze(sources),
    required: Object.freeze(sources.filter((path) => required.includes(path))),
  })));
};

const sameSources = (left: readonly SourcePath[], right: readonly SourcePath[]): boolean =>
  left.length === right.length && left.every((source, index) => source === right[index]);

export const sameHostSourcesQuery = (left: HostSourcesQuery, right: HostSourcesQuery): boolean =>
  left.host.distribution === right.host.distribution && left.host.directory === right.host.directory &&
  asFolder(left.root).href === asFolder(right.root).href && sameSources(left.sources, right.sources) &&
  sameSources(left.required, right.required);
