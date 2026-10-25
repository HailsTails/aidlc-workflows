# GitHub bot identities for Rin consumers

Rin's `guard-github-writes` hook blocks raw `gh` writes in agent sessions, because they would act as the operator's own GitHub login. The plugin ships the replacement: a bot CLI at `<harness-dir>/tools/github-apps/cli-main.ts`. Agent sessions act on the consumer's repository as two GitHub Apps:

| Role       | Actor               | Used by           | Commands                                                                   |
| ---------- | ------------------- | ----------------- | -------------------------------------------------------------------------- |
| `author`   | `<author-slug>[bot]`   | author sessions   | `pr`, `pr-edit`, `comment`, `draft`, `ready`, `merge`, `close`, `git push` |
| `reviewer` | `<reviewer-slug>[bot]` | reviewer sessions | `review`                                                                   |

GitHub refuses a bot's approval of its own pull request. Splitting authoring from reviewing across two apps is what lets an agent review count. Helen's consumers use the `rin-author` and `rin-reviewer` apps.

## Commands

Run every command from the consumer's project root. The examples use Claude's `.claude`; substitute the harness directory you installed.

| Command                                                                                                      | Does                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `bun .claude/tools/github-apps/cli-main.ts pr --title "T" --body-file body.md [--base main] [--head <branch>] [--draft] [--session <id>]` | opens a pull request as the author bot |
| `... pr-edit --pr <n> [--title "T"] [--body "B" \| --body-file <path>]`                                       | retitles or rewrites a pull request                                           |
| `... comment --target <n> --body "B"`                                                                         | comments on an issue or pull request                                          |
| `... draft --pr <n>` / `... ready --pr <n>`                                                                   | converts to draft / marks ready for review                                    |
| `... review --pr <n> --event approve\|request-changes\|comment --body "B" [--commit-sha <sha>]`               | posts a review as the reviewer bot, bound to the head it read                 |
| `... merge --pr <n>`                                                                                          | squash-merges, refusing unless the latest verdict approves the current head   |
| `... close --pr <n> --reason "R"`                                                                             | closes a superseded pull request, refusing one that is approved and mergeable |
| `... adopt-git`                                                                                               | makes this linked worktree commit and push as the author bot                  |
| `... token --role author\|reviewer`                                                                           | prints a one-hour installation token, for `GH_TOKEN=` reads                   |
| `... marker --role author\|reviewer --session <id>`                                                           | prints the provenance marker                                                  |

Every body an agent posts starts with a hidden marker, `<!-- rin-bot: role=<role> session=<id> -->`, so authorship can be audited and filtered. Use `--body-file` for long or multi-line bodies. A flag may be given once; a value that itself starts with `--` has to go through `--body-file`.

`review` posts against the head sha it read, and refuses if `--commit-sha` names a different head. `merge` passes that head to GitHub as `expectedHeadOid`, so a push that lands between the check and the merge makes GitHub refuse the merge.

A consumer that prefers short names can add its own `package.json` scripts that call the CLI, for example `"gh:pr": "bun .claude/tools/github-apps/cli-main.ts pr"`. The hook's hints always name the CLI itself, so they never point at a script the consumer lacks.

## Configuration

Each consumer commits `aidlc/github-identity.json`:

```json
{
  "repository": "HailsTails/minutesarah-shop",
  "baseBranch": "main",
  "roles": {
    "author": { "appSlug": "rin-author" },
    "reviewer": { "appSlug": "rin-reviewer" }
  }
}
```

A token is always scoped to that one repository, and minting refuses credentials that authenticate as a different app slug. Without this file the bot identity is unconfigured: the hook still blocks raw `gh` writes but says what to add, and worktree provisioning skips identity adoption without a message.

## Credentials

Nothing secret lives in any repository. The CLI reads one per-user credential store at `~/.config/rin-github-apps/credentials.json`. Set `RIN_GITHUB_APPS_CREDENTIALS_DIR` to use another directory.

```json
{
  "author": { "appId": "<id>", "privateKeyPath": "rin-author.private-key.pem" },
  "reviewer": { "appId": "<id>", "privateKeyPath": "<absolute path to rin-reviewer.private-key.pem>" }
}
```

A relative `privateKeyPath` is read from the store directory; an absolute one is read where it points. Each private key therefore exists once per machine, and one rotation covers every consumer.

## Worktree git identity

On a new linked worktree, the plugin's `provision-worktree` hook runs `adopt-git`. Adoption first mints an author token for the configured repository. If the app is not installed there, or its credentials do not resolve, the worktree keeps its own git identity and the hook prints one line saying so; `git push` keeps working under the operator's normal credentials. Once adoption succeeds, the worktree's own git config commits as `<author-slug>[bot]` and pushes through a credential helper that mints a fresh token each time. The primary checkout is never changed.

## Setting up a consumer repository

1. Install each app on the consumer repository: on the app's settings page choose *Install App*, then the owning account, then *Only select repositories*, and add the repository. An installation inherits the app's permissions; it does not choose its own. Check that the author app has **Contents: read and write** (push and merge), **Pull requests: read and write** and **Issues: read and write** (comments), plus **Workflows: read and write** if agents change `.github/workflows/`. Check that the reviewer app has **Pull requests: read and write** and **Contents: read**. **Metadata: read** is always granted.
2. If the base branch is protected, require pull requests with at least one approval: the reviewer bot's approval satisfies it and the author bot cannot approve its own pull request. If the rule restricts who may push or merge to the branch, add the author app to that list.
3. Commit `aidlc/github-identity.json`.
4. Make sure the per-user credential store holds both roles.
