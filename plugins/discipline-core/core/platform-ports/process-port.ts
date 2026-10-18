export type ExitCode = 0 | 1 | 2;

export type ProcessPort = {
  readonly arguments: readonly string[];
  readonly writeOut: (request: { readonly text: string }) => void;
  readonly exitWith: (request: { readonly code: ExitCode }) => void;
};

export type ProcessSurface = {
  readonly argv: readonly string[];
  readonly write: (request: { readonly text: string }) => void;
  readonly setExitCode: (request: { readonly code: ExitCode }) => void;
};

const ARGUMENTS_BEFORE_SCRIPT_ARGUMENTS = 2;

export const createProcessPort = (options: {
  readonly processSurface: ProcessSurface;
}): ProcessPort => ({
  arguments: options.processSurface.argv.slice(ARGUMENTS_BEFORE_SCRIPT_ARGUMENTS),
  writeOut: (request) => {
    options.processSurface.write({ text: request.text });
  },
  exitWith: (request) => {
    options.processSurface.setExitCode({ code: request.code });
  },
});

export const defaultProcessSurface: ProcessSurface = {
  argv: process.argv,
  write: (request) => {
    process.stdout.write(request.text);
  },
  setExitCode: (request) => {
    process.exitCode = request.code;
  },
};

export const createDefaultProcessPort = (
  _options: Record<string, never>,
): ProcessPort => createProcessPort({ processSurface: defaultProcessSurface });
