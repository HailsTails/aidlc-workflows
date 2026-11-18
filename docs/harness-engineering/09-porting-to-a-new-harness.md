# Porting AI-DLC to a New Harness

AI-DLC builds one harness-neutral `core/` for several host tools. A new build
host supplies a **`HostModule` in `src/hosts/<name>/host.ts`**, authored files
under `harness/<name>/`, and one registration in `src/cli/host-table.ts`.
The build root consumes that module's identity, projection members and
distribution reader. Creating a `manifest.ts` does not register a host.

The executable example is
[`src/cli/eighth-host.test.ts`](../../src/cli/eighth-host.test.ts). It passes a
scratch `HostModule` to `createPackageBuildRoot({ hosts: [SCRATCH_MODULE], ... })`
and projects agents, host data, the orchestrator skill, settings and onboarding
through the real root. Its platform capabilities are fakes; the test does not
prove a new tool's live hooks, installer or runtime integration.

> “Harness” also names this Harness Engineer Guide and the unrelated
> `tests/harness/` test helpers. Here it means a host tool's AI-DLC distribution.

## The shape

```text
core/                         # shared methodology, runtime and neutral documents
src/hosts/<name>/
  host.ts                     # admits and composes the HostModule
  host-data.ts                # identity, host facts, token choices, authored placements
  distribution.ts             # layout, root ownership, listing and release/plugin facts
  onboarding-fills.ts         # this host's onboarding substitutions
  projection/                 # native agents, commands, skills, settings and documents
harness/<name>/               # authored host documents, adapters and config templates
src/cli/
  host-table.ts               # the registered module factories and resulting HOSTS list
  main.ts                     # constructs platform implementers and opens the root
  package-build-root.ts       # captures inputs and assembles host renderers
  roots.ts                    # HostModule and package-root contracts
scripts/package.ts            # current build entry

dist/<name>/                  # generated copy/Bun channel
dist-release/<name>/          # generated native-aidlc channel
```

`harness/*/manifest.ts`, retained emitters and `scripts/manifest-types.ts` are
legacy surfaces still present during the refactor. They are not the new-host
extension point. Do not add a new emitter or expand `EmitContext` to register
another concept.

## Step 1 - compose and register the host module

Read [`HostModule`](../../src/cli/roots.ts) and
[`HostProjectionParts`](../../src/projection/application/ports/host-parts.ts),
then follow [`claudeHost`](../../src/hosts/claude/host.ts) or another landed
host with the output format you need. The current module has four members:

```ts
export type HostModule = {
  readonly host: HostIdentity;
  readonly projection: HostProjectionParts;
  readonly distribution: HostDistributionReader;
  readonly routes: HostRoutes;
};
```

`routes` declares the host's utility commands using the terminal, settings
capabilities and copy-channel tokens supplied by the root. Return an empty
list when the host has no utility commands; keep host-specific parsing in the
host folder. See [`codexTrustRoutes`](../../src/hosts/codex/trust-route.ts).

Declare the `HostIdentity` once: its branded distribution id and
project-relative directory, for example a new id with `.example` as its
installed folder. Admit paths with the existing kernel constructors and return
refusals from invalid declarations. Reuse the same identity in projection and
distribution; do not create a second list of host directories.

Compose the following projection members in the host's factory:

| Member | What the host supplies |
| --- | --- |
| `tokens` | `HostTokenChoices`: the host's skill invocation and question-option range |
| `renderData` | The host's metadata renderer, using injected policy where required |
| `placements` | Authored source/destination pairs for files placed without a concept renderer |
| `agents` | Declared authored `inputs` and the native agent renderer, including its conductor surface |
| `commands` | Native command-file placement; shared command production remains one owner |
| `skills` | Declared authored `inputs` and the orchestrator/session-skill renderer |
| `settings` | Declared authored `inputs` and the settings/hook-registration renderer |
| `documents` | Declared authored `inputs` and the onboarding/neutral-document renderer |
| `fills` | Host-specific onboarding substitutions |
| `bindingHeading` | The host's heading in authored protocol binding subsections |
| `derive`, when needed | The existing typed derivation seam for files computed from projected files |

