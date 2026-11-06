import type { RuntimePreparationFailure } from "./plugin-runtime.ts";

export type PackageRuntimeCliPort = {
  readonly writeError: (input: { readonly message: string }) => void;
  readonly setExitCode: (input: { readonly code: number }) => void;
};

export function createPackageRuntimeCliPort(): PackageRuntimeCliPort {
  return {
    writeError: ({ message }) => { process.stderr.write(message + "\n"); },
    setExitCode: ({ code }) => { process.exitCode = code; },
  };
}

function packageRuntimeFailureMessage(input: { readonly failure: RuntimePreparationFailure }): string {
  if (input.failure.kind === "refused") return input.failure.message;
  return input.failure.error.message;
}

export function reportPackageRuntimeFailure(input: {
  readonly failure: RuntimePreparationFailure;
  readonly port: PackageRuntimeCliPort;
}): void {
  input.port.writeError({ message: packageRuntimeFailureMessage(input) });
  input.port.setExitCode({ code: 1 });
}
