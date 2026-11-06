# Rin deployment procedure fixture

This example relocates the existing consumer requirements, without executing them. Source references: `infra/scripts/deploy-to-pi.sh`, `aidlc/spaces/default/memory/project.md` and `aidlc/spaces/default/knowledge/infra-deploy/`. The project's own files and active reserved list remain authoritative on adoption.

## Target and currency

The target is Rin's Pi stack. Check currency before selecting a Slice, including when the pool is empty or a Slice is parked. Compare checkout HEAD with `origin/main`; separately compare each running image with the last commit touching that image's actual build inputs. Records-only commits do not require rebuilding an unchanged image. Current checkout plus stale image is still behind. Do not use one repository-wide build watermark for unrelated images.

## Delivery and authority

The consumer command is `pnpm rin-gates:deploy`, backed by `infra/scripts/deploy-to-pi.sh`. It drives Docker Compose over SSH and converges the whole stack, never a hand-computed affected-services list. Preserve the project's current reserved-decision policy and prerequisites. A currency gap requires the authorized converge or an explicit held/failed outcome, not a silent skip. The script's `--dry-run` contacts the target and is not an offline fixture command.

## Verification

Record source, image and serving-container identity, then force the Slice's real path and read its expected side effect. Require the deploy script's live probes and the Slice's capability checks; a container healthcheck alone is insufficient. Exit 2 means live verification failed after mutation; exit 3 means degraded/excluded services, not unconditional success for the intended release.

## Recovery

Capture the rollback anchor and the procedure printed by the current script before mutation. Reconcile a failed or uncertain run before retrying. Respect boot migrations and identify anything a code rollback does not undo. Do not substitute the historical rollback document for the script's current recovery path.

## Operation

Use the project's monitoring and notes surfaces. Preserve lane-wide currency independently of Slice selection, but do not mark an arbitrary Slice complete. Gate 6's four artifacts and engine completion still require the selected Slice's real-path evidence and closed bookkeeping.