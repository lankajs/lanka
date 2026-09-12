import { playgroundAppValidator } from "../playground-app-validator/playgroundAppValidator";
import type { IPlaygroundGatewayCall } from "../_interfaces/IPlaygroundGatewayCall";

/**
 * One gateway, serving features written in four schema dialects.
 *
 * This is the shape the hub exists for. Without it the gateway would need a
 * validator per feature — and a `validator` parameter threaded through every
 * call site is how an application discovers, two years in, that it has four of
 * them and no rule about which to use.
 *
 * What it gives up is inference: `read` cannot know the output type across four
 * dialects, so the caller names it. One more reason to have chosen one library.
 */
export const createPlaygroundGateway = () => ({
	/** A body that fails is a broken contract: it throws, naming the call. */
	read<TOutput>(call: IPlaygroundGatewayCall, body: unknown): TOutput {
		return playgroundAppValidator.validate<TOutput>(call.schema, body, call.context);
	},

	/** The form's path: a failure is ordinary and comes back as messages. */
	submit<TOutput>(call: IPlaygroundGatewayCall, body: unknown) {
		return playgroundAppValidator.validateSafe<TOutput>(call.schema, body);
	},
});
