import { parseArgs } from "node:util";
import { z } from "zod";
import { DEFAULT_SLOT_POLICY, type SlotPolicy } from "../domain/machine-lock.ts";
import { CHECK_IDS } from "../domain/outcome.ts";
import type { GateRequest } from "../application/gate-request.ts";
import type { Loaded } from "../application/ports.ts";

export type ArgumentDefaults = {
  readonly baseRef: string;
  readonly waitSeconds: number;
};

export const USAGE = [
  "bun scripts/gate.ts --scope <lane-id>[+<lane-id>...]|<path>[,<path>...]" +
    " [--base <ref>] [--record]",
  "bun scripts/gate.ts --full [--lane <lane-id>[+<lane-id>...]]" +
    " [--base <ref>] [--no-build] [--record]",
  "                    [--all-tests] [--sweep]",
  "--sweep runs once on the clean current foundation, holds every slot and records its verdict.",
  "Candidate test gates name that sweep; a missing or red sweep blocks a green candidate.",
  "Cheap-only checks remain available. Budgets (180 s candidate, 600 s sweep) are advisory.",
  "                    [--wait <seconds> | --no-wait]",
  "bun scripts/gate.ts --update-goldens [--no-build] [--wait <seconds> | --no-wait]",
  "bun scripts/gate.ts --locked [--wait <seconds> | --no-wait] -- <command> [args...]",
  "",
  `--only <id>[,<id>...] limits --scope or --full to checks: ${CHECK_IDS.join(", ")}.`,
  "Run from the lane worktree root. Every run, usage errors included, ends with one",
  "stdout line: AIDLC_GATE {json}. --help prints this text only.",
  "Exit: 0 green, 1 red, 2 usage or environment error, 3 machine lock busy.",
  "Only heavy work takes one of the machine lock's slots: --full, --update-goldens, and",
  "--locked around a package build (scripts/package.ts, with or without --check) or a",
  "golden run. Never wrap --scope, typecheck or bun test in --locked; they run freely.",
  "A heavy job takes a slot only while free memory is at or above the floor; otherwise",
  "it waits, and the wait and busy lines say why: no free slot, or free memory below",
  "floor.",
  "--locked streams the command's own output and exits with its exit code; its",
  "summary line carries that code as exitCode (green on 0, red otherwise).",
  "A slot is never broken while its owner process is alive on the same host.",
  "Env: AIDLC_GATE_BASE (default base ref), AIDLC_GATE_LOCK_DIR (lock folder; default",
  "     .aidlc-gate in the folder that holds the main checkout),",
  `     AIDLC_GATE_SLOTS (heavy jobs at once; default ${DEFAULT_SLOT_POLICY.slots}),`,
  `     AIDLC_GATE_MIN_FREE_MB (free-memory floor; default ${DEFAULT_SLOT_POLICY.minFreeMb}),`,
  "     AIDLC_DISCIPLINE_CORE (discipline-core install; default",
  "     aidlc-discipline-core-main/plugins/discipline-core beside the main checkout,",
  "     linked into the worktree at .cache/discipline-core; it must be a git checkout",
  "     at the commit in lint/discipline-core-pin.txt).",
  "--record also regenerates the disciplines.json exclude list from lint/zones.ts and",
  "the ESLint projection; the summary line carries the debt figure apart from checks.",
].join("\n");

const OPTIONS = {
  only: { type: "string" },
  scope: { type: "string" },
  full: { type: "boolean" },
  sweep: { type: "boolean" },
  lane: { type: "string" },
  base: { type: "string" },
  wait: { type: "string" },
  "no-wait": { type: "boolean" },
  "no-build": { type: "boolean" },
  "all-tests": { type: "boolean" },
  record: { type: "boolean" },
  "update-goldens": { type: "boolean" },
  locked: { type: "boolean" },
  help: { type: "boolean" },
} as const;

const OnlySchema = z
  .string()
  .transform((value) => value.split(",").filter((id) => id !== ""))
  .pipe(z.array(z.enum(CHECK_IDS)).min(1));

const RawSchema = z.object({
  only: OnlySchema.optional(),
  scope: z.string().min(1).optional(),
  full: z.boolean().optional(),
  sweep: z.boolean().optional(),
  lane: z.string().min(1).optional(),
  base: z.string().min(1).optional(),
  wait: z.coerce.number().int().nonnegative().optional(),
  "no-wait": z.boolean().optional(),
  "no-build": z.boolean().optional(),
  "all-tests": z.boolean().optional(),
  record: z.boolean().optional(),
  "update-goldens": z.boolean().optional(),
  locked: z.boolean().optional(),
  help: z.boolean().optional(),
});

