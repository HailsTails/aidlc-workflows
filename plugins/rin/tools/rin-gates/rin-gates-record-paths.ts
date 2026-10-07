import { GATE_PHASES, type GateSlug } from "./rin-gate-namespace.ts";

const OPTIONS_LEDGER_FILE = "rin-solution-options.md";
const FACTS_FILE = "facts.md";
const GATE_TWO_STAGE: GateSlug = "rin-gate-2-plan-review";
const GATE_THREE_STAGE: GateSlug = "rin-gate-3-interface-lock";

const optionsLedgerPathFor = ({
  recordDirectory,
}: {
  readonly recordDirectory: string;
}): string =>
  `${recordDirectory}/${GATE_PHASES[GATE_TWO_STAGE]}/${GATE_TWO_STAGE}/${OPTIONS_LEDGER_FILE}`;

const factsPathFor = ({
  recordDirectory,
}: {
  readonly recordDirectory: string;
}): string => `${recordDirectory}/${FACTS_FILE}`;

export {
  FACTS_FILE,
  factsPathFor,
  GATE_THREE_STAGE,
  GATE_TWO_STAGE,
  OPTIONS_LEDGER_FILE,
  optionsLedgerPathFor,
};
