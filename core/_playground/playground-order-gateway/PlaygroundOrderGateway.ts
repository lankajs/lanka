import { ALankaGateway, LankaFetchJsonRequest } from "../../src/gateway/index";
import { handleLankaApiError, LankaError } from "../../src/errors/index";
import { lankaStandardValidator } from "../../src/validation/index";
import { playgroundOrderInputSchema } from "../playground-order-input-schema/playgroundOrderInputSchema";
import { readPlaygroundFieldErrors } from "../read-playground-field-errors/readPlaygroundFieldErrors";
import type { ILankaTransport } from "../../src/gateway/index";
import type { IPlaygroundOrder } from "../_interfaces/IPlaygroundOrder";
import type { IPlaygroundOrderInput } from "../_interfaces/IPlaygroundOrderInput";

/** What a caller may attach to a request: the lifetime it belongs to. */
export interface IPlaygroundRequestOptions {
	signal?: AbortSignal;
}

/**
 * Everything the order screens ask of a server.
 *
 * No state and no memory — which is exactly why a cache can sit BESIDE it,
 * called by the same ViewModel: the gateway answers, whoever called decides what
 * to remember. The one thing it does beyond stating endpoints is normalise a
 * refusal into the framework's shape, and it does that here rather than in
 * every screen.
 */
export class PlaygroundOrderGateway extends ALankaGateway<RequestInit> {
	constructor(transport: ILankaTransport<RequestInit>) {
		// `handleLankaApiError` reads a failure's body ONCE and carries it on the
		// error. Without it a 422 arrives as a status and nothing else, and
		// `update` below would have no addresses to read.
		super({
			request: new LankaFetchJsonRequest({ transport, errorHandler: handleLankaApiError }),
			basePath: "/orders",
		});
	}

	list(options: IPlaygroundRequestOptions = {}): Promise<IPlaygroundOrder[]> {
		return this.requestExecutor.execute<IPlaygroundOrder[]>(this.endpoint(), options);
	}

	byId(id: number, options: IPlaygroundRequestOptions = {}): Promise<IPlaygroundOrder> {
		return this.requestExecutor.execute<IPlaygroundOrder>(this.endpoint(String(id)), options);
	}

	/** The asynchronous check a form's input needs — reached through a ViewModel, never from the input. */
	async isCustomerKnown(name: string, options: IPlaygroundRequestOptions = {}): Promise<boolean> {
		const answer = await this.requestExecutor.execute<{ known: boolean }>(
			this.endpoint(`customers/${encodeURIComponent(name)}`),
			options,
		);

		return answer.known;
	}

	/**
	 * Saves what a person edited.
	 *
	 * The payload is checked against the INPUT schema — the same object a form
	 * uses as its resolver, so a value the form let through is a value the
	 * gateway sends. `expectedUpdatedAt` is the version the screen last saw; the
	 * server refuses a save over a newer one.
	 *
	 * A 422 is normalised HERE: the server's `{ errors: { "items.1.qty": [...] } }`
	 * becomes `fields` on the error, so every caller — a ViewModel holding the
	 * inputs, a ViewModel handing them to a form — reads one shape. An
	 * application that installs `@lankajs/plugin-http` configures the same reading
	 * once for every gateway; without it, this is where the lines go.
	 */
	async update(
		id: number,
		input: IPlaygroundOrderInput,
		options: IPlaygroundRequestOptions & { expectedUpdatedAt?: number } = {},
	): Promise<IPlaygroundOrder> {
		const payload = lankaStandardValidator.validate(
			playgroundOrderInputSchema,
			input,
			"orders.update.payload",
		);

		try {
			return await this.requestExecutor.execute<IPlaygroundOrder>(this.endpoint(String(id)), {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ ...payload, updatedAt: options.expectedUpdatedAt }),
				signal: options.signal,
			});
		} catch (error) {
			if (!LankaError.is(error) || error.status !== 422) throw error;

			// Every member copied by name: a `LankaError` is rebuilt, not extended,
			// and a member left out here is a member the screens never see.
			throw new LankaError({
				kind: "http",
				message: error.message,
				status: 422,
				code: error.code,
				issues: error.issues,
				body: error.body,
				cause: error,
				fields: readPlaygroundFieldErrors(error.body),
			});
		}
	}
}
