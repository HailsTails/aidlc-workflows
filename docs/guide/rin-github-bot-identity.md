# GitHub bot identities for Rin consumers

Rin's `guard-github-writes` hook blocks raw `gh` writes in agent sessions, because they would act as the operator's own GitHub login. The plugin ships the replacement: a bot CLI at `<harness-dir>/tools/github-apps/cli-main.ts`. Agent sessions act on the consumer's repository as two GitHub Apps:

| Role       | Actor                  | Used by           | Writes                                                                                              |
| ---------- | ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `author`   | `<author-slug>[bot]`   | author sessions   | `gh pr create/edit/comment/ready/merge/close`, `gh issue create/edit/comment/close/reopen`, `git push` |
| `reviewer` | `<reviewer-slug>[bot]` | reviewer sessions | `gh pr review`                                                                                      |

GitHub refuses a bot's approval of its own pull request. Splitting authoring from reviewing across two apps is what lets an agent review count. Helen's consumers use the `rin-author` and `rin-reviewer` apps.

## Commands

Run every command from the consumer's project root. The examples use Claude's `.claude`; substitute the harness directory you installed.

Writes are the real `gh` command, prefixed with the CLI and `gh`:

```bash
bun .claude/tools/github-apps/cli-main.ts gh pr create --title "T" --body-file body.md --label bug --attach shot.png#Before
```

The wrapper mints the role's bot token, sets `GH_TOKEN` and `GH_PROMPT_DISABLED=1`, pins `--repo` to the configured repository, stamps the provenance marker onto the body, and runs `gh` (2.103.2 or later; earlier releases cannot use an app installation token). Every other argument, including `--attach`, `--label`, `--add-label`, `--squash` and `--auto`, goes to `gh` unchanged. The wrapper prints what `gh` printed and exits with `gh`'s exit code, so a write that publishes and then fails an upload still prints the URL it published. Reads (`gh pr view`, `gh pr list`, `gh pr checks`, `gh api` GETs) stay plain `gh`.

| Wrapped write                                                                 | Notes                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `gh pr create`, `gh issue create`, `gh pr comment`, `gh issue comment`        | need a body (`--body`, `--body-file`, or `--body-file -` for standard input) or at least one `--attach` |
| `gh pr edit`, `gh issue edit`                                                 | stamp the body only when one is given                                                                   |
| `gh pr ready`, `gh pr merge`, `gh issue close`, `gh issue reopen`             | pass through; a `gh pr merge --body` is passed on unstamped, as the commit body                         |
| `gh pr close <n> [--comment "C"]`                                             | refuses a pull request that is approved and mergeable; the closing comment is stamped                   |
| `gh pr review <n> --approve\|--request-changes\|--comment [--body "B"] [--commit-sha <sha>]` | runs as the reviewer bot and posts against the head it read, refusing if `--commit-sha` names another head |
| `... adopt-git`                                                               | makes this linked worktree commit and push as the author bot                                            |
| `... token --role author\|reviewer`                                           | prints a one-hour installation token, for `GH_TOKEN=` use outside the wrapped writes                    |
| `... marker --role author\|reviewer --session <id>`                           | prints the provenance marker                                                                            |

`gh pr close` and `gh pr review` take the pull request number right after the verb, because the wrapper reads that pull request before it acts. `gh pr review` through the wrapper takes only the number, one event flag, a body and `--commit-sha`.

The wrapper refuses `--repo`/`-R` (the repository is pinned), `--admin` (it never bypasses rulesets), `--web`, `--editor`, `--fill`, `--fill-first`, `--fill-verbose`, `--template` and `--recover` (the body would not be one it stamped). `--body` and `--body-file` cannot both be given.

Every body an agent posts starts with a hidden marker, `<!-- rin-bot: role=<role> session=<id> -->`, so authorship can be audited and filtered. The session is `--session <id>` when given (the wrapper takes it out before calling `gh`), otherwise the issue or pull request number after the verb, otherwise the `--head` branch, otherwise `new-issue` for `gh issue create`, otherwise the current branch. Text that contains a private key is refused, whether given with `--body`, on standard input or in a `--body-file`. A `--body-file` or `--attach` file inside the credential store is refused; for `--attach`, every reading of a `#` in the value as the end of the path is checked, so alt text cannot hide one.

A consumer that prefers short names can add its own `package.json` scripts that call the CLI, for example `"gh:bot": "bun .claude/tools/github-apps/cli-main.ts gh"`. The hook's hints always name the CLI itself, so they never point at a script the consumer lacks.

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

A token is always scoped to that one repository. `gh issue create`, `gh issue edit`, `gh issue close` and `gh issue reopen` narrow it further to **Issues: write**, and `gh pr comment` and `gh issue comment` to **Issues: write** and **Pull requests: write**. Minting refuses credentials that authenticate as a different app slug. Without this file the bot identity is unconfigured: the hook still blocks raw `gh` writes but says what to add, and worktree provisioning skips identity adoption without a message.

## Credentials

Nothing secret lives in any repository. The CLI reads one per-user credential store at `~/.config/rin-github-apps/credentials.json`. Set `RIN_GITHUB_APPS_CREDENTIALS_DIR` to an absolute path to use another directory; a relative one is refused, because git runs the credential helper from each worktree.

```json
{
  "author": { "appId": "<id>", "privateKeyPath": "rin-author.private-key.pem" },
  "reviewer": { "appId": "<id>", "privateKeyPath": "<absolute path to rin-reviewer.private-key.pem>" }
}
```

A relative `privateKeyPath` is read from the store directory; an absolute one is read where it points. Each private key therefore exists once per machine, and one rotation covers every consumer.

## Worktree git identity

On a new linked worktree, the plugin's `provision-worktree` hook runs `adopt-git`. Adoption first checks that the worktree's push remote is `https://github.com/<owner>/<repo>` for the configured repository, then mints an author token for it. If the worktree pushes somewhere else, pushes over SSH (the credential helper only serves HTTPS), the app is not installed there, or its credentials do not resolve, the worktree keeps its own git identity and the hook prints one line saying so; `git push` keeps working under the operator's normal credentials. Once adoption succeeds, the worktree's own git config commits as `<author-slug>[bot]` and pushes through a credential helper that mints a fresh token each time. The primary checkout is never changed.

## Setting up a consumer repository

1. Install each app on the consumer repository: on the app's settings page choose *Install App*, then the owning account, then *Only select repositories*, and add the repository. An installation inherits the app's permissions; it does not choose its own. Check that the author app has **Contents: read and write** (push and merge), **Pull requests: read and write** and **Issues: read and write** (comments, and opening, relabelling and closing issues), plus **Workflows: read and write** if agents change `.github/workflows/`. Check that the reviewer app has **Pull requests: read and write** and **Contents: read**. **Metadata: read** is always granted.
2. Configure the base branch's ruleset to require a pull request with at least one approval, to require its status checks, to allow only squash merges, to dismiss stale approvals when new commits are pushed, and to require approval of the most recent push. `gh pr merge` through the wrapper does not judge reviews or merge state itself: the ruleset is the merge gate, and without it nothing stops a merge. The reviewer bot's approval satisfies the approval rule, and GitHub never lets the author bot approve its own pull request. If the rule restricts who may push or merge to the branch, add the author app to that list, and do not add either app to the bypass list.
3. Commit `aidlc/github-identity.json`.
4. Make sure the per-user credential store holds both roles.