`ConceptMembers<Render>` contains `inputs: readonly SourcePath[]` and `render`.
List the authored files a renderer needs there, relative to `harness/<name>/`;
use `authoredSourcePaths` to admit literal paths. Keep ordinary copied files in
`placements`. The root captures declared sources and passes them to the
renderers. A renderer does not reread the repository or construct a real file
system, parser or child process. Pass captured bytes and compiled `Method`
facts through the published ports; keep neutral source capture, table
formatting, collision handling and output writing with their existing owners.

Register the admitted factory in
[`src/cli/host-table.ts`](../../src/cli/host-table.ts)'s `BUILT` list. The table
collects successful modules into `HOSTS` and failures into
`HOST_BUILD_REFUSALS`; preserve that refusal handling. `openPackageBuildRoot`
in `main.ts` supplies `HOSTS` to the package root. Its default build route
selects and sorts the registered host identities, rather than scanning
`harness/`. The root derives protocol binding headings from the same
modules; do not maintain another `BINDING_HEADINGS` list.

The eighth-host test deliberately supplies its module directly to the root,
so it needs no edit to the production table or to shared workflow policy.
A real distribution needs the production registration as well as its own
source files. Coordinate changes to the shared table with its current owner.

## Step 2 - declare distribution ownership

The module's `distribution` reader returns a `HostDistribution`, as
[`claudeDistribution`](../../src/hosts/claude/distribution.ts) demonstrates:

- `layout` declares managed directories and project-root integrations.
- `priorIntegrations` declares exact old signatures used to adopt or retire
  previously shipped content.
- `listing` declares install-menu and first-run guidance.
- `native` declares the release-channel facts used by the current Packaging
  path, including copy-only files and any retained exact replacements.
- `plugin` declares the plugin format, metadata/catalogue directories and
  install roots.

Every emitted top-level path needs declared ownership. Root integrations use
`managed-block`, `whole-file`, `json-map`, `json-array`, `jsonc-settings` or
`json-entries`, with the marker/key, sharing and presence required by that
policy. Shared managed blocks can use `sharing: "union"`; byte-identical
content can use `"identical"`. Do not replace a person's whole settings file
when the declared integration owns only selected entries.

Keep host facts such as `productName`, `configNextStep`, `rulesFolder`, hook
activation guidance, status-line shape and native agent frontmatter with the
host's data/rendering owner. Keep the installation layout and old adoption
hashes with `distribution`. Neither belongs in another generic manifest bag.
The build writes `harness.json`, the version stamp and the install descriptor
through their existing owners; do not add a second metadata writer.

## Step 3 - render both invocation channels

Core prose uses `{{HARNESS_DIR}}`, `{{INVOKE}}`, `{{TOOL_PREFIX}}` and the other
published template tokens. Host token choices describe the host; channel
policy supplies the invocation:

| Channel | `{{INVOKE}}` | `{{TOOL_PREFIX}}` |
| --- | --- | --- |
| Copy (`dist/`) | `bun <harness-dir>/tools/aidlc.ts` | `bun <harness-dir>/tools/` |
| Native (`dist-release/`) | `aidlc` | `aidlc ` |

Use the channel bindings supplied by the root. Native renderers own the
host-specific JSON/TOML/Markdown shape and permission syntax. Reuse the existing
permission, trust and formatting ports rather than copying their policy into
the host. Preserve literal binary sidecars and already-rendered final bytes;
do not apply token substitution a second time to the whole output.

