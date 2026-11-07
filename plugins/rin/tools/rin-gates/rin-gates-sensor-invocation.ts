type SensorInvocation =
  | {
      readonly kind: "invoked";
      readonly stage: string;
      readonly outputPath: string;
    }
  | { readonly kind: "incomplete"; readonly missingFlags: readonly string[] };

type RecordLocation =
  | {
      readonly kind: "record";
      readonly recordDirectory: string;
      readonly recordName: string;
    }
  | { readonly kind: "not-a-record" };

const STAGE_FLAG = "--stage";
const OUTPUT_PATH_FLAG = "--output-path";
const RECORD_PATH = /^(.*\/aidlc\/spaces\/[^/]+\/intents\/)([^/]+)/;
const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:\/)/;

const flagArgumentOf = ({
  commandLineArguments,
  flag,
}: {
  readonly commandLineArguments: readonly string[];
  readonly flag: string;
}): string | undefined => {
  const flagIndex = commandLineArguments.indexOf(flag);
  const flagArgument =
    flagIndex === -1 ? undefined : commandLineArguments[flagIndex + 1];
  if (flagArgument === undefined || flagArgument.startsWith("--")) {
    return undefined;
  }
  return flagArgument;
};

const sensorInvocationFrom = ({
  commandLineArguments,
}: {
  readonly commandLineArguments: readonly string[];
}): SensorInvocation => {
  const stage = flagArgumentOf({ commandLineArguments, flag: STAGE_FLAG });
  const outputPath = flagArgumentOf({
    commandLineArguments,
    flag: OUTPUT_PATH_FLAG,
  });
  return stage === undefined || outputPath === undefined
    ? {
        kind: "incomplete",
        missingFlags: [
          ...(stage === undefined ? [STAGE_FLAG] : []),
          ...(outputPath === undefined ? [OUTPUT_PATH_FLAG] : []),
        ],
      }
    : { kind: "invoked", stage, outputPath };
};

const forwardSlashedPath = ({ path }: { readonly path: string }): string =>
  path.replace(/\\/g, "/").replace(/\/+$/, "");

const absolutePathFrom = ({
  path,
  projectDirectory,
}: {
  readonly path: string;
  readonly projectDirectory: string;
}): string => {
  const normalisedPath = forwardSlashedPath({ path }).replace(/^\.\//, "");
  return ABSOLUTE_PATH.test(normalisedPath)
    ? normalisedPath
    : `${forwardSlashedPath({ path: projectDirectory })}/${normalisedPath}`;
};

const recordLocationFor = ({
  outputPath,
  projectDirectory,
}: {
  readonly outputPath: string;
  readonly projectDirectory: string;
}): RecordLocation => {
  const absoluteOutputPath = absolutePathFrom({
    path: outputPath,
    projectDirectory,
  });
  const recordPathMatch = absoluteOutputPath.match(RECORD_PATH);
  const intentsDirectory = recordPathMatch?.[1];
  const recordName = recordPathMatch?.[2];
  if (intentsDirectory === undefined || recordName === undefined) {
    return { kind: "not-a-record" };
  }
  return {
    kind: "record",
    recordDirectory: `${intentsDirectory}${recordName}`,
    recordName,
  };
};

export {
  type RecordLocation,
  recordLocationFor,
  type SensorInvocation,
  sensorInvocationFrom,
};
