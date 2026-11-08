import { accepted, refused, type Result } from "../../kernel/result.ts";
import { CORE_GUARDS, type GuardDeclaration, type GuardId, type GuardInventory } from "./guard.ts";
import { reviewReceiptRule } from "./guard-rules.ts";
import { CORE_HOST_RULES, type HostGuardRules } from "./host-guard-rules.ts";

export type GuardInventoryRefusal = {
  readonly kind: "guard-declared-twice";
  readonly guard: GuardId;
};

export type ComposedGuards = {
  readonly inventory: GuardInventory;
  readonly host: HostGuardRules;
};

const CORE_INVENTORY: GuardInventory = [...Object.values(CORE_GUARDS), reviewReceiptRule.declaration];

const declaredTwice = (declarations: GuardInventory): GuardId | undefined =>
  declarations.find(
    (declaration, position) =>
      declarations.findIndex((other) => other.id === declaration.id) !== position,
  )?.id;

const declarationsOf = (rules: HostGuardRules): readonly GuardDeclaration[] =>
  [...rules["user-prompt"], ...rules["before-tool"], ...rules["subagent-stop"], ...rules.stop].map(
    (rule) => rule.declaration,
  );

const withContributed = (contributed: HostGuardRules): HostGuardRules => ({
  "user-prompt": [...CORE_HOST_RULES["user-prompt"], ...contributed["user-prompt"]],
  "before-tool": [...CORE_HOST_RULES["before-tool"], ...contributed["before-tool"]],
  "subagent-stop": [...CORE_HOST_RULES["subagent-stop"], ...contributed["subagent-stop"]],
  stop: [...CORE_HOST_RULES.stop, ...contributed.stop],
});

export const composeGuards = (
  contributed: HostGuardRules,
): Result<ComposedGuards, GuardInventoryRefusal> => {
  const inventory = [...CORE_INVENTORY, ...declarationsOf(contributed)];
  const twice = declaredTwice(inventory);
  return twice === undefined
    ? accepted({ inventory, host: withContributed(contributed) })
    : refused({ kind: "guard-declared-twice", guard: twice });
};
