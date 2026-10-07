---
id: framing-only
kind: deterministic
command: bun {{HARNESS_DIR}}/tools/aidlc-sensor-framing-only.ts
default_severity: blocking
fire_on: gate
description: Keeps Gate 2 free of code — refuses a fenced block tagged with a programming language in any of the gate's declared artefacts.
category: framing
matches: "**/intents/**"
input_schema:
  output_path: string
  stage_slug: string
output_schema:
  pass: boolean
  sensor: string
  verdict: string
  findings_count: integer
  findings: object[]
  scanned: string
timeout_seconds: 10
---

# framing-only sensor

Runs at Gate 2 (`rin-gate-2-plan-review`) only, on each of the gate's declared artefacts. Gate 2 compares solution shapes in prose and diagrams; code at that gate fixes a shape before the alternatives are compared.

## What it refuses

A fenced block whose tag is a programming language: `ts`, `typescript`, `tsx`, `js`, `javascript`, `jsx`, `mjs`, `cjs`, `mts`, `cts`, `python`, `py`, `go`, `golang`, `rust`, `rs`, `java`, `kotlin`, `kt`, `swift`, `c`, `cpp`, `c++`, `cs`, `csharp`, `c#`, `ruby`, `rb`, `php`, `scala`, `sql`, `graphql`, `gql`, `proto`, `protobuf`, `dart`, `elixir`, `erlang`, `haskell`, `ocaml`, `fsharp`, `clojure`, `lua`, `perl`, `r`, `objc`, `objective-c`, `zig`.

The tag is read case-insensitively, after stripping a leading pandoc-style `{` and `.`, up to its first `:`, `,`, `{` or `}`. So `ts:file.ts`, `ts,title=x`, `TS` and `{.ts}` are all `ts`. A fence is recognised when its opening marker is indented at most three spaces.

Every other fence is allowed: untagged, shell and text evidence, `mermaid`, `gherkin`, and data fences. Prose is not scanned. Whether a gate's prose, or an untagged, evidence or data fence, smuggles in a contract is the review board's judgement.

## Report

The sensor writes one JSON report. Its `verdict` is one of three values:

- `clean`: nothing to refuse.
- `refused`: the findings block approval.
- `unmeasured`: an input could not be read, the sensor ran at a gate other than its own, or it was invoked without `--stage` and `--output-path`. Each of the three causes carries its own remedy.

`pass` is true only for `clean`. Each finding carries `check`, `artefact`, `location` (either `{ kind: "line", lineNumber }` or `{ kind: "artefact" }`), `subject` and `remedy`.

## Blocking

Fires at the gate and blocks approval on any finding. An artefact it cannot read refuses as unmeasured rather than passing.
