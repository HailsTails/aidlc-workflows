---
id: CD-12
title: Repositories are the primary storage abstraction
serves-principle: III
lens: [clean-architecture]
pairs-with: []
amended: []
enforced-by:
  - manual
enforcement-note: "Repository-as-storage-abstraction is a structural review judgement."
status: active
applies-to: architecture
portability: portable
aidlc-enforced-by:
  - lens:rin-clean-architecture-reviewer-agent
---

Storage sits behind a repository port. Domain code talks to the port; an adapter composes the raw storage-driver primitives behind it. The domain never imports the storage driver or a filesystem primitive directly — so the storage technology can change without the domain knowing.
