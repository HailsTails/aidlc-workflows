# Scheduled intake example

## Gate 0

The intake assignment owns the whole measured queue sweep, including reservoir
captures, even when it selects an existing engine intent. Use the project's
current capture adapter and live tasks snapshot. Keep queue IN/OUT, inflow,
dispositions and age alarm; unavailable measurement remains UNMEASURED and holds
capture disposition. A fired age alarm is a nonblocking LANE FAILURE, never a
healthy result. Targeted capture promotion outside this assignment still needs
current capture evidence, sibling checks and confirmed closure.

Same-run branch push and PR are required for this scheduled assignment. Use the
project's authorized worktree/author/publication procedure and verify remote
head and PR identity. A missing procedure, binding or authority is HOLD, not
permission to downgrade to local completion. This example supplies no live
adapter, destination, credential or permission and cannot authorize publication.
