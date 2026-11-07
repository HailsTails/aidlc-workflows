export type NativeCompilerSpawnInput = { readonly binary: string; readonly args: readonly string[]; readonly cwd: string; readonly input: string; readonly env: Readonly<Record<string, string | undefined>> };
export type NativeCompilerSpawnReply = { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string; readonly error: string | null };
export type NativeCompilerProcessOperations = { readonly environment: () => Readonly<Record<string, string | undefined>>; readonly spawn: (input: NativeCompilerSpawnInput) => NativeCompilerSpawnReply };
export const compilerSystemEnvironment = ({ inherited }: { readonly inherited: Readonly<Record<string, string | undefined>> }): Readonly<Record<string, string | undefined>> => Object.fromEntries(Object.entries(inherited).filter(([key]) => ["PATH", "TEMP", "TMP", "SYSTEMROOT", "WINDIR"].includes(key.toUpperCase())));
export const privateCompilerEnvironment = ({ inherited, root }: { readonly inherited: Readonly<Record<string, string | undefined>>; readonly root: string }): Readonly<Record<string, string | undefined>> => ({
  ...Object.fromEntries(Object.entries(compilerSystemEnvironment({ inherited })).filter(([name]) => !["TEMP", "TMP"].includes(name.toUpperCase()))),
  ...Object.fromEntries([
    ...["HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "BUN_TMPDIR"].map((name) => [name, root]),
    ["BUN_INSTALL", `${root}/bun-install`], ["BUN_INSTALL_CACHE_DIR", `${root}/bun-cache`], ["BUN_RUNTIME_TRANSPILER_CACHE_PATH", `${root}/transpiler-cache`],
  ]),
});
export type NativeCompilerProcessLimits = { readonly timeout?: number; readonly maxBuffer?: number };
export type NativeCompilerTransport = { readonly environment: NativeCompilerProcessOperations["environment"]; readonly spawn: (input: NativeCompilerSpawnInput & { readonly timeout: number; readonly maxBuffer: number }) => NativeCompilerSpawnReply };
export const createNativeCompilerTransport = (): NativeCompilerTransport => ({
  environment: () => ({ ...process.env }),
  spawn: ({ binary, args: commandArguments, cwd, input, env, timeout, maxBuffer }) => {
    try {
      const reply = Bun.spawnSync({ cmd: [binary, ...commandArguments], cwd, stdin: Buffer.from(input), env, stdout: "pipe", stderr: "pipe", timeout, maxBuffer });
      return { exitCode: reply.exitCode, stdout: reply.stdout.toString(), stderr: reply.stderr.toString(), error: reply.exitedDueToTimeout ? "compiler timeout" : reply.exitedDueToMaxBuffer ? "compiler output exceeded limit" : null };
    } catch (error) { return { exitCode: null, stdout: "", stderr: "", error: error instanceof Error ? error.message : String(error) }; }
  },
});
export const createNativeCompilerProcessOperations = ({ timeout = 10000, maxBuffer = 8 * 1024 * 1024, transport = createNativeCompilerTransport() }: NativeCompilerProcessLimits & { readonly transport?: NativeCompilerTransport } = {}): NativeCompilerProcessOperations => ({ environment: transport.environment, spawn: (input) => transport.spawn({ ...input, timeout, maxBuffer }) });
