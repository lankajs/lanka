import { ALankaGateway, type IALankaGatewayConfig, type TLankaExecuteOptions } from "lanka/gateway";
import { LankaGraphqlRequest } from "../../lanka-graphql-request/LankaGraphqlRequest";
import { readLankaGraphqlDocument } from "../../read-lanka-graphql-document/readLankaGraphqlDocument";
import type { ILankaGraphqlOperation } from "../../_interfaces/ILankaGraphqlOperation";

/** What a GraphQL gateway is built from, whichever style builds it. */
export interface IALankaGraphqlGatewayConfig extends IALankaGatewayConfig<RequestInit> {
	/** Endpoint path, relative to `host.apiBaseUrl`. Defaults to `/graphql`. */
	basePath?: string;
}

/** Everything a GraphQL POST needs, before the caller's own options. */
const bodyOf = (operation: ILankaGraphqlOperation): string =>
	JSON.stringify({
		query: readLankaGraphqlDocument(operation.document),
		variables: operation.variables,
		operationName: operation.operationName,
	});

/**
 * A gateway that talks GraphQL.
 *
 * ## What it is, and what it is not
 *
 * It is an `ALankaGateway` whose request kind is `LankaGraphqlRequest` and whose
 * `basePath` is one endpoint. That is nearly the whole of it: GraphQL has one
 * URL and one method, so almost everything a REST gateway spends its shape on —
 * paths, verbs, query parameters — has no counterpart here, and the two methods
 * below are what is left.
 *
 * It is NOT a client: no cache, no normalisation, no fragment registry. A
 * ViewModel already owns the state a screen reads, and a second store under it
 * is the arrangement `ARCHITECTURE.md` argues against — two places holding one
 * truth, kept in step by hand.
 *
 * ## `query` and `mutate` are the same POST
 *
 * Deliberately both, and the docblock says the quiet part: on the wire they are
 * identical, because GraphQL sends everything as a POST to one URL. The name is
 * therefore the ONLY place a call says whether it changes anything — not the
 * method, not the path, not a log line. That is worth a second member.
 *
 * ## Writing one
 *
 * ```ts
 * class TodoGateway extends ALankaGraphqlGateway {
 *   public list() {
 *     return this.query<{ todos: ITodo[] }>({ document: TODOS });
 *   }
 * }
 * ```
 *
 * A subclass MUST implement nothing — the base is abstract to say "write one of
 * these", not to demand a member. It MAY call `query` and `mutate`, and it
 * replaces the request kind through `request` in the config rather than by
 * overriding anything: that is the seam a test uses, and a persisted-query
 * transport after it.
 */
export abstract class ALankaGraphqlGateway extends ALankaGateway<RequestInit> {
	// The constructor is PUBLIC: the class is abstract and cannot be constructed
	// on its own, while `protected` is inherited — and the application's subclass
	// would then be unreachable to the code that creates it.
	public constructor(config: IALankaGraphqlGatewayConfig = {}) {
		super({
			...config,
			basePath: config.basePath ?? "/graphql",
			request: config.request ?? new LankaGraphqlRequest(),
		});
	}

	/** Reads. Answers `data`, or throws the failure the `errors` array described. */
	protected query<TReturn>(
		operation: ILankaGraphqlOperation,
		options?: TLankaExecuteOptions<RequestInit>,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		return this.request<TReturn>("", this.post(operation, options), mockHandler);
	}

	/** Writes. The same wire call, under the name that says so. */
	protected mutate<TReturn>(
		operation: ILankaGraphqlOperation,
		options?: TLankaExecuteOptions<RequestInit>,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		return this.request<TReturn>("", this.post(operation, options), mockHandler);
	}

	/**
	 * The POST, with the caller's options over the top.
	 *
	 * Headers are MERGED rather than replaced: a caller adding an authorization
	 * header would otherwise silently drop the content type, and the server would
	 * answer `400` about a body it never tried to parse.
	 */
	private post(
		operation: ILankaGraphqlOperation,
		options?: TLankaExecuteOptions<RequestInit>,
	): TLankaExecuteOptions<RequestInit> {
		return {
			method: "POST",
			...options,
			headers: {
				"content-type": "application/json",
				accept: "application/graphql-response+json, application/json",
				...(options?.headers as Record<string, string> | undefined),
			},
			body: bodyOf(operation),
		};
	}
}
