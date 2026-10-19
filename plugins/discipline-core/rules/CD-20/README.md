# CD-20: Runtime stdlib imports arrive through injected ports

## Rule

Collapsed into [CD-19](../CD-19/README.md) — confining the
runtime's own standard library behind a wrapping port is the same intent as
confining a third-party dependency (CD-20 was originally split out of CD-19). CD-19
now covers both third-party and stdlib dependencies. This id is retained as a
redirect so existing citations resolve; it is not independently enforced.

The sections below describe how the rule is checked.

Review lens: [di-discipline](../../methods/lenses/di-discipline.md). The lens reviews the whole rule, including what no check flags.

## How it is checked

This discipline has no clauses of its own. Its rule is carried by [CD-19](../CD-19/README.md); select that discipline's clauses instead.
