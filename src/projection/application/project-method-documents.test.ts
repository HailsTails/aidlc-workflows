import { expect, mock, test } from "bun:test";
import { accepted, refused } from "../../kernel/result.ts";
import { host, path } from "../../kernel/fixtures/values.fixture.ts";
import { methodSliceFixture } from "../../workflow-definition/fixtures/method.fixture.ts";
import { ONBOARDING_TEMPLATES_FIXTURE, documentRenderingInputsFixture,
  conductorDocumentFixture } from "../fixtures/document-rendering.fixture.ts";
import type { ProjectedFile } from "../domain/projected-file.ts";
import { projectMethodDocuments } from "./project-method-documents.ts";

const onboarding: ProjectedFile = { path: path(".fixture/ONBOARDING.md"), mode: "regular", availability: "always",
  content: { kind: "text", text: "Onboarding" },
  origin: { kind: "rendered", concept: "onboarding", name: "ONBOARDING.md" } };
const document: ProjectedFile = { path: path(".fixture/conductor.md"), mode: "regular", availability: "always",
  content: { kind: "text", text: "Conductor" }, origin: { kind: "neutral", source: conductorDocumentFixture.source } };
const request = { host: host({ name: "fixture", directory: ".fixture" }), method: methodSliceFixture,
  surface: { documents: [conductorDocumentFixture], skills: [], onboarding: ONBOARDING_TEMPLATES_FIXTURE },
  ...documentRenderingInputsFixture({ harnessDir: ".fixture" }) };

test("one document factory receives the inputs and renders onboarding before the captured documents", () => {
  const renderOnboarding = mock(() => accepted([onboarding]));
  const placeNeutralDocument = mock(() => accepted([document]));
  const render = mock(() => ({ renderOnboarding, placeNeutralDocument }));
  expect(projectMethodDocuments({ ...request, render })).toEqual(accepted([onboarding, document]));
  expect(render).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledWith({ fills: request.fills, tokens: request.tokens });
  expect(renderOnboarding).toHaveBeenCalledWith({ templates: ONBOARDING_TEMPLATES_FIXTURE, method: request.method });
  expect(placeNeutralDocument).toHaveBeenCalledWith({ document: conductorDocumentFixture });
});

test("the existing collection owner refuses collisions between onboarding and placed documents", () => {
  expect(projectMethodDocuments({ ...request, render: () => ({
    renderOnboarding: () => accepted([onboarding]),
    placeNeutralDocument: () => accepted([{ ...document, path: onboarding.path }]),
  }) })).toEqual(refused({ kind: "path-collision", path: onboarding.path,
    origins: [onboarding.origin, document.origin] }));
});

test("onboarding refusal wins over a later document refusal without accepting partial output", () => {
  expect(projectMethodDocuments({ ...request, render: () => ({
    renderOnboarding: () => refused({ kind: "render-failed", concept: "onboarding", name: "ONBOARDING.md", reason: "first" }),
    placeNeutralDocument: () => refused({ kind: "render-failed", concept: "neutral-document", name: "conductor.md", reason: "second" }),
  }) })).toEqual(refused({ kind: "render-failed", concept: "onboarding", name: "ONBOARDING.md", reason: "first" }));
});
