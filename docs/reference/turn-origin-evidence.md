# Turn-origin evidence and deferred withdrawal

Claude can write the origin of a prompt after the prompt hook has returned. The hook keeps the exact transcript/prompt key and its original workflow target. The canonical transcript reader alone classifies it. A missing, partial, mismatched, unmarked or no-longer-retained row remains unresolved; neither elapsed time nor an unrelated same-second row proves person origin.

## Evidence is separate from admission

`aidlc-turn-origin-evidence.ts` owns confirmed-host facts. Its read result is `host`, `none` (no such negative fact), or `unavailable` (the evidence path is damaged, redirected or unreadable). **None is not a person verdict.** The owner takes no autonomy or Guard Policy setting. A confirmed host, or unavailable negative-evidence record for a message, cannot prove that a person acted.

This change does not add a universal unknown-origin admission policy. Upstream provisional capture and legacy compatibility remain; a strict or compatibility consumer policy must interpret unresolved evidence without rewriting it to person. Independent autonomous authority is separate from a human witness. Message-spending, summary-presentation/window/message proof, and receipt requirements are unchanged.

## Durable fact, then cleanup

After confirming host origin, settlement records in-process negative knowledge before trying any lock or write. It atomically publishes `aidlc/.aidlc-sessions/host-turns/<message-id>.json` before withdrawing any derived material. Each bounded record includes the message identity, observed reason/time, permanent original-row witness (session, append-owned timestamp and shard), and separate original cleanup target. No prompt words are copied into this fact.

The cleanup owner independently attempts the original shard's HOST_TURN append, protected replies, the original workflow's plan reply, its legacy challenge response, the guard response with that exact message ID, and the message file. One failure does not prevent the other withdrawals. A later entry retries from the durable fact, even when the pending key, transcript or message is gone. HOST_TURN appends are idempotent and use the original shard, never the chat's later selection. New withdrawal rows carry Turn Timestamp and Session, so both live projection and recorded withdrawal match the original row rather than an unrelated short-ID collision. Older HOST_TURN rows keep their legacy ID-only meaning.

After all withdrawals succeed, an atomic rewrite drops cleanup detail while retaining the host fact. An atomic rename moves that same fact to `host-turns/settled/<message-id>.json`. Readers check the active location before the settled location so a move cannot fall between both absence checks. A crash before the move leaves the compact active fact discoverable for another attempt. Retry discovery scans only the active backlog, not all completed historical wakeups. Facts are not expired or evicted, and their IDs cannot be reused by the message store.

## Reader boundary

Live audit events, raw turn-window readers, message lookup/proof, protected and plan replies, guard reads and guard transactions apply the same negative evidence. Raw cleanup readers remain private to their existing record owners, so projection cannot make physical withdrawal a no-op. Strict cleanup distinguishes a missing file from unreadable, redirected or malformed material; only verified success allows compaction. Pure historical/git-tree audit parsing deliberately remains independent of local runtime facts.

Current legacy Plan Approval responses now retain per-message attribution while preserving the exact existing 8000-character accumulated-word suffix. Older accumulated words without attribution remain unbound rather than being assigned by text.

New guard replies retain their message ID, including after the conductor records a remedy. Identical text from another message does not inherit the earlier host identity. Older guard replies without message IDs cannot be attributed by a matching digest alone; they remain unbound legacy evidence. No historical guard withdrawal is claimed for them.

## Failure limits

- If the initial fact write never succeeds, only the observing process retains the confirmed observation. A restart plus loss of its transcript cannot recover an observation that was never persisted. The pending key remains, but unknown-origin compatibility still applies until evidence is available. This is not a restart-durability guarantee for failed initial persistence.
- An old pending key without an original target or append-owned row witness still produces a negative fact, but cannot authorize cleanup in whichever workflow is selected later. Its unavailable cleanup remains pending. Without that original-row witness, a short ID alone is not assigned to a historical HUMAN_TURN: named-message proof is excluded, but those old rows retain legacy generic presence/window eligibility. This candidate does not qualify automatic old-record migration or a universal strict admission policy.
- Already-committed decisions are not rolled back. Existing message retention, pending-key caps, prompt truncation and adapter attribution limitations remain.
- Read-only engine observers classify for their own reads without creating locks, directories or durable state. They do not perform cleanup.
- This local runtime record is operational evidence, not a cryptographic authenticity claim or cross-clone trust proof.

## Regression coverage

The focused durability tests inject initial persistence, audit append, reply withdrawal, deletion, compaction and archive-move failures. Fresh-process retries prove persisted facts survive transcript/pending loss. Guard tests cover transaction reads, newer identical replies and unbound legacy compatibility. Packaged entry tests use the actual Claude hook and setting command under off/strict Guard Policy, including repinning the chat before retry. No test constructs a HUMAN_TURN or summary authorization to force an approval; the hook's ordinary provisional output is tested as such.