# MinuteSarah deployment procedure fixture

This example points to the existing consumer delivery owners: `infra/README.md` sections "How a change reaches Cloudflare", "Commerce API deploys", "Storefront deploys", "Admin deploys" and "Rollback and recovery"; `.github/workflows/commerce-api-deploy.yml`, `storefront-deploy.yml`, `admin-deploy.yml`, `admin-auth-deploy.yml` and `infra.yml`. It is a local contract fixture only.

## Target and currency

The target is the required Cloudflare production surface, distinct from previews and staging. Select the relevant workflow using its actual watched paths and current release rules. Bind the merged revision, run, uploaded release/version and serving release/traffic. An upload job can succeed while its version receives no traffic. Records-only commits outside a workflow's watched inputs need not produce a new deployment; prove the relevant source is included in the serving release instead of requiring every commit to deploy.

## Delivery and authority

GitHub Actions owns CI/CD. Observe the existing merge-triggered run first; do not run a local deploy or duplicate an already-serving release for Gate 6. A pending run is followed, not replaced. For a missed, skipped, failed or superseded deploy, read the workflow outcome and current serving release, then use only the relevant documented recovery if authorized. Commerce recovery uses Run workflow on the tip of main with action `deploy`; storefront recovery uses the latest main run, not an old commit. Do not treat those as a universal recovery rule for Terraform: a partial apply needs its own state-aware procedure, not blind rerun.

The current project reserved list stops production deploy/cutover/DNS mutations, while infra documentation describes automatically gated delivery after merge. Record that authority distinction/conflict and obtain the existing policy owner's decision before an agent initiates a new production action. Do not convert observing an automatic run into permission to dispatch, promote, rollback, change DNS, restore customer data or weaken a gate. Never upload an admin-origin Worker from a branch. No credentials or actual requests belong in this fixture.

## Verification

Require the relevant deploy, migration and smoke steps to pass without a relevant skip. Commerce requires health, quote, availability, configured checkout and closed-admin smoke checks, plus readback of the actual serving version/traffic. A preview, successful upload or green workflow with skipped production jobs is not the production capability. Use the project's authorized probes and test data; do not invent live purchases, customer changes or external messages as verification.

## Recovery

Capture the prior serving version and migration state. If smoke fails after traffic moves, inspect automatic rollback and read back its result. Manual rollback requires the named prior version and its compatibility with the current database and stored secrets. Migrations and current routes remain applied; database restore is a separate consequential action. Do not replace a waiting deploy with rollback/restore/seed unless that replacement is intended and authorized. After rollback, the intended Slice is not shipped just because the prior version is healthy.

## Operation

Record workflow/run links, serving-release identity, smoke results, rollback outcome, monitoring and the Gate 6 bookkeeping. Observing and verifying an already-serving release needs no deployCommand binding. Missing/held evidence is recorded explicitly. This fixture never asserts that a real deployment or engine completion occurred.