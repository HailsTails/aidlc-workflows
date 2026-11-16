# upstream-shape tooling

Rebuilds the `upstream-shape` branch of `HailsTails/aidlc-workflows` from `rebuild/foundation`, deterministically, so it never drifts by hand.

```sh
bun install
bun src/regenerate.ts --repository <aidlc-workflows checkout>
bun src/regenerate.ts --repository <aidlc-workflows checkout> --verify
git -C <aidlc-workflows checkout> push origin upstream-shape
```

The twin of the branch as one commit on the upstream pin, for a pull request against `awslabs/aidlc-workflows`:

```sh
bun src/regenerate.ts --repository <aidlc-workflows checkout> --parent caea995ae --branch upstream-shape-on-pin
```

An optional patch carries a change that waits on a decision. Leaving it out also drops its line from the open items in `PARITY.md`:

```sh
bun src/regenerate.ts --repository <aidlc-workflows checkout> --without gitleaks-golden-allowlist
```

What a run does, in a temporary index, never touching a checkout:

1. Reads the foundation tree.
2. Checks every file in `SHAPE_PLAN.movedFiles` still has its recorded blob on foundation, and stops if one changed.
3. Removes the stripped folders and files.
4. Moves the golden and install-lifecycle code from `lint/gate/` to `scripts/parity/`.
5. Takes `SHAPE_PLAN.pinnedFiles` from the pin.
6. Applies `patches/` in name order, then each `SHAPE_PLAN.optionalPatches` entry not named by `--without`. A patch that no longer applies stops the run.
7. Adds `overlay/` files, `src/bridge-map.json` generated from foundation's `lint/context-map.ts`, and `PARITY.md` rendered from `templates/PARITY.md`.
8. Commits with foundation's tip identity and dates, so the same inputs give the same commit.