Permitted transforms are the harness/rules projection, the invocation tokens,
and declared tier/frontmatter additions. Each host renderer owns its native
permission syntax. Packaging applies the shared native layout through
`nativeLayoutFiles` before hashing the payload: declared replacements and
copy-only exclusions, command routes and onboarding runtime text. It refuses
surviving tokens or Bun invocations into an AIDLC tool/hook. Both channels are
written through `writePayloadTree`; no native rewrite runs over the written
tree. No blind `sed`. Truthful harness-specific literals in `core/` (the
`$CLAUDE_PROJECT_DIR` note, the harness-dir enumeration in
workspace-detection) carry no token and pass through unchanged; the core-hygiene
and native-projection tests guard the boundary.

The root assembles the module's concept renderers into Projection's `Harness`.
A host does not implement a parallel `ProjectMethodForHarness`, copy the
neutral runtime itself, or add a host-name switch to a shared use case.
Native command placement and session-skill placement are independent facts;
a legacy producer flag such as `skipRunnerGen` is not a skills-location rule.

Protocol binding subsections remain authored in the shared protocol documents.
Use the module's `bindingHeading` for its own subsection and verify the
resulting document bytes. Registering the module supplies its heading to the
shared selection owner; it does not author the subsection for you.

## Step 4 - connect the host's hooks and runtime

A build-module registration proves projection, not a complete runtime port.
The retained runtime still has host-specific model, CLI-probe, event and doctor
handling under `core/tools/`. Check the relevant existing handlers and tests
for the new tool's real behavior. Do not infer runtime support from a passing
projection fixture or add shared build policy just to satisfy a legacy list.

Where the host needs an adapter, keep it under `harness/<name>/hooks/` and
capture/place it through the host's declared inputs. Reuse the common hook
consumers; the adapter translates the host's payload and control channels.
The native settings renderer owns the host's registration format. Register
only events with an actual common consumer.

The Stop hook's stdout block decision, delegated-prompt rewriting and the
pre-tool guards' refusal exit codes must reach the host intact. A tool that
cannot block a call at its pre-tool seam needs that limitation documented;
registering an ineffective guard does not supply the capability. Where event
payloads omit subagent identity, use a supported scoped registration or the
existing dispatch-record mechanism, rather than guessing an identity.

Declare first-run and recovery instructions in the host's own words. Check
whether its hooks require a restart, a trust decision or a picker choice, and
whether its CLI and editor share an installed tree. Hook activation, native
command trust, model handling and doctor behavior need their own observable
tests and, where available, a live journey in the real tool.

## Step 5 - verify the port

Start with the existing registration test:

```sh
bun test src/cli/eighth-host.test.ts
```

It exercises the actual package-root assembly with an injected module and
checks that the expected concept files exist and every output lies under the
host's own directory or the neutral `aidlc/` path. It does not compile a native
binary, run live hooks, exercise installation, or certify every renderer's
bytes. Add literal tests beside the new host's renderers for those shapes,
channel differences and refusals, using captured inputs and capability fakes.

For a registered production host, the current package commands are:

```sh
bun scripts/package.ts <name>
bun scripts/package.ts <name> --check
```

The first materializes its copy and native trees. `--check` builds two
independent temporary output sets and compares their bytes; it does not compare
the checkout's existing `dist/` trees. Plugin projections participate in that
check as well. Use the repository's scoped gate for the final change and its
normal resource admission, including both output and install-lifecycle golden
checks. Do not replace expected output merely to make a new renderer pass.

Keep hook-adapter contract tests and the real-tool journey separate from
projection proof. See [Testing](../reference/09-testing.md) for the repository
runner and live-test prerequisites.

## Next

- [Harness Engineer Guide overview](00-overview.md).
- Add a user-facing host chapter beside
  [Running on other harnesses](../guide/harnesses/README.md).
- The current registration contracts are
  [`src/cli/roots.ts`](../../src/cli/roots.ts) and
  [`HostProjectionParts`](../../src/projection/application/ports/host-parts.ts).
- [Architecture](../reference/01-architecture.md) describes the wider build and
  runtime boundary; use the executable eighth-host test for registration proof.
