/** The reader's public diagnostic carries identity separately from presentation. */
interface DependencyDiagnostic {
  readonly plugin: string;
  readonly text: string;
}

interface SelectionRefusal {
  readonly dependencies: readonly DependencyDiagnostic[];
  readonly paused: ReadonlyMap<string, string>;
  readonly entryInvocation: () => string;
}

/** Format only after the consumer has decided that dependency refusal is needed. */
export function formatSelectionRefusal(request: SelectionRefusal): string {
  const { dependencies, paused, entryInvocation } = request;
  const pausedWhy = [...paused]
    .filter(([plugin]) => dependencies.some((dependency) =>
      dependency.plugin === plugin || legacyLabelMentionsPlugin({ dependency, plugin })))
    .map(([plugin, base]) => `  ${plugin} would be paused: ${plugin} builds on ${base}, which this selection leaves off.\n`)
    .join("");
  return `select-plugins refused: the new selection would strand ${dependencies.length} active workflow dependency(ies):\n` +
    dependencies.map((dependency) => `  - ${dependency.text}`).join("\n") +
    (pausedWhy ? `\n${pausedWhy.trimEnd()}` : "") +
    `\nComplete or archive the workflow(s) first (\`${entryInvocation()} intent archive <name>\`; a parked workflow ` +
    "still needs its plugin when it resumes), or keep the plugin enabled, then re-run select-plugins.";
}

/**
 * Upstream also mentioned paused plugins quoted inside workflow/scope/stage
 * labels. Preserve that presentation quirk here, without making prose a domain
 * identity. Removing this fallback is a separately approved behavior change.
 */
function legacyLabelMentionsPlugin(request: {
  readonly dependency: DependencyDiagnostic;
  readonly plugin: string;
}): "mentioned" | undefined {
  return request.dependency.text.includes(`plugin "${request.plugin}"`) ? "mentioned" : undefined;
}
