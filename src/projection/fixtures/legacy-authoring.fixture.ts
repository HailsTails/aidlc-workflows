import type { HostIdentity } from "../../kernel/host.ts";
import { host, path } from "../../kernel/fixtures/values.fixture.ts";
import type { NativeCommandRoutes } from "../domain/native-command.ts";
import type { NativePermissionPolicy } from "../domain/onboarding-context.ts";
import type { ProjectedFile } from "../domain/projected-file.ts";
import { declareLegacyProducedFile, compiledLegacyNativeFile } from "../domain/legacy-native-source.ts";
import { nativeLayoutFiles } from "../../packaging/application/native-layout.ts";

// Explicit authoring fixture: its caller supplies original source literals, not a production Projection to repair.
export const nativeLayoutFromAuthoredFixture = (request: Parameters<typeof nativeLayoutFiles>[0]) => {
  const context = { host: request.host, commands: request.routes, permissions: request.release.permissions,
    replacements: request.release.replacements };
  const files = request.files.map((file): ProjectedFile => {
    if (file.nativeAuthoring !== undefined) return file;
    const origin = file.origin.kind === "root-history" || file.origin.kind === "native-policy" ? file.origin.source : file.origin;
    return { ...declareLegacyProducedFile({ context, file: { ...file, origin } }), origin: file.origin };
  });
  return nativeLayoutFiles({ ...request, files });
};

const sourceText = (request: { readonly text: string; readonly host: HostIdentity;
  readonly routes: NativeCommandRoutes; readonly permissions: NativePermissionPolicy }): string => {
  const file = declareLegacyProducedFile({ context: { host: request.host, commands: request.routes,
    permissions: request.permissions, replacements: [] }, file: { path: path(`${request.host.directory}/example.md`),
    mode: "regular", content: { kind: "text", text: request.text },
    origin: { kind: "rendered", concept: "onboarding", name: "literal authoring fixture" } } });
  const content = compiledLegacyNativeFile(file)?.content;
  if (content?.kind !== "text") throw new Error("The literal source fixture must compile as native text.");
  return content.text;
};

export const legacyInvocationSourceFixture = (request: {
  readonly text: string; readonly host: HostIdentity; readonly routes: NativeCommandRoutes;
}): string => sourceText({ ...request, permissions: { kind: "authored" } });

export const legacyOnboardingSourceFixture = (request: {
  readonly text: string; readonly prefix: string; readonly permissions: NativePermissionPolicy;
}): string => sourceText({ ...request, host: host({ name: "fixture", directory: ".fixture" }),
  routes: { prefix: request.prefix, namespace: "engine", delegates: [], adapterHooks: new Set(),
    trusted: suffix => `${request.prefix} ${suffix}`, unresolvable: () => [] } });
