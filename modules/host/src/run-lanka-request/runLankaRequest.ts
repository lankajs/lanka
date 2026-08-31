import { forwardLankaHeaders } from "../_internal/forward-lanka-headers/forwardLankaHeaders";
import { readLankaHeaders } from "../_internal/read-lanka-headers/readLankaHeaders";
import { runInLankaServerScope } from "../_internal/run-in-lanka-server-scope/runInLankaServerScope";
import type { TLankaIncomingHeaders } from "../_types/TLankaIncomingHeaders";
import type { ILankaInstance, TLankaStartConfig } from "lanka";

/** What one request's scope takes beyond the ordinary start-up configuration. */
export type TLankaRequestConfig = TLankaStartConfig & {
	/**
	 * The incoming request's headers — Next's `headers()`, a loader's
	 * `request.headers`, or a plain object.
	 *
	 * Only `cookie` and `authorization` cross by default; `forward` changes which.
	 */
	readonly headers?: TLankaIncomingHeaders;
	/** Which header names may cross into the API call. */
	readonly forward?: readonly string[];
};

/**
 * Runs one request's work against an instance nobody else can see.
 *
 * For every mode where a USER is waiting: SSR, a React Server Component, a React
 * Router or TanStack Start loader, a server function, a server action, and each
 * chunk of a streamed render.
 *
 * ```ts
 * export async function loader({ request, params }) {
 * 	return runLankaRequest(
 * 		{ apiBaseUrl: process.env.API_URL, headers: request.headers },
 * 		() => lankaGateways.userGateway.byId(params.id),
 * 	);
 * }
 * ```
 *
 * What this buys is the gateway layer, unchanged: the same class the browser
 * calls, the same tagged failures, the same validated body, the same request
 * middleware — reached from the host's server side. One definition, two
 * environments.
 *
 * ## Why an instance per request and not one per process
 *
 * Every ambient facade — `lankaEventBus.dispatch`, `lankaSingletons.foo`,
 * `getLankaFlags()` — asks which instance is active. On a server, "the one this
 * process created last" is the wrong answer the moment two requests overlap: the
 * second would answer for the first. `AsyncLocalStorage` resolves the question
 * per async context, which is what a request is.
 *
 * ## Pass the headers
 *
 * Omitting them is legal and sometimes right — a public API needs no identity —
 * but it is also how a signed-in page renders signed out and then flips on
 * hydration. See `forwardLankaHeaders`.
 *
 * ## What NOT to do inside
 *
 * ViewModels. A ViewModel is a module-level zustand store read through React
 * hooks: one per PROCESS, shared by everybody this server is talking to. Fetch
 * here, hand the data to the browser as props, and let `hydrateLankaVM` make it
 * the first state a screen reads.
 */
export const runLankaRequest = async <TResult>(
	config: TLankaRequestConfig,
	work: (lanka: ILankaInstance) => Promise<TResult> | TResult,
): Promise<TResult> => {
	const headers = config.headers ? readLankaHeaders(config.headers, config.forward) : {};

	return runInLankaServerScope(config, [forwardLankaHeaders(headers)], work);
};
