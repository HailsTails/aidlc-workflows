import { accepted, refused, type Result } from "../../kernel/result.ts";
import type { Method } from "../../workflow-definition/domain/method.ts";
import { METHOD_SOURCE_FOLDERS, type MethodSource } from "../../workflow-definition/domain/method-source.ts";
import type { CommandSubject } from "../domain/native-command.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";

type LegacyDocumentSelection = {
  readonly skill: string;
  readonly companions: readonly { readonly path: string; readonly within: string }[];
};

const pathSegments = (path: string): readonly string[] => path.split(/[\\/]/);

export const captureCommandScopes = (request: {
  readonly method: Method;
  readonly sources: readonly MethodSource[];
}): Result<readonly MethodSource[], ProjectionRefusal> => {
  const captured = request.method.scopes.map((scope): Result<MethodSource, ProjectionRefusal> => {
    const source = request.sources.find((candidate) => candidate.path === scope.source
      && candidate.owner.kind === scope.owner.kind && (candidate.owner.kind !== "plugin"
        || (scope.owner.kind === "plugin" && candidate.owner.plugin === scope.owner.plugin)));
    return source && source.path.startsWith(`${METHOD_SOURCE_FOLDERS.scope}/`) ? accepted(source)
      : refused({ kind: "render-failed", concept: "scope-command", name: scope.name,
        reason: "The accepted scope source was not captured." });
  });
  const broken = captured.find((entry) => !entry.ok);
  return broken && !broken.ok ? broken : accepted(captured.flatMap((entry) => entry.ok ? [entry.value] : []));
};

export const selectedScopeDescription = (request: {
  readonly name: string;
  readonly selected: readonly string[];
  readonly scopes: Readonly<Record<string, { readonly description: string }>>;
}): Result<string | null, string> => {
  if (!request.selected.includes(request.name)) return accepted(null);
  const scope = request.scopes[request.name];
  return scope ? accepted(scope.description) : refused(`The selected frozen scope is absent: ${request.name}`);
};

export const duplicateNativeCommand = (commands: readonly {
  readonly subject: { readonly concept: CommandSubject["concept"]; readonly name: string };
  readonly nativeName: string | null;
}[]) => {
  const collision = commands.find((command, index) => command.nativeName !== null
    && commands.findIndex((other) => other.nativeName === command.nativeName) < index);
  return collision ? { subject: collision.subject, files: null,
    reason: `Two frozen commands share the native destination: ${collision.nativeName}` } : null;
};

export const selectLegacyDocuments = (request: {
  readonly nativeName: string;
  readonly paths: readonly string[];
}): Result<LegacyDocumentSelection, string> => {
  const skills = request.paths.filter((path) => {
    const segments = pathSegments(path);
    return segments.at(-1) === "SKILL.md" && segments.at(-2) === request.nativeName;
  });
  const skill = skills[0];
  if (skills.length !== 1 || !skill) {
    return refused("The frozen output must contain exactly one directory for this native name.");
  }
  const directory = pathSegments(skill).slice(0, -1).join("/");
  const prefix = `${directory}/`;
  return accepted({ skill, companions: request.paths.filter((path) =>
    path !== skill && pathSegments(path).join("/").startsWith(prefix)).map((path) =>
    ({ path, within: pathSegments(path).join("/").slice(prefix.length) })) });
};
