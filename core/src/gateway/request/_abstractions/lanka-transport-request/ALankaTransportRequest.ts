import { ALankaRequest } from "../lanka-request/ALankaRequest";
import { LankaError } from "../../../../errors/lanka-error/LankaError";
import { getLankaFlags } from "../../../../config/get-lanka-flags/getLankaFlags";
import { getLankaHost } from "../../../../config/get-lanka-host/getLankaHost";
import type { ILankaTransport } from "../../../_interfaces/ILankaTransport";
import type { TLankaRequestInit } from "../../../_types/TLankaRequestInit";
import type { TLankaErrorHandler } from "../../../../errors/_types/TLankaErrorHandler";

export interface ILankaTransportRequestConfig<TOptions> {
	transport?: ILankaTransport<TOptions>;
	errorHandler?: TLankaErrorHandler;
	useMock?: boolean;
}

/**
 * The shape every fetch-backed request has: mock, send, check, parse.
 *
 * The concrete requests differ in ONE place — how they turn a successful
 * `Response` into a value — so a third kind is a subclass with one method rather
 * than a third copy of the sequence.
 *
 * The default transport stays a constructor PARAMETER even though both shipped
 * kinds pass the same one. It is the seam a request kind that is not fetch-backed
 * comes through: this template is the mock/send/check/parse sequence, and nothing
 * in it is about HTTP. Defaulting the parameter here would fix `TOptions` to
 * fetch options for everyone who reuses the sequence.
 */
export abstract class ALankaTransportRequest<
	TOptions = TLankaRequestInit,
> extends ALankaRequest<TOptions> {
	protected readonly transport: ILankaTransport<TOptions>;

	protected constructor(
		config: ILankaTransportRequestConfig<TOptions>,
		createDefaultTransport: () => ILankaTransport<TOptions>,
	) {
		const flags = getLankaFlags();

		super({
			errorHandler: config.errorHandler,
			useMock: config.useMock ?? flags.isMockMode ?? false,
		});

		this.transport = config.transport ?? createDefaultTransport();
	}

	protected async request<TReturn>(
		endpoint: string,
		options?: TOptions,
		mockHandler?: () => Promise<TReturn>,
	): Promise<TReturn> {
		if (this.useMock && mockHandler) {
			return await mockHandler();
		}

		const response = await this.transport.request(endpoint, options);
		if (!response.ok) return await this.refuse(response);

		return await this.parse<TReturn>(response);
	}

	/**
	 * Turns a successful response into the value the caller asked for.
	 *
	 * The one step that genuinely differs between request kinds.
	 */
	protected abstract parse<TReturn>(response: Response): Promise<TReturn>;

	/**
	 * Refuses an unsuccessful response, and never returns.
	 *
	 * `TLankaErrorHandler` is typed `Promise<never>` — a handler must throw. It is
	 * still CALLED and then followed by a throw, because a handler that breaks its
	 * contract and returns would otherwise hand `undefined` back as if the request
	 * had succeeded, and a non-value must never become a value.
	 */
	protected async refuse(response: Response): Promise<never> {
		if (this.errorHandler) {
			await this.errorHandler(response);
		}

		// Kind `http`, not a bare Error: the server answered, and answered with a
		// code. Without the kind this reads as a network failure, and the user is
		// offered a retry of a request that already got a meaningful answer.
		throw new LankaError({
			kind: "http",
			message: getLankaHost().httpErrorMessage(response.status),
			status: response.status,
		});
	}
}
