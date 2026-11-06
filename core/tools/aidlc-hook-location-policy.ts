type HookLocationPlan =
  | Readonly<{ kind: "fixed"; path: string }>
  | Readonly<{ kind: "search"; candidates: readonly string[]; fallback: string }>;

/** Native hooks carry installed authority; only the customizable statusline searches project files. */
export function planHookLocation({ execution, hookFile, moduleHookPath, projectHookPaths, packagedHookPath }: {
  readonly execution: "native" | "copy";
  readonly hookFile: string;
  readonly moduleHookPath: string;
  readonly projectHookPaths: readonly string[];
  readonly packagedHookPath: string;
}): HookLocationPlan {
  if (execution === "native") {
    return hookFile === "aidlc-statusline.ts"
      ? { kind: "search", candidates: [...projectHookPaths, packagedHookPath], fallback: packagedHookPath }
      : { kind: "fixed", path: packagedHookPath };
  }
  return {
    kind: "search",
    candidates: [moduleHookPath, ...projectHookPaths, packagedHookPath],
    fallback: moduleHookPath,
  };
}
