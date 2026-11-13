import { accepted, refused } from "../../kernel/result.ts";
import type { ProjectionRefusal } from "../domain/projection.ts";
import type { PluginProjector, PluginProjectionRequest, PluginCatalogueRequest } from "../application/ports/plugins.ts";

export const createRecordingPluginProjector = (responses: {
  readonly projectionFailure?: ProjectionRefusal; readonly catalogueFailure?: ProjectionRefusal;
  readonly catalogues?: readonly string[];
} = {}) => {
  const projections: PluginProjectionRequest[] = [];
  const catalogues: PluginCatalogueRequest[] = [];
  const projector: PluginProjector = {
    project: (request) => {
      projections.push(request);
      return responses.projectionFailure ? refused(responses.projectionFailure) : accepted(request.output);
    },
    writeCatalogues: (request) => {
      catalogues.push(request);
      return responses.catalogueFailure ? refused(responses.catalogueFailure) : accepted(responses.catalogues ?? []);
    },
  };
  return { ...projector, projections: (): readonly PluginProjectionRequest[] => projections,
    catalogues: (): readonly PluginCatalogueRequest[] => catalogues };
};
