import type { TLankaExecuteOptions } from "lanka/gateway";
import type { ILankaGraphqlOperation } from "./ILankaGraphqlOperation";

/**
 * A GraphQL gateway's protected surface, handed to whoever builds one by
 * calling.
 *
 * The names match `ALankaGraphqlGateway`'s protected members exactly, and that
 * is the parity contract: a consumer who switches styles moves the same call
 * from `this.query(...)` to `query(...)` and changes nothing else. Checked by
 * `scripts/check-parity.mjs`.
 */
export interface ILankaGraphqlGatewayContext {
	/** Reads. Answers `data`, or throws the failure the `errors` array described. */
	query: <TReturn>(
		operation: ILankaGraphqlOperation,
		options?: TLankaExecuteOptions<RequestInit>,
		mockHandler?: () => Promise<TReturn>,
	) => Promise<TReturn>;

	/** Writes. The same wire call, under the name that says so. */
	mutate: <TReturn>(
		operation: ILankaGraphqlOperation,
		options?: TLankaExecuteOptions<RequestInit>,
		mockHandler?: () => Promise<TReturn>,
	) => Promise<TReturn>;
}
