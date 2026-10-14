export type ProcessPort = {
  readonly arguments: readonly string[];
  readonly writeOut: (request: { readonly text: string }) => void;
  readonly exitWith: (request: { readonly code: 0 | 1 | 2 }) => void;
};

const ARGUMENTS_BEFORE_SCRIPT_ARGUMENTS = 2;

export const createProcessPort = (
  _options: Record<string, never>,
): ProcessPort => ({
  arguments: process.argv.slice(ARGUMENTS_BEFORE_SCRIPT_ARGUMENTS),
  writeOut: (request) => {
    process.stdout.write(request.text);
  },
  exitWith: (request) => {
    process.exitCode = request.code;
  },
});
