# Native boundary patches

These patches preserve source-owned boundary extractions from the experiment. They have different historical bases and qualification scopes and are not an ordered installation script.

The completed aggregate native tree for this snapshot is `760ade07a4be3176a22c0d3857b6caac13fd52d3`, available through draft PR 114. Review the actual integrated source there rather than assuming every older patch applies to current upstream.

`json-map-ownership.patch` is the bounded ownership extraction integrated in that native pin. `deferred-json-map-own-members.patch` is a separate, unapplied own-member/prototype-key correction. Its application was checked against the parity candidate, but no special-key installed-consumer qualification is claimed.

Patches contain source and test changes, not generated distributions or authority to install into a live project. Workstation-specific provenance and private review records are intentionally excluded from this publication.
