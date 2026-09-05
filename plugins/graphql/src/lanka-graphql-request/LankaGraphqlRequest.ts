import { ALankaRequest, LankaFetchTransport, type ILankaTransport } from "lanka/gateway";
import { LankaError, type TLankaErrorHandler } from "lanka/errors";
import { getLankaHost } from "lanka/config";

/** One entry of a GraphQL `errors` array, as far as this package reads it. */
export interface ILankaGraphqlError {
	message: string;
	path?: readonly (string | number)[];
	extensions?: Record<string, unknown>;
}

export interface ILankaGraphqlRequestConfig<TOptions = RequestInit> {
	/** What puts bytes on the wire. Defaults to `LankaFetchTransport`. */
	transport?: ILankaTransport<TOptions>;
	/** Reads a non-2xx body before the failure is thrown. */
	errorHandler?: TLankaErrorHandler;
	/** Answer mock handlers instead of sending. Defaults to the instance flag. */
	useMock?: boolean;
	/**
	 * Called when the answer carries BOTH data and errors.
	 *
	 * A partial result is not a failure: some nullable field resolved to `null`
	 * and said why, and the page rendered. Throwing would discard a page that
	 * worked; ignoring it silently would lose the only report anybody gets. So the
	 * data is returned and the errors are handed here — to a log, a toast, a
	 * counter.
	 */
	onPartialErrors?: (errors: readonly ILankaGraphqlError[]) => void;
}

interface IGraphqlBody {
	data?: unknown;
	errors?: readonly ILankaGraphqlError[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The `errors` array, when the body has one with something in it. */
const errorsOf = (body: IGraphqlBody): readonly ILankaGraphqlError[] | null => {
	const errors = body.errors;
	if (!Array.isArray(errors) || errors.length === 0) return null;

	return errors as readonly ILankaGraphqlError[];
};

/**
 * The failure code the application branches on.
 *
 * `extensions.code` is where every GraphQL server that has a code puts one —
 * Apollo, graphql-js, Hasura — and it is the field `LankaError.code` exists for.
 */
const codeOf = (errors: readonly ILankaGraphqlError[]): string | undefined => {
	const code = errors[0]?.extensions?.code;
	return typeof code === "string" ? code : undefined;
};

/**
 * A GraphQL operation as a request kind.
 *
 * ## The reason this class exists
 *
 * **GraphQL answers `200 OK` with an `errors` array.** Sent through an ordinary
 * JSON request that is a SUCCESS carrying a body the screen then has to inspect,
 * so every application grows the same helper — and the ones that forget show a
 * spinner over a failed mutation until the user reloads.
 *
 * Here it becomes `LankaError` with `kind: "domain"`, which is the kind the
 * framework already has for a server refusing deliberately and naming the
 * reason. Retry policy leaves it alone, the error boundary shows what the server
 * said, and nothing above had to learn that this endpoint is GraphQL.
 *
 * ## What is a failure and what is not
 *
 * | Answer                    | Result                                  |
 * | ------------------------- | --------------------------------------- |
 * | non-2xx                   | `http` — the transport layer refused    |
 * | `errors`, `data` null     | `domain` — the operation was refused    |
 * | `errors`, `data` present  | the data, and `onPartialErrors` is told |
 * | no `data` key at all      | `schema` — this is not a GraphQL answer |
 *
 * The third row is the one worth arguing about, and it is not a judgement call:
 * a partial result means a nullable field resolved to `null` and said why, while
 * the rest of the page resolved. Throwing it away is throwing away a page that
 * rendered.
 *
 * ## The body it sends
 *
 * `{ query, variables, operationName }`, as `POST` with a JSON content type,
 * and the options the caller passed are spread over that — so a header, a
 * credentials mode or a persisted-query field is added without this class
 * knowing about it.
 */
export class LankaGraphqlRequest<TOptions = RequestInit> extends ALankaRequest<TOptions> {
	private readonly transport: ILankaTransport<TOptions>;
	private readonly onPartialErrors?: (errors: readonly ILankaGraphqlError[]) => void;

	public constructor(config: ILankaGraphqlRequestConfig<TOptions> = {}) {
		super({ errorHandler: config.errorHandler, useMock: config.useMock });
		this.transport =
			config.transport ?? (new LankaFetchTransport() as ILankaTransport<TOptions>);
		this.onPartialErrors = config.onPartialErrors;
	}

	protected async request<TReturn = Response>(
		endpoint: string,
		options?: TOptions,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		if (this.useMock && mockHandler) return await mockHandler();

		const response = await this.transport.request(endpoint, options);
		if (!response.ok) return await this.refuse(response);

		return this.unwrap<TReturn>(await this.read(response));
	}

	/** Refuses a non-2xx response, and never returns. */
	private async refuse(response: Response): Promise<never> {
		if (this.errorHandler) await this.errorHandler(response);

		// `http`, not `domain`: the server never got as far as the resolvers, so
		// what failed is the transport layer and the status is what says how.
		throw new LankaError({
			kind: "http",
			message: getLankaHost().httpErrorMessage(response.status),
			status: response.status,
		});
	}

	/** The body, or a named failure when it is not JSON at all. */
	private async read(response: Response): Promise<IGraphqlBody> {
		const text = await response.text();
		try {
			const parsed: unknown = JSON.parse(text);
			if (isRecord(parsed)) return parsed;
		} catch {
			/* Fall through to the one message that names what actually happened. */
		}

		// A dev server whose `/graphql` fell through to the SPA fallback answers
		// `200 text/html`. Called a network failure it invites a retry; called
		// nothing at all it reaches a schema as `undefined`.
		throw new LankaError({
			kind: "schema",
			message: `The GraphQL endpoint answered something that is not JSON: ${text.slice(0, 120)}`,
		});
	}

	/** `data`, or the failure the `errors` array describes. */
	private unwrap<TReturn>(body: IGraphqlBody): TReturn {
		const errors = errorsOf(body);
		const hasData = body.data !== undefined && body.data !== null;

		if (errors && !hasData) {
			throw new LankaError({
				kind: "domain",
				message: errors[0]?.message ?? "The GraphQL operation was refused.",
				code: codeOf(errors),
				issues: errors.map((error) => error.message),
				body,
			});
		}

		if (errors) this.onPartialErrors?.(errors);

		if (!("data" in body)) {
			throw new LankaError({
				kind: "schema",
				message: "The GraphQL answer carried neither `data` nor `errors`.",
				body,
			});
		}

		return body.data as TReturn;
	}
}
