import type { TransactionOperation } from "./aidlc-transaction.ts";

export const refreshPath = (path: string, caseInsensitive: boolean): string => {
  const parts = path.replaceAll("\\", "/").split("/");
  if (/^(?:[\\/]|[A-Za-z]:)/.test(path) || parts.includes("..")) throw new Error(`refresh path must remain below its root: ${path}`);
  const normalized = parts.filter((part) => part !== "." && part !== "").join("/");
  if (!normalized) throw new Error("refresh path must name an entry below its root");
  return caseInsensitive ? normalized.toLowerCase() : normalized;
};

export type ResultingFile =
  | { readonly kind: "retained" }
  | { readonly kind: "operation"; readonly operation: TransactionOperation; readonly suffix: string }
  | { readonly kind: "unproved" };

export const resultingFile = (args: { readonly path: string; readonly operations: readonly TransactionOperation[]; readonly caseInsensitive: boolean }): ResultingFile => {
  const target = refreshPath(args.path, args.caseInsensitive);
  const related = args.operations.filter((operation) => {
    const path = refreshPath(operation.path, args.caseInsensitive);
    return target === path || target.startsWith(`${path}/`) || path.startsWith(`${target}/`);
  });
  if (related.length === 0) return { kind: "retained" };
  if (related.length !== 1) return { kind: "unproved" };
  const operation = related[0];
  const path = refreshPath(operation.path, args.caseInsensitive);
  const suffix = target === path ? "" : target.startsWith(`${path}/`) ? args.path.replaceAll("\\", "/").split("/").filter((part) => part !== "." && part !== "").slice(path.split("/").length).join("/") : null;
  if (suffix === null || (suffix !== "" && operation.kind !== "tree" && operation.kind !== "remove")) return { kind: "unproved" };
  return { kind: "operation", operation, suffix };
};

export const mutatesWorkflowWorkspace = (args: { readonly operations: readonly TransactionOperation[]; readonly caseInsensitive: boolean }): boolean =>
  args.operations.some((operation) => {
    const path = refreshPath(operation.path, args.caseInsensitive);
    return path === "aidlc" || path.startsWith("aidlc/");
  });

export const refreshOperationsOverlap = (args: { readonly operations: readonly TransactionOperation[]; readonly caseInsensitive: boolean }): boolean => {
  const paths = args.operations.map((operation) => refreshPath(operation.path, args.caseInsensitive));
  return paths.some((left, index) => paths.some((right, other) => other > index && (left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`))));
};
