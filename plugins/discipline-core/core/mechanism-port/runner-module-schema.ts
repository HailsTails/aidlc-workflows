import { z } from "zod";
import type { ExceptionRecord } from "../exception-records/exception-records.ts";
import type { SourceCase } from "../rule-set-reader/rule-set-reader.ts";
import type { AbsolutePath } from "../values/absolute-path.ts";
import type { AnchorKind } from "../values/anchor.ts";
import type { ClauseAddress } from "../values/clause-address.ts";
import type { RepoPath } from "../values/repo-path.ts";
import type { Result } from "../values/result.ts";
import type { Equal } from "../values/type-equality.ts";
import type { RunnerFailure } from "./runner-failure.ts";
import type {
  CaseVerdict,
  MechanismObservations,
  NativeException,
  nativeExceptionKindSchema,
} from "./runner-result-schema.ts";
import { nativeExceptionKindSchema as projectedKindSchema } from "./runner-result-schema.ts";

export type RunnerClause = {
  readonly address: ClauseAddress;
  readonly anchor: AnchorKind;
  readonly pieceRoot: string;
  readonly settings: unknown;
};

export type LocationScope = (request: {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
}) => "included" | "excluded";

export type RunRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly trackedPaths: readonly RepoPath[];
  readonly clauses: readonly RunnerClause[];
  readonly includes?: LocationScope;
};

export type ProjectionRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly clauses: readonly RunnerClause[];
  readonly records: readonly ExceptionRecord[];
};

export type StandaloneRunner = {
  readonly exceptionPath: "standalone";
  readonly run: (request: RunRequest) => Promise<Result<MechanismObservations, RunnerFailure>>;
  readonly conform: (request: {
    readonly clause: RunnerClause;
    readonly cases: readonly SourceCase[];
  }) => Promise<Result<readonly CaseVerdict[], RunnerFailure>>;
};

export const runnerCallSchema = z.function({
  input: [z.unknown()],
  output: z.promise(z.unknown()),
});

export const standaloneRunnerModuleSchema = z.object({
  exceptionPath: z.literal("standalone"),
  run: runnerCallSchema,
  conform: runnerCallSchema,
});

export const embeddedRunnerModuleSchema = z.object({
  exceptionPath: z.literal("embedded"),
  projectedKinds: z.array(projectedKindSchema),
  run: runnerCallSchema,
  conform: runnerCallSchema,
  project: runnerCallSchema,
});

export const runnerModuleSchema = z.discriminatedUnion("exceptionPath", [
  standaloneRunnerModuleSchema,
  embeddedRunnerModuleSchema,
]);

export type LoadedRunner = z.infer<typeof runnerModuleSchema>;

export const isStandaloneKeySetEqual: Equal<
  keyof StandaloneRunner,
  keyof z.output<typeof standaloneRunnerModuleSchema>
> = true;

export const isStandaloneExceptionPathEqual: Equal<
  StandaloneRunner["exceptionPath"],
  z.output<typeof standaloneRunnerModuleSchema>["exceptionPath"]
> = true;

export const isNativeKindEnumEqual: Equal<
  z.infer<typeof nativeExceptionKindSchema>,
  NativeException["kind"]
> = true;
