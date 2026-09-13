/**
 * Headers every answer carries, including the failures.
 *
 * The applications are served from a dev server on another port, so every
 * response is cross-origin. The origin is ECHOED rather than `*`, because the
 * two cannot be combined: a browser refuses a credentialed request answered with
 * a wildcard, and a cookie session would then work in the node tests and nowhere
 * else.
 */
export const atlasCorsHeaders = (origin: string | undefined): Record<string, string> => ({
	"access-control-allow-origin": origin ?? "*",
	"access-control-allow-credentials": "true",
	"access-control-allow-headers":
		"content-type, authorization, idempotency-key, x-atlas-csrf, x-atlas-client",
	"access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
	/*
	 * The headers a browser will not show a script unless they are named.
	 *
	 * Without this, `response.headers.get("grpc-status")` is `null` in a browser
	 * and correct in every node test — the gap that makes a gRPC refusal arrive
	 * as a schema failure on the client and nowhere else.
	 */
	"access-control-expose-headers": "grpc-status, grpc-message, idempotency-key",
});
