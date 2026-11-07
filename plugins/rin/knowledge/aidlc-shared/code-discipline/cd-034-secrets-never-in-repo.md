---
id: CD-34
title: Secrets never enter the repo
serves-principle: IV
lens: [clean-architecture]
pairs-with: []
amended: []
enforced-by:
  - manual
enforcement-note: "Secrets-in-repo absence is a gitleaks/secret-scanner concern; no in-tree audit."
status: active
applies-to: universal
portability: portable
aidlc-enforced-by:
  - lens:rin-clean-architecture-reviewer-agent
---

Secrets live only in the environment or a secrets manager — never in source, never in logs, never in URL query parameters. A committed secret is compromised the moment it lands in history, whatever happens to it later; the repository is not a place a secret can safely exist.
