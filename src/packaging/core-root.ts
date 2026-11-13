import { readBuildVersion } from "./adapters/legacy-channel.ts";
import { createLegacyPayloadMetadata } from "./adapters/legacy-payload-metadata.ts";
import { createVersionStamp } from "./adapters/legacy-version.ts";
import { createCopyEraHistory } from "./adapters/copy-era-history.ts";
import { createBuildPackagingUseCase, selectOnboardingPath } from "./application/build-packaging.ts";
import type { FileSystem } from "../kernel/file-system-port.ts";
import type { NativeCommandRoutes } from "../projection/domain/native-command.ts";
import { accepted } from "../kernel/result.ts";

import type { BuildPackaging, HostPayloadRequest } from "./application/ports.ts";
export type { BuildPackaging } from "./application/ports.ts";
export type PhaseOnePackagingRequest = HostPayloadRequest;
export type OnboardingSource = Parameters<typeof selectOnboardingPath>[0];

export const onboardingPathOf = (request: OnboardingSource) => selectOnboardingPath(request);

export const createBuildPackaging = (binding: {
  readonly routes: NativeCommandRoutes;
  readonly historyReader: Pick<FileSystem, "readFile">;
  readonly copyEraSource: URL;
}, readVersion = readBuildVersion): BuildPackaging => {
  const captured = readVersion();
  const history = createCopyEraHistory({ reader: binding.historyReader, source: binding.copyEraSource,
    prior: { history: async () => accepted({ retiredFiles: [], priorIntegrations: [] }) } });
  return createBuildPackagingUseCase({ version: captured, stamp: createVersionStamp(captured),
    routes: binding.routes, history, metadata: { forHost: createLegacyPayloadMetadata } });
};
