import { ANY_DECLARATION, type HotFileGrant } from "./lane-plan.ts";
import type { Finding } from "./outcome.ts";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type JsonObject = { readonly [key: string]: JsonValue };

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameValue = (left: JsonValue | undefined, right: JsonValue | undefined): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const joinKey = (prefix: string, key: string): string => (prefix === "" ? key : `${prefix}.${key}`);

const changedKeyPaths = (request: {
  readonly base: JsonValue | undefined;
  readonly head: JsonValue | undefined;
  readonly prefix: string;
}): readonly string[] => {
  const { base, head, prefix } = request;
  if (!isObject(base) || !isObject(head)) {
    return sameValue(base, head) ? [] : [prefix];
  }
  const keys = [...new Set([...Object.keys(base), ...Object.keys(head)])];
  return keys.flatMap((key) =>
    changedKeyPaths({ base: base[key], head: head[key], prefix: joinKey(prefix, key) }),
  );
};

const covers = (granted: string, keyPath: string): boolean =>
  granted === ANY_DECLARATION || keyPath === granted || keyPath.startsWith(`${granted}.`);

export const judgeJsonGrant = (request: {
  readonly grant: HotFileGrant;
  readonly base: JsonValue;
  readonly head: JsonValue;
}): readonly Finding[] =>
  changedKeyPaths({ base: request.base, head: request.head, prefix: "" })
    .filter((keyPath) => !request.grant.keyPaths.some((granted) => covers(granted, keyPath)))
    .map((keyPath) => ({
      subject: `${request.grant.path} · ${keyPath}`,
      violation: `changed, but this lane's grant covers only ${request.grant.keyPaths.join(", ")}`,
      fix:
        "Revert this key. Ask on the board for the integration lane to change it, or ask " +
        "Lane 0 to widen the grant in lanes.json.",
    }));

export const grantsWholeFile = (grant: HotFileGrant): boolean =>
  grant.keyPaths.includes(ANY_DECLARATION);
