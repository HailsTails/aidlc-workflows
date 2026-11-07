type SensorRuntime = {
  readonly commandLineArguments: () => readonly string[];
  readonly projectDirectory: () => string;
  readonly writeOutput: (request: { readonly text: string }) => void;
};

type SensorProcess = Pick<NodeJS.Process, "argv" | "cwd"> & {
  readonly stdout: { readonly write: (text: string) => unknown };
};

const defaultSensorRuntime = (
  { nodeProcess }: { readonly nodeProcess: SensorProcess } = {
    nodeProcess: process,
  },
): SensorRuntime => ({
  commandLineArguments: () => nodeProcess.argv.slice(2),
  projectDirectory: () => nodeProcess.cwd(),
  writeOutput: ({ text }) => {
    nodeProcess.stdout.write(text);
  },
});

export { defaultSensorRuntime, type SensorProcess, type SensorRuntime };
