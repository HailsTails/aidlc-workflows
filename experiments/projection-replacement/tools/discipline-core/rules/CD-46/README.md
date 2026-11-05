# CD-46: Touching a carved-out file revokes its carve-out — leave it clean

## Rule

A suppression or exemption is inherited debt held at rest, not a standing licence: it buys "leave this file alone", nothing more. The moment a change edits an exempt file, that file forfeits its exemption — the change must bring the whole file into compliance for the exempted rule (the new lines and the pre-existing ones the exemption was masking) and remove the exemption entry, in the same change. There is no partial credit and no extracting the touched code into a clean helper while the exempt file stays dirty. If full compliance is out of scope, the move is to not touch the file. This rule governs how every other exemption decays and can never itself be exempted.

The sections below describe how the rule is checked.

Review lens: none. A reviewer applies the rule text directly.

## How it is checked

This discipline has no clauses to select: the check applies it to every file carve-out. Run the check with `--base-revision`, and a `file-carve-out` record whose file changed since that revision is forfeited, so its findings come back and the run fails until the file is clean and the record is removed. Without `--base-revision`, any file carve-out makes the report list `forfeiture-unmeasured` and the run fails. See [discipline-exceptions.json](../../README.md#discipline-exceptionsjson).
