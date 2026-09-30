// Sensor fire verdicts: the dispatcher's outcome type, the verdict line it
// prints, and the readers that parse that line back. Side-effect free so the
// PostToolUse hook, the gate-time reader and tests can import it without
// loading the dispatcher's bundled sensor manifests.

export type FireOutcome =
	| { kind: "passed"; durationMs: number; note?: string }
	| {
			kind: "failed";
			durationMs: number;
			findingsCount: number;
			detailBody: string;
			writerNotice: string | undefined;
	  }
	| { kind: "budget-override"; capValue: number; observedSeconds: number };

export interface FireVerdict {
	fire_id: string;
	sensor_id: string;
	stage: string;
	output_path: string;
	result: FireOutcome["kind"];
	detail_path: string | null;
	note?: string;
	writer_notice?: string;
}

// The shape a reader accepts: writer_notice is carried through unvalidated so
// a malformed notice degrades to a silent finding instead of an unreadable
// verdict.
export type FireVerdictLine = Omit<FireVerdict, "writer_notice"> & {
	writer_notice?: unknown;
};

export type DetailWrite =
	| { kind: "not-attempted" }
	| { kind: "written"; detailPath: string }
	| { kind: "failed"; reason: string };

export type DetailFile =
	| { readonly kind: "written"; readonly path: string }
	| { readonly kind: "unwritten" };

export type DispatchedVerdict =
	| {
			readonly result: "passed";
			readonly sensorId: string;
			readonly outputPath: string;
	  }
	| {
			readonly result: "budget-override";
			readonly sensorId: string;
			readonly outputPath: string;
	  }
	| {
			readonly result: "failed-silent";
			readonly sensorId: string;
			readonly outputPath: string;
			readonly detailFile: DetailFile;
	  }
	| {
			readonly result: "failed-with-notice";
			readonly sensorId: string;
			readonly outputPath: string;
			readonly detailFile: DetailFile;
			readonly writerNotice: string;
	  };

export type DispatcherStdoutReading =
	| { readonly kind: "verdict"; readonly verdict: DispatchedVerdict }
	| { readonly kind: "unreadable" };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function writerNoticeTextOf(sensorJson: unknown): string | undefined {
	if (!isRecord(sensorJson)) return undefined;
	const notice = sensorJson.writer_notice;
	return typeof notice === "string" && notice.length > 0 ? notice : undefined;
}

export function isFireVerdictLine(value: unknown): value is FireVerdictLine {
	return (
		isRecord(value) &&
		typeof value.fire_id === "string" &&
		typeof value.sensor_id === "string" &&
		typeof value.stage === "string" &&
		typeof value.output_path === "string" &&
		(value.result === "passed" ||
			value.result === "failed" ||
			value.result === "budget-override") &&
		(value.detail_path === null || typeof value.detail_path === "string") &&
		(value.note === undefined || typeof value.note === "string")
	);
}

// Scan from the last line so a banner a wrapper printed first is skipped.
export function lastFireVerdictLineOf(stdout: string): FireVerdictLine | null {
	const lines = stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	for (let i = lines.length - 1; i >= 0; i--) {
		try {
			const value: unknown = JSON.parse(lines[i]);
			if (isFireVerdictLine(value)) return value;
		} catch {
			// Not JSON; keep scanning.
		}
	}
	return null;
}

export function fireVerdictOf(args: {
	fireId: string;
	sensorId: string;
	stage: string;
	outputPath: string;
	outcome: FireOutcome;
	detailWrite: DetailWrite;
}): FireVerdict {
	const { fireId, sensorId, stage, outputPath, outcome, detailWrite } = args;
	const identity = {
		fire_id: fireId,
		sensor_id: sensorId,
		stage,
		output_path: outputPath,
	};
	if (outcome.kind === "passed") {
		return {
			...identity,
			result: "passed",
			detail_path: null,
			...(outcome.note ? { note: outcome.note } : {}),
		};
	}
	if (outcome.kind === "budget-override") {
		return { ...identity, result: "budget-override", detail_path: null };
	}
	const notice =
		outcome.writerNotice !== undefined ? { writer_notice: outcome.writerNotice } : {};
	if (detailWrite.kind === "written") {
		return {
			...identity,
			result: "failed",
			detail_path: detailWrite.detailPath,
			...notice,
		};
	}
	// The detail file is missing. A finding the writer can still be told about
	// stays failed; one with nothing to tell keeps the historical pass-with-note.
	if (outcome.writerNotice === undefined && detailWrite.kind === "failed") {
		return {
			...identity,
			result: "passed",
			detail_path: null,
			note: `script-error: detail-write-failed: ${detailWrite.reason}`,
		};
	}
	return { ...identity, result: "failed", detail_path: null, ...notice };
}

export interface TerminalAuditRow {
	event: "SENSOR_PASSED" | "SENSOR_FAILED" | "SENSOR_BUDGET_OVERRIDE";
	fields: Record<string, string>;
}

// The terminal audit row follows the verdict's result, so the audit and the
// verdict line never disagree about a fire whose detail file was not written.
// The fire's identity fields are the caller's to add.
export function terminalAuditRowOf(args: {
	outcome: FireOutcome;
	verdict: FireVerdict;
	detailWrite: DetailWrite;
}): TerminalAuditRow {
	const { outcome, verdict, detailWrite } = args;
	if (outcome.kind === "budget-override") {
		return {
			event: "SENSOR_BUDGET_OVERRIDE",
			fields: {
				"Cap layer": "registry",
				"Cap value": String(outcome.capValue),
				"Observed value": String(outcome.observedSeconds),
			},
		};
	}
	if (verdict.result === "passed") {
		return {
			event: "SENSOR_PASSED",
			fields: {
				"Duration ms": String(outcome.durationMs),
				...(verdict.note ? { Note: verdict.note } : {}),
			},
		};
	}
	const detail: Record<string, string> =
		verdict.detail_path !== null
			? { "Detail path": verdict.detail_path }
			: detailWrite.kind === "failed"
				? { Note: `detail-write-failed: ${detailWrite.reason}` }
				: {};
	return {
		event: "SENSOR_FAILED",
		fields: {
			...detail,
			"Findings count": String(
				outcome.kind === "failed" ? outcome.findingsCount : 0,
			),
		},
	};
}

function detailFileOf(detailPath: string | null): DetailFile {
	return detailPath === null
		? { kind: "unwritten" }
		: { kind: "written", path: detailPath };
}

export function verdictOfDispatcherStdout(
	stdout: string,
): DispatcherStdoutReading {
	const line = lastFireVerdictLineOf(stdout);
	if (line === null) return { kind: "unreadable" };
	const sensorId = line.sensor_id;
	const outputPath = line.output_path;
	if (line.result === "passed" || line.result === "budget-override") {
		return {
			kind: "verdict",
			verdict: { result: line.result, sensorId, outputPath },
		};
	}
	const detailFile = detailFileOf(line.detail_path);
	const writerNotice = writerNoticeTextOf(line);
	return {
		kind: "verdict",
		verdict:
			writerNotice === undefined
				? { result: "failed-silent", sensorId, outputPath, detailFile }
				: {
						result: "failed-with-notice",
						sensorId,
						outputPath,
						detailFile,
						writerNotice,
					},
	};
}
