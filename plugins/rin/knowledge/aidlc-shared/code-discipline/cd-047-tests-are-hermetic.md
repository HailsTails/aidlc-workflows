---
id: CD-47
title: Tests are hermetic — no real side effects on anything real
serves-principle: V
lens: [test-discipline]
pairs-with: [cd-025, cd-026, cd-027]
status: active
applies-to: universal
portability: portable
enforced-by:
  - script:audit:hermetic-git
enforcement-note: "The Git text guard is a partial check only. Hermeticity across network, filesystem, environment, clocks and other real side effects still needs review."
aidlc-enforced-by:
  - script:audit:hermetic-git
  - lefthook:audit-hermetic-git
  - ci:checks
---

A test may not touch its environment or cause any real side effect on anything real. "Anything real" is everything the test did not itself create and does not itself dispose: the developer's repository, their user configuration and home directory, any network or live service, shared filesystem paths, the system clock, and the ambient process environment.

A test fakes the real subsystem. Spawning it is permitted in exactly one closed case: the subsystem's own observable behaviour is the assertion's subject and no fake can stand in for it. Setup, realism and convenience never qualify; state which assertion cannot be written against a fake, and if that sentence cannot be written, the test does not qualify. A qualifying test brings its own instance in a location it created and removes it afterwards; it never borrows the machine's.

Real git is the mechanically checked class: a test that spawns a real `git` subprocess passes an explicit hermetic environment at that call site, and never inherits the ambient one.
