import type { HostIdentity } from "../../kernel/host.ts";
import type { AuthoredPlacement } from "../domain/host-surface.ts";
import type { NativeCommandRoutes } from "../domain/native-command.ts";
import type { DistributionChannel } from "../domain/projected-file.ts";
import type { TokenBindings } from "../domain/template-token.ts";
import type { AuthoredFilePreparer } from "./ports/host-sources.ts";
import { captureAdapterScript, renderAdapterScript } from "../domain/adapter-script-source.ts";
import { bindCopiedSource } from "../domain/source-binding.ts";
import { prepareHostSource } from "./prepared-host-source.ts";

export const createCapturedHostSourcePreparation = (request: {
  readonly host: HostIdentity;
  readonly placements: readonly AuthoredPlacement[];
  readonly channel: DistributionChannel;
  readonly commands: NativeCommandRoutes;
  readonly tokens: TokenBindings;
}): AuthoredFilePreparer => file => prepareHostSource({ host: request.host, file, steps: [
  content => request.placements.some(placement => placement.source === file.source
    && placement.sourceRole === "host-adapter-script")
    ? renderAdapterScript({ script: captureAdapterScript({ host: request.host, source: file.source, content }),
      channel: request.channel, commands: request.commands }) : content,
  content => bindCopiedSource({ source: file.source, content, tokens: request.tokens }),
] });
