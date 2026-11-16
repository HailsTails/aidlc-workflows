import type {
  ProcessFailure,
  ProcessOutput,
  ProcessRunner,
  RunCurrentRuntimeArgs,
} from "../process-runner-port.ts";
import type { NativeProcessExit, NativeProcessRequest, NodeProcessLib } from "../process-runner.ts";
import type { Result } from "../result.ts";

export type ScriptedProcessRunnerArgs = {
  readonly outcome: Result<ProcessOutput, ProcessFailure>;
};

export type ScriptedProcessRunner = ProcessRunner & {
  readonly received: () => readonly RunCurrentRuntimeArgs[];
};

export const createScriptedProcessRunner = (
  { outcome }: ScriptedProcessRunnerArgs,
): ScriptedProcessRunner => {
  const requests: RunCurrentRuntimeArgs[] = [];
  return {
    runCurrentRuntime: async (runCurrentRuntimeArgs) => {
      requests.push(runCurrentRuntimeArgs);
      return outcome;
    },
    received: () => [...requests],
  };
};

export type RecordingProcessLib = {
  readonly processLib: NodeProcessLib;
  readonly spawned: () => readonly NativeProcessRequest[];
};

export const createRecordingProcessLib = (
  { exit }: { readonly exit: NativeProcessExit },
): RecordingProcessLib => {
  const requests: NativeProcessRequest[] = [];
  return {
    processLib: {
      runtime: "/runtime/bin/bun",
      runtimeFolder: "/runtime/bin/",
      nativePath: (location) => `native:${location.pathname}`,
      spawn: async (nativeProcessRequest) => {
        requests.push(nativeProcessRequest);
        return exit;
      },
    },
    spawned: () => [...requests],
  };
};
