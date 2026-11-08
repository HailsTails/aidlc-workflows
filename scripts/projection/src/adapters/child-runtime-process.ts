import type { ChildRuntimeDirectories } from "./child-runtime-directory.ts";
import { createNativeCompilerProcessOperations, privateCompilerEnvironment, type NativeCompilerProcessFactory, type NativeCompilerProcessOperations, type NativeCompilerSpawnInput, type NativeCompilerSpawnReply } from "./native-compiler-process.ts";

const privateNames = new Set(["HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "TMPDIR", "BUN_TMPDIR", "BUN_INSTALL", "BUN_INSTALL_CACHE_DIR", "BUN_RUNTIME_TRANSPILER_CACHE_PATH", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME"]);
const runtimeEnvironment = ({ inherited, root }: { readonly inherited: NativeCompilerSpawnInput["env"]; readonly root: string }): NativeCompilerSpawnInput["env"] => ({
  ...Object.fromEntries(Object.entries(inherited).filter(([name]) => !privateNames.has(name.toUpperCase()))),
  ...privateCompilerEnvironment({ inherited, root }),
  ...Object.fromEntries([["TMPDIR", root], ["XDG_CONFIG_HOME", `${root}/config`], ["XDG_CACHE_HOME", `${root}/cache`], ["XDG_DATA_HOME", `${root}/data`], ...(Object.entries(inherited).some(([name, setting]) => name.toUpperCase() === "BUN_RUNTIME_TRANSPILER_CACHE_PATH" && setting === "0") ? [["BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0"]] : [])]),
});
const failureText = (failure: unknown): string => failure instanceof Error ? failure.message : String(failure);
const failedReply = (failure: unknown): NativeCompilerSpawnReply => ({ exitCode: null, stdout: "", stderr: "", error: failureText(failure) });
const executeChild = ({ operations, input, root }: { readonly operations: NativeCompilerProcessOperations; readonly input: NativeCompilerSpawnInput; readonly root: string }): NativeCompilerSpawnReply => {
  try { return operations.spawn({ ...input, env: runtimeEnvironment({ inherited: input.env, root }) }); }
  catch (failure) { return failedReply(`Compiler transport failed: ${failureText(failure)}`); }
};
const releaseChild = ({ directories, root, reply }: { readonly directories: ChildRuntimeDirectories; readonly root: string; readonly reply: NativeCompilerSpawnReply }): NativeCompilerSpawnReply => {
  try { directories.remove({ root }); return reply; }
  catch (failure) { return { ...reply, error: [reply.error, `Runtime home cleanup failed: ${failureText(failure)}`].filter(message => message !== null).join("\n") }; }
};
const spawnChild = ({ directories, operations, input }: { readonly directories: ChildRuntimeDirectories; readonly operations: NativeCompilerProcessOperations; readonly input: NativeCompilerSpawnInput }): NativeCompilerSpawnReply => {
  let root: string;
  try { root = directories.allocate(); }
  catch (failure) { return failedReply(`Runtime home allocation failed: ${failureText(failure)}`); }
  return releaseChild({ directories, root, reply: executeChild({ operations, input, root }) });
};

// The supplied session owner, not distribution output or ambient child TEMP, owns each process lease.
export const createChildRuntimeProcessFactory = ({ runtimeDirectories, create = createNativeCompilerProcessOperations }: { readonly runtimeDirectories: ChildRuntimeDirectories; readonly create?: NativeCompilerProcessFactory }): NativeCompilerProcessFactory => limits => {
  const operations = create(limits);
  return { environment: operations.environment, spawn: input => spawnChild({ directories: runtimeDirectories, operations, input }) };
};
