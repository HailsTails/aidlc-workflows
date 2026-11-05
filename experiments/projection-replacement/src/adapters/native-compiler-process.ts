export type NativeCompilerSpawnInput = { readonly binary: string; readonly args: readonly string[]; readonly cwd: string; readonly input: string; readonly env: Readonly<Record<string, string | undefined>> };
export type NativeCompilerSpawnReply = { readonly exitCode: number | null; readonly stdout: string; readonly stderr: string; readonly error: string | null };
export type NativeCompilerProcessOperations = { readonly environment: () => Readonly<Record<string, string | undefined>>; readonly spawn: (input: NativeCompilerSpawnInput) => NativeCompilerSpawnReply };
export const compilerSystemEnvironment = ({ inherited }: { readonly inherited: Readonly<Record<string, string | undefined>> }): Readonly<Record<string, string | undefined>> => Object.fromEntries(Object.entries(inherited).filter(([key]) => ["PATH", "TEMP", "TMP", "SYSTEMROOT", "WINDIR"].includes(key.toUpperCase())));
export const createNativeCompilerProcessOperations = (): NativeCompilerProcessOperations => ({
  environment: () => ({ ...process.env }),
  spawn: ({ binary, args: commandArguments, cwd, input, env }) => {
    try {
      const reply = Bun.spawnSync({ cmd: [binary, ...commandArguments], cwd, stdin: Buffer.from(input), env, stdout: "pipe", stderr: "pipe", timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
      return { exitCode: reply.exitCode, stdout: reply.stdout.toString(), stderr: reply.stderr.toString(), error: reply.exitedDueToTimeout ? "compiler timeout" : reply.exitedDueToMaxBuffer ? "compiler output exceeded limit" : null };
    } catch (error) { return { exitCode: null, stdout: "", stderr: "", error: error instanceof Error ? error.message : String(error) }; }
  },
});
