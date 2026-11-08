import { accepted, refused, type Result } from "../../kernel/result.ts";
import {
  CORE_GUARDS,
  type GuardDeclaration,
  type GuardId,
  type GuardInventory,
} from "./guard.ts";

export type GuardInventoryRefusal = {
  readonly kind: "guard-declared-twice";
  readonly guard: GuardId;
};

const CORE_INVENTORY: GuardInventory = Object.values(CORE_GUARDS);

const declaredTwice = (declarations: GuardInventory): GuardId | undefined =>
  declarations.find(
    (declaration, position) =>
      declarations.findIndex((other) => other.id === declaration.id) !== position,
  )?.id;

export const guardInventory = (
  contributed: readonly GuardDeclaration[],
): Result<GuardInventory, GuardInventoryRefusal> => {
  const declarations = [...CORE_INVENTORY, ...contributed];
  const twice = declaredTwice(declarations);
  return twice === undefined
    ? accepted(declarations)
    : refused({ kind: "guard-declared-twice", guard: twice });
};
