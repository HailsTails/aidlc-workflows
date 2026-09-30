import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

type Result<T, E> =
  | { readonly outcome: "ok"; readonly value: T }
  | { readonly outcome: "failed"; readonly error: E };

const succeed = <T>(value: T): Result<T, never> => ({ outcome: "ok", value });
const failWith = <E>(error: E): Result<never, E> => ({
  outcome: "failed",
  error,
});

type SelectionConfig = {
  readonly ratifiedMilestones: readonly string[];
  readonly neglectThresholdDays: number;
};

type SelectionConfigFailure = {
  readonly kind: "malformed-selection-config";
  readonly detail: string;
};

declare const selectionRankingConfigPathBrand: unique symbol;

type SelectionRankingConfigPath = string & {
  readonly [selectionRankingConfigPathBrand]: "SelectionRankingConfigPath";
};

type SelectionRankingConfiguration = {
  readonly selectionRankingConfigPath: SelectionRankingConfigPath;
  readonly selectionConfig: SelectionConfig;
};

type RatifiedMilestones = {
  readonly selectionRankingConfigPath: SelectionRankingConfigPath;
  readonly ratifiedMilestones: readonly string[];
};

type SelectionRankingPathResolution =
  | {
      readonly outcome: "ok";
      readonly selectionRankingPath: {
        readonly selectionRankingConfigPath: SelectionRankingConfigPath;
      };
    }
  | {
      readonly outcome: "failed";
      readonly selectionRankingPathFailure: {
        readonly kind: "selection-ranking-override-invalid";
        readonly overrideDetail: string;
      };
    };

type ResolveSelectionRankingPath = (request: {
  readonly toolsDir: string;
  readonly rawConfiguredPath: string | undefined;
}) => SelectionRankingPathResolution;

type SelectionRankingConfigReadFailure =
  | {
      readonly kind: "selection-ranking-missing";
      readonly selectionRankingConfigPath: SelectionRankingConfigPath;
    }
  | {
      readonly kind: "selection-ranking-unreadable";
      readonly selectionRankingConfigPath: SelectionRankingConfigPath;
    };

type SelectionRankingConfigReader = {
  readonly read: (request: {
    readonly selectionRankingConfigPath: SelectionRankingConfigPath;
  }) =>
    | { readonly outcome: "ok"; readonly rawSelectionRankingConfig: string }
    | {
        readonly outcome: "failed";
        readonly selectionRankingConfigReadFailure: SelectionRankingConfigReadFailure;
      };
};

type SelectionRankingReadFailure =
  | SelectionRankingConfigReadFailure
  | {
      readonly kind: "selection-ranking-malformed";
      readonly selectionRankingConfigPath: SelectionRankingConfigPath;
      readonly malformedConfigDetail: string;
    };

type SelectionRankingReadResult =
  | {
      readonly outcome: "ok";
      readonly selectionRankingConfiguration: SelectionRankingConfiguration;
    }
  | {
      readonly outcome: "failed";
      readonly selectionRankingReadFailure: SelectionRankingReadFailure;
    };

type CreateNodeSelectionRankingConfigReader =
  () => SelectionRankingConfigReader;

type ReadSelectionRankingConfiguration = (request: {
  readonly selectionRankingConfigPath: SelectionRankingConfigPath;
  readonly selectionRankingConfigReader: SelectionRankingConfigReader;
}) => SelectionRankingReadResult;

const selectionRankingPathSchema = z.custom<SelectionRankingConfigPath>(
  (candidate) => typeof candidate === "string" && /\S/.test(candidate),
);

const resolveSelectionRankingPath: ResolveSelectionRankingPath = ({
  toolsDir,
  rawConfiguredPath,
}) => {
  const parsed = selectionRankingPathSchema.safeParse(
    rawConfiguredPath ?? join(toolsDir, SELECTION_RANKING_FILENAME),
  );
  return parsed.success
    ? {
        outcome: "ok",
        selectionRankingPath: { selectionRankingConfigPath: parsed.data },
      }
    : {
        outcome: "failed",
        selectionRankingPathFailure: {
          kind: "selection-ranking-override-invalid",
          overrideDetail: "Invalid ranking policy path.",
        },
      };
};

const createNodeSelectionRankingConfigReader: CreateNodeSelectionRankingConfigReader =
  () => ({
    read: ({ selectionRankingConfigPath }) => {
      try {
        return {
          outcome: "ok",
          rawSelectionRankingConfig: readFileSync(
            selectionRankingConfigPath,
            "utf8",
          ),
        };
      } catch (failure) {
        return {
          outcome: "failed",
          selectionRankingConfigReadFailure: {
            kind:
              failure instanceof Error &&
              "code" in failure &&
              failure.code === "ENOENT"
                ? "selection-ranking-missing"
                : "selection-ranking-unreadable",
            selectionRankingConfigPath,
          },
        };
      }
    },
  });

const readSelectionRankingConfiguration: ReadSelectionRankingConfiguration = ({
  selectionRankingConfigPath,
  selectionRankingConfigReader,
}) => {
  const readResult = selectionRankingConfigReader.read({
    selectionRankingConfigPath,
  });
  if (readResult.outcome === "failed") {
    return {
      outcome: "failed",
      selectionRankingReadFailure: readResult.selectionRankingConfigReadFailure,
    };
  }
  const parsed = parseSelectionConfig({
    raw: readResult.rawSelectionRankingConfig,
  });
  return parsed.outcome === "ok"
    ? {
        outcome: "ok",
        selectionRankingConfiguration: {
          selectionRankingConfigPath,
          selectionConfig: parsed.value,
        },
      }
    : {
        outcome: "failed",
        selectionRankingReadFailure: {
          kind: "selection-ranking-malformed",
          selectionRankingConfigPath,
          malformedConfigDetail: parsed.error.detail,
        },
      };
};

const SELECTION_RANKING_FILENAME = "selection-ranking.json";

const selectionRankingConfigPath = (args: {
  readonly toolsDir: string;
}): string => join(args.toolsDir, SELECTION_RANKING_FILENAME);

const selectionConfigSchema = z.object({
  ratifiedMilestones: z.array(z.string()),
  neglectThresholdDays: z.number(),
});

const parseSelectionConfig = (args: {
  readonly raw: string;
}): Result<SelectionConfig, SelectionConfigFailure> => {
  const parsed = ((): unknown => {
    try {
      return JSON.parse(args.raw);
    } catch (error) {
      return { parseError: error instanceof Error ? error.message : "invalid" };
    }
  })();
  const validated = selectionConfigSchema.safeParse(parsed);
  return validated.success
    ? succeed({
        ratifiedMilestones: validated.data.ratifiedMilestones,
        neglectThresholdDays: validated.data.neglectThresholdDays,
      })
    : failWith({
        kind: "malformed-selection-config",
        detail: validated.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
};

export type {
  CreateNodeSelectionRankingConfigReader,
  RatifiedMilestones,
  ReadSelectionRankingConfiguration,
  ResolveSelectionRankingPath,
  SelectionRankingConfigPath,
  SelectionRankingConfigReader,
  SelectionRankingConfigReadFailure,
  SelectionRankingConfiguration,
  SelectionRankingPathResolution,
  SelectionRankingReadFailure,
  SelectionRankingReadResult,
};
export {
  createNodeSelectionRankingConfigReader,
  parseSelectionConfig,
  type Result,
  readSelectionRankingConfiguration,
  resolveSelectionRankingPath,
  SELECTION_RANKING_FILENAME,
  type SelectionConfig,
  type SelectionConfigFailure,
  selectionRankingConfigPath,
};
