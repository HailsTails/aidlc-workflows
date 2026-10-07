---
id: CD-46
title: Touching a carved-out file revokes its carve-out — leave it clean
serves-principle: I
lens: []
pairs-with: [cd-002, cd-010, cd-027, cd-037]
amended: [v2.22.0]
enforced-by:
  - script:check-carve-out-decay
  - manual
status: active
applies-to: process
portability: portable
aidlc-enforced-by:
  - manual
  - sensor:carve-out-decay
  - gate:rin-constitution-gate
---

A suppression or exemption is inherited debt held at rest, not a standing licence: it buys "leave this file alone", nothing more. The moment a change edits an exempt file, that file forfeits its exemption — the change must bring the whole file into compliance for the exempted rule (the new lines and the pre-existing ones the exemption was masking) and remove the exemption entry, in the same change. There is no partial credit and no extracting the touched code into a clean helper while the exempt file stays dirty. If full compliance is out of scope, the move is to not touch the file. This rule governs how every other exemption decays and can never itself be exempted.
