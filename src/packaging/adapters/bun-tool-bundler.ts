import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { ContentDigester } from "../../kernel/content-digester-port.ts";
import { projectPath } from "../../kernel/values.ts";
import type { ToolBundler } from "../application/ports.ts";
import type { PackagingRefusal } from "../domain/artifact.ts";
import type { PayloadFile, RuntimeEntryPoint } from "../domain/payload.ts";
import type { HostIdentity } from "../../kernel/host.ts";

export type ToolBuildLib = {
  build(options: Bun.BuildConfig): Promise<Pick<Bun.BuildOutput, "success"> & {
    readonly logs: readonly { readonly message: string }[];
    readonly outputs: readonly Pick<Blob, "text">[];
  }>;
};
export const BUN_BUILD_LIB: ToolBuildLib = { build: Bun.build };
type BundlerInputs = { readonly sourceRoot: URL; readonly digester: ContentDigester;
  readonly buildLib: ToolBuildLib };

const buildEntry = async (request: BundlerInputs & {
  readonly entry: RuntimeEntryPoint;
}): Promise<Result<string, PackagingRefusal>> => {
  try {
    const built = await request.buildLib.build({
      entrypoints: [Bun.fileURLToPath(new URL(request.entry.compositionRoot, request.sourceRoot))],
      root: Bun.fileURLToPath(request.sourceRoot), target: "bun", format: "esm",
      minify: false, sourcemap: "none", splitting: false,
    });
    const [output] = built.outputs;
    if (!built.success || built.outputs.length !== 1 || output === undefined) {
      return refused({ kind: "entry-not-bundled", entry: request.entry.name,
        reason: built.logs.map((message) => message.message).join("\n") || "The build returned no single entry output." });
    }
    return accepted(await output.text());
  } catch (error) {
    return refused({ kind: "entry-not-bundled", entry: request.entry.name,
      reason: error instanceof Error ? error.message : String(error) });
  }
};

const bundleEntry = async (request: BundlerInputs & {
  readonly host: HostIdentity; readonly entry: RuntimeEntryPoint;
}): Promise<Result<PayloadFile, PackagingRefusal>> => {
  const path = projectPath(`${request.host.directory}/tools/lib/${request.entry.name}.js`);
  if (!path.ok) return refused({ kind: "entry-not-bundled", entry: request.entry.name,
    reason: "The bundle destination must be a project-relative path." });
  const built = await buildEntry(request);
  if (!built.ok) return built;
  const content = { kind: "text" as const, text: built.value };
  const hash = request.digester.hash(content);
  if (!hash.ok) return refused({ kind: "entry-not-bundled", entry: request.entry.name,
    reason: `The bundle content digest was refused: ${hash.refusal.kind}.` });
  return accepted({ path: path.value, content, mode: "regular", hash: hash.value,
    origin: { kind: "bundled-runtime", entry: request.entry } });
};

export const createBunToolBundler = ({ sourceRoot, digester, buildLib }: {
  readonly sourceRoot: URL; readonly digester: ContentDigester; readonly buildLib: ToolBuildLib;
}): ToolBundler => ({
  bundle: async ({ entries, host }) => {
    const readings = await Promise.all(entries.map((entry) => bundleEntry({ sourceRoot, digester, buildLib, host, entry })));
    const failure = readings.find((reading) => !reading.ok);
    return failure && !failure.ok ? failure : accepted(readings.flatMap((reading) => reading.ok ? [reading.value] : []));
  },
});
