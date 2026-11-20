# Manual milestone slow checks

This fork-only lane exists for an important, named unblock, not routine PR
feedback. `.github/workflows/milestone-slow-checks.yml` has only
`workflow_dispatch`. It has no push, PR, schedule, workflow-call, release or
workflow-run trigger, and does not dispatch any other workflow.

## Scope and cost

One standard `ubuntu-24.04` GitHub-hosted job runs at a time. There is no matrix,
larger runner, self-hosted runner, model credential, AWS role, deployment,
artifact upload or cache upload. The token has only `contents: read` and checkout
does not persist it. The job refuses other repositories, a private fork, or a
controller selected from anywhere except `main` before allocating its runner.

GitHub documents standard hosted runners for public repositories as free. For
this public fork the expected incremental Actions compute charge is **US$0**.
This is not an inspection of Helen's billing ledger or proof about other repos.
If visibility, runner class or paid services change, review cost and permission
again. No billing cap, repository permission or secret is changed by this lane.

The job has a hard 175-minute ceiling, including setup and reporting. Its suite
step has 145 minutes, and the existing runner has an 8100-second (135-minute)
work limit and zero file retries. A timeout or missing summary is not a pass.
These are ceilings, not a measured completion estimate. A second manually
requested run queues; it does not cancel the running evidence. Do not dispatch
redundant attempts or an automatic baseline comparison.

## Exact source and qualification

Supply the full immutable source SHA and the milestone/question being unblocked.
The controller checks out that SHA, not its own `main` commit, verifies a clean
tracked tree, and records the source tree and hashes of the existing runner,
worker, packager, sanitizer and lockfile. It uses Bun 1.4.4, Linux Bash and the
existing tmux/zsh substrates. It does not patch the candidate or substitute a
new test runner. The existing runner builds its projections normally.

The fixed command is:

```sh
bun tests/run-tests.ts --no-llm --parallel 4 --verbose --file-retries 0 --run-timeout 8100
```

The candidate's no-tier-flag default selects smoke, unit and integration, with
fixture guard policy. It is not `--all`, deterministic E2E, production-guard
CI, lint/typecheck/determinism qualification, live-model acceptance, another
platform's result, release qualification, or an upstream submission. Preserve
all reported capability exclusions and skipped assertions. No filters or added
exclusions are supplied by this workflow. Read and report the runner's final
summary, not just the green Actions conclusion.

This Linux evidence is distinct from the previously parked Q23 Windows run.
That run could not keep every fixture off C:\Windows\Temp under its unchanged
candidate runner. A hosted Linux run does not prove that Windows behavior fixed
and does not inherit local gate-wrapper qualification.

Initial candidate: `0a2b495442b591ee014ffa13060d49303d5cd28d`, fork branch
`refactor/build-agent-facts-single-owner`. Its upstream baseline is
`caea995aeb8e6fb7284029429e48058b63c7093b`. Each requires a separate, deliberate
run if a same-environment comparison is needed. Do not transfer evidence from
the rebuild PR #129 to either commit.

## Enable and operate

1. Review and adopt only this workflow and this documentation on the fork's
   default `main` branch. GitHub requires the workflow on the default branch
   before manual dispatch. Adding it to a candidate branch alone is insufficient.
   Do not merge the upstream candidate or the wider rebuild to install the lane.
2. Check that the selected SHA is still the intended candidate, no equivalent
   local/hosted run is active, and the current source runner still implements
   the documented selection. Confirm the named milestone and cost boundary.
3. In the fork's Actions UI choose **Milestone slow checks**, **Run workflow**,
   select `main`, supply the full SHA and a plain-text milestone description.
   An agent preparing this change must not treat that as permission to dispatch.
4. Record the resulting run URL, source SHA, controller SHA, environment, suite
   outcome, counts and exclusions. A job cancelled during setup/cleanup has
   incomplete evidence even if part of the suite ran.

The suite streams the candidate runner's output through its existing secret
redactor into the Actions log, including file START/DONE markers as emitted.
GitHub workflow-command interpretation is disabled while these lines stream.
Every 60 seconds a compact observation reports the current tier, observed DONE
count (including FAIL/SKIP), active START-without-DONE filenames and their ages,
and time since the last file START/DONE. Duplicate basenames are tracked as
separate starts. After five minutes without a file marker it flags a stale
observation, not a proven hang: a long file may still be working normally.
Ordinary log chatter and the timer itself do not reset this age.

The default runner does not publish an upfront inventory, so total remains
unknown. The display makes no overall percentage or ETA claim: file counts do
not measure work fraction. These are observations of console markers, which
may include nested test output, not authoritative coverage or qualification
results. The original runner summary and exit status remain authoritative. Runner, local-log and live-stream failures
all fail the step. The runner command and its selection are unchanged.

Console lines already received by Actions remain available if the runner
machine crashes. The last buffered bytes, raw runner-local log and per-file
logs can still be lost; a crash or incomplete summary is never a pass. This
change does not retrofit an already running workflow.

The sanitized summary and the final 256 KiB of runner output are also printed
in the Actions diagnostics step when cleanup can run. No artifact is uploaded, so large per-file fixture
logs are not retained. The run log follows the repository's existing retention
policy. A separate artifact-based diagnostic run would need its storage/public
log-sharing implications considered before changing this lane.

This change does not modify the pre-existing `rin-ci.yml` workflow or claim to
pause every workflow on every branch. It adds no automatic trigger.

References:

- [GitHub Actions billing and usage](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [Manually running a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
