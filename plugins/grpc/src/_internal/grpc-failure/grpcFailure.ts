import { LankaError, type TLankaErrorKind } from "lanka/errors";

/**
 * The sixteen gRPC status codes, by name.
 *
 * The NAME is what reaches the application as `LankaError.code`, because
 * `error.code === "PERMISSION_DENIED"` is a line somebody can read and
 * `error.code === "7"` is a line somebody has to look up.
 */
const STATUS_NAMES: Record<number, string> = {
	1: "CANCELLED",
	2: "UNKNOWN",
	3: "INVALID_ARGUMENT",
	4: "DEADLINE_EXCEEDED",
	5: "NOT_FOUND",
	6: "ALREADY_EXISTS",
	7: "PERMISSION_DENIED",
	8: "RESOURCE_EXHAUSTED",
	9: "FAILED_PRECONDITION",
	10: "ABORTED",
	11: "OUT_OF_RANGE",
	12: "UNIMPLEMENTED",
	13: "INTERNAL",
	14: "UNAVAILABLE",
	15: "DATA_LOSS",
	16: "UNAUTHENTICATED",
};

/**
 * Which of the framework's kinds a status is, and why each mapping is that one.
 *
 * Sixteen codes into five kinds, and the mapping is a DECISION rather than a
 * table lookup: each kind means something different to the interface, and
 * getting one wrong shows the user an error for leaving a screen or offers a
 * retry of something that will never work.
 */
const STATUS_KINDS: Record<number, TLankaErrorKind> = {
	// The caller went away. Nothing to show — the user left.
	1: "aborted",
	// The deadline passed. Shown, and worth another try, exactly like an HTTP one.
	4: "timeout",
	// The server is not reachable. A retry is the right offer.
	14: "network",
	// The route exists in nobody's build, or the server broke. Neither is the
	// user's doing and neither is a deliberate refusal, so `http` rather than
	// `domain`: an error boundary, not a message.
	12: "http",
	13: "http",
};

/**
 * A gRPC status as a failure the application can branch on.
 *
 * Everything unlisted is `domain`: the server reached the handler and refused on
 * purpose — not found, already exists, permission denied, failed precondition.
 * That is what `domain` is for, and it is the kind retry policy leaves alone.
 */
export const grpcFailure = (status: number, message: string, body?: unknown): LankaError =>
	new LankaError({
		kind: STATUS_KINDS[status] ?? "domain",
		message: message || `The call failed with gRPC status ${String(status)}.`,
		code: STATUS_NAMES[status] ?? `GRPC_${String(status)}`,
		body,
	});
