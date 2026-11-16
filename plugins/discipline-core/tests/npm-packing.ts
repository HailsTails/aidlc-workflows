import type { StepRun } from "../scripts/install-proof-plan.ts";
import type { CommandRunPort } from "../scripts/install-proof-ports.ts";
import type { InMemoryFiles } from "./in-memory-files.ts";

export type CommandRun = Parameters<CommandRunPort["run"]>[0];

export type NpmPacking = {
  readonly commands: CommandRunPort;
  readonly runs: () => readonly CommandRun[];
};

const PACK_DESTINATION_FLAG = "--pack-destination";

const EXITED: StepRun = { outcome: "exited", exitCode: 0, output: "" };

const packDestinationOf = (request: { readonly run: CommandRun }): string | undefined =>
  request.run.arguments[0] === "pack" ? request.run.arguments[request.run.arguments.indexOf(PACK_DESTINATION_FLAG) + 1] : undefined;

export const npmPacking = (request: {
  readonly files: InMemoryFiles;
  readonly tarballName: string;
  readonly tarballText: (request: { readonly packCount: number }) => string;
}): NpmPacking => {
  const recorded: { runs: readonly CommandRun[]; packCount: number } = { runs: [], packCount: 0 };
  return {
    runs: () => recorded.runs,
    commands: {
      run: (run) => {
        recorded.runs = [...recorded.runs, run];
        const destination = packDestinationOf({ run });
        if (destination !== undefined) {
          recorded.packCount += 1;
          request.files.fileText.write({
            path: `${destination}/${request.tarballName}`,
            text: request.tarballText({ packCount: recorded.packCount }),
          });
        }
        return EXITED;
      },
    },
  };
};
