import { z } from "zod";
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
  Hit,
  NativeException,
  nativeExceptionKindSchema,
} from "./runner-result-schema.ts";

export type RunnerClause = {
  readonly address: ClauseAddress;
  readonly anchor: AnchorKind;
  readonly pieceRoot: string;
  readonly settings: unknown;
};

export type RunRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly files: readonly RepoPath[];
  readonly trackedPaths: readonly RepoPath[];
  readonly clauses: readonly RunnerClause[];
};

export type StandaloneRunner = {
  readonly exceptionPath: "standalone";
  readonly run: (request: RunRequest) => Promise<Result<readonly Hit[], RunnerFailure>>;
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

export const runnerModuleSchema = z.discriminatedUnion("exceptionPath", [
  standaloneRunnerModuleSchema,
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
