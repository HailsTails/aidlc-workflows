import type { NativeCommandRoutes } from "../../projection/domain/native-command.ts";
import type { HostIdentity } from "../../kernel/host.ts";
import { channelTokens } from "./channel-tokens.ts";

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const nativeBareToolPattern = (routes: NativeCommandRoutes): RegExp => new RegExp(
  String.raw`\bbun\s+aidlc-(${routes.delegates.map(escapeRegExp).join("|")})\.ts`, "gi",
);

const nativeInvocationTokens = ({ text, host, routes }: {
  readonly text: string; readonly host: HostIdentity; readonly routes: NativeCommandRoutes;
}): string => {
  const bindings = channelTokens({ channel: "native", directory: host.directory, prefix: routes.prefix,
    namespace: routes.namespace });
  return text.replace(/\{\{INVOKE\}\}/g, bindings.INVOKE)
    .replace(/\{\{TOOL_PREFIX\}\}/g, bindings.TOOL_PREFIX)
    .replace(/\{\{TRUSTED_NAMESPACE\}\}/g, bindings.TRUSTED_NAMESPACE);
};

type NativeInvocationRequest = {
  readonly text: string;
  readonly host: HostIdentity;
  readonly routes: NativeCommandRoutes;
};

const PROJECT_PREFIX = String.raw`(?:"?(?:\$\{?CLAUDE_PROJECT_DIR\}?/)?`;
const OPTIONAL_QUOTE = `"?)`;

const escapedProjectInvocations = (request: NativeInvocationRequest): string => {
  const { host, routes } = request;
  const harnessDir = escapeRegExp(host.directory);
  let projectedText = request.text;
  const escapedJsonDispatcher = new RegExp(
    String.raw`\bbun\s+\\"\$CLAUDE_PROJECT_DIR/${harnessDir}/tools/aidlc\.ts\\"`,
    "gi",
  );
  projectedText = projectedText.replace(escapedJsonDispatcher, "aidlc");
  const escapedJsonHook = new RegExp(
    String.raw`\bbun\s+\\"\$CLAUDE_PROJECT_DIR/${harnessDir}/hooks/aidlc-([a-z0-9-]+)\.ts\\"`,
    "gi",
  );
  projectedText = projectedText.replace(escapedJsonHook, (_match, hook: string) => {
    if (routes.adapterHooks.has(hook)) return routes.trusted(`adapter ${host.distribution}`);
    return hook === "statusline"
      ? routes.trusted("statusline")
      : routes.trusted(`hook ${hook}`);
  });
  return projectedText;
};

const utilityInvocations = (request: NativeInvocationRequest): string => {
  const { host, routes } = request;
  const harnessDir = escapeRegExp(host.directory);
  let projectedText = request.text;
  const workspaceUtilityPattern = new RegExp(
    String.raw`\bbun\s+${PROJECT_PREFIX}${harnessDir}/tools/aidlc-utility\.ts${OPTIONAL_QUOTE}\s+(codekb-path|codekb-scope-diff|codekb-snapshot|codekb-publish|project-description|document-input)\b`,
    "gi",
  );
  projectedText = projectedText.replace(
    workspaceUtilityPattern,
    (_match, verb: string) =>
      `${routes.trusted("workspace")} ${verb === "codekb-path" ? "codekb" : verb}`,
  );
  const configUtilityPattern = new RegExp(
    String.raw`\bbun\s+${PROJECT_PREFIX}${harnessDir}/tools/aidlc-utility\.ts${OPTIONAL_QUOTE}\s+config-change\s+--(depth|test-strategy|review|guard-policy|change-control|sensors|learnings|summary-confirmation|guard\.(?:plan-approval|review-freeze|state-transition|reviewer-scope))\b`,
    "gi",
  );
  projectedText = projectedText.replace(
    configUtilityPattern,
    (_match, key: string) => routes.trusted(`config set ${key}`),
  );
  return projectedText;
};

export const nativeInvocationText = (request: NativeInvocationRequest): string => {
  const { host, routes } = request;
  const harnessDir = escapeRegExp(host.directory);

  const toolPattern = new RegExp(
    String.raw`\bbun\s+${PROJECT_PREFIX}${harnessDir}/tools/aidlc(?:-([a-z0-9-]+))?\.ts${OPTIONAL_QUOTE}`,
    "gi",
  );
  const hookPattern = new RegExp(
    String.raw`\bbun\s+${PROJECT_PREFIX}${harnessDir}/hooks/aidlc-([a-z0-9-]+)\.ts${OPTIONAL_QUOTE}`,
    "gi",
  );
  const bareToolPattern = nativeBareToolPattern(routes);
  let projectedText = utilityInvocations({ ...request, text: escapedProjectInvocations(request) });
  projectedText = projectedText.replace(toolPattern, (_match, delegate: string | undefined) =>
    delegate ? routes.trusted(delegate) : routes.prefix
  );
  projectedText = projectedText.replace(
    bareToolPattern,
    (_match, delegate: string) => routes.trusted(delegate),
  );
  projectedText = projectedText.replace(hookPattern, (_match, hook: string) => {
    if (routes.adapterHooks.has(hook)) return routes.trusted(`adapter ${host.distribution}`);
    if (hook === "statusline") return routes.trusted("statusline");
    return routes.trusted(`hook ${hook}`);
  });
  projectedText = projectedText.replaceAll(
    `"bun \\\\${host.directory}/tools/.*"`,
    `"${routes.trusted(".*")}"`,
  );
  projectedText = projectedText.replaceAll(
    `"bun \\\\$\\\\{?KIRO_PROJECT_DIR\\\\}?/${host.directory}/tools/.*"`,
    `"${routes.trusted(".*")}"`,
  );
  projectedText = nativeInvocationTokens({ text: projectedText, host, routes });

  return projectedText;
};
