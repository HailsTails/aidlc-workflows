import type { Result } from "./result.ts";

export type ProcessArgument =
  | string
  | { readonly kind: "path"; readonly location: URL }
  | { readonly kind: "runtime-folder" };

export type RunCurrentRuntimeArgs = {
  readonly argv: readonly ProcessArgument[];
  readonly env: Readonly<Record<string, ProcessArgument>>;
  readonly cwd: URL;
  readonly input: string;
};

export type ProcessExit =
  | { readonly kind: "exited"; readonly code: number }
  | { readonly kind: "signalled"; readonly signal: string };

export type ProcessOutput = {
  readonly exit: ProcessExit;
  readonly stdout: string;
  readonly stderr: string;
};

export type ProcessFailure = { readonly kind: "not-started"; readonly reason: string };

export type ProcessRunner = {
  runCurrentRuntime(
    runCurrentRuntimeArgs: RunCurrentRuntimeArgs,
  ): Promise<Result<ProcessOutput, ProcessFailure>>;
};