type Raw = z.infer<typeof RawSchema>;

const usageError = (problem: string): Loaded<never> => ({
  ok: false,
  problem,
  fix: "Run bun scripts/gate.ts --help and pass one of its modes.",
});

const waitMs = (raw: Raw, defaults: ArgumentDefaults): number =>
  raw["no-wait"] === true ? 0 : (raw.wait ?? defaults.waitSeconds) * 1000;

const modeCount = (raw: Raw): number =>
  [raw.scope !== undefined, raw.full, raw["update-goldens"], raw.locked].filter(Boolean).length;

type Parsed = { readonly raw: Raw; readonly positionals: readonly string[] };

const requestFor = (parsed: Parsed, defaults: ArgumentDefaults): GateRequest => {
  const { raw, positionals } = parsed;
  const baseRef = raw.base ?? defaults.baseRef;
  const record = raw.record === true;
  const only = raw.only ?? "all";
  const wait = waitMs(raw, defaults);
  const build = raw["no-build"] !== true;
  const allTests = raw["all-tests"] === true;
  if (raw.scope !== undefined) {
    return { kind: "scope", target: raw.scope, baseRef, record, allTests, waitMs: wait, only };
  }
  if (raw.full === true) {
    return {
      kind: "full",
      laneId: raw.lane,
      sweep: raw.sweep === true,
      baseRef,
      build,
      record,
      allTests,
      waitMs: wait,
      only,
    };
  }
  return raw.locked === true
    ? { kind: "locked", command: positionals, waitMs: wait }
    : { kind: "update-goldens", build, waitMs: wait };
};

const parsedArguments = (argv: readonly string[]): Loaded<Parsed> => {
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      options: OPTIONS,
      allowPositionals: true,
    });
    const raw = RawSchema.safeParse(values);
    return raw.success
      ? { ok: true, value: { raw: raw.data, positionals } }
      : usageError(z.prettifyError(raw.error));
  } catch (error) {
    return usageError(error instanceof Error ? error.message : String(error));
  }
};

const SlotPolicySchema = z.object({
  AIDLC_GATE_SLOTS: z.coerce.number().int().positive().default(DEFAULT_SLOT_POLICY.slots),
  AIDLC_GATE_MIN_FREE_MB: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(DEFAULT_SLOT_POLICY.minFreeMb),
});

export const slotPolicyFrom = (
  environment: Readonly<Record<string, string | undefined>>,
): Loaded<SlotPolicy> => {
  const parsed = SlotPolicySchema.safeParse(environment);
  return parsed.success
    ? {
        ok: true,
        value: {
          slots: parsed.data.AIDLC_GATE_SLOTS,
          minFreeMb: parsed.data.AIDLC_GATE_MIN_FREE_MB,
        },
      }
    : {
        ok: false,
        problem: `the lock settings are not whole numbers: ${z.prettifyError(parsed.error)}`,
        fix:
          "Set AIDLC_GATE_SLOTS to 1 or more and AIDLC_GATE_MIN_FREE_MB to 0 or more, " +
          "or unset them.",
      };
};

const invalidSweep = (raw: Raw): boolean =>
  raw.sweep === true &&
  (!raw.full || raw.only !== undefined || raw["no-build"] || raw.record) === true;

export const gateRequestFrom = (
  argv: readonly string[],
  defaults: ArgumentDefaults,
): Loaded<GateRequest> => {
  const parsed = parsedArguments(argv);
  if (!parsed.ok || parsed.value.raw.help === true) {
    return parsed.ok ? { ok: true, value: { kind: "help" } } : parsed;
  }
  if (modeCount(parsed.value.raw) !== 1) {
    return usageError("pass exactly one of --scope, --full, --update-goldens or --locked");
  }
  const { raw } = parsed.value;
  if (invalidSweep(raw)) {
    return usageError("--sweep requires --full, every check, a build, and no --record");
  }
  const request = requestFor(parsed.value, defaults);
  return request.kind === "locked" && request.command.length === 0
    ? usageError("--locked needs a command after --")
    : { ok: true, value: request };
};
