import { getLankaFlags } from "../../../config/get-lanka-flags/getLankaFlags";
import { sleep } from "../../../_internal/sleep";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";

/**
 * Builds a mock handler for a gateway method: logging, delay, dynamic module
 * loading and extraction of the data itself.
 *
 * Returns `undefined` while mock mode is off, which is what lets a bundler drop
 * all mock code from a production build.
 *
 * @param importFactory Dynamic import: `() => import("../mocks/user")`
 * @param extractor Extracts and validates data from the imported module
 * @param name Action name for the log; taken from the stack trace when omitted
 * @param delayMs Delay before answering
 * @returns The mock data, or `undefined` when mocks are disabled
 */
export function createLankaMockHandler<T, M>(
	importFactory: () => Promise<M>,
	extractor: (module: M) => T | Promise<T>,
	name?: string,
	delayMs?: number,
): (() => Promise<T>) | undefined {
	const flags = getLankaFlags();

	if (flags.isProduction || !flags.isMockMode) {
		return undefined;
	}

	return async (): Promise<T> => {
		// The action name is a PARAMETER. Deriving it from a stack trace works only
		// until minification: function names disappear in a built bundle, and mock
		// mode is enabled in exactly such a bundle — so the mechanism breaks where
		// it is used.
		//
		// Stack parsing remains as a fallback, for development only, where the
		// stack is still readable.
		const actionName = name ?? readActionNameFromStack() ?? "Unknown";

		lankaLogger.printGatewayLog(`MOCK: ${actionName}`);

		const wait = delayMs ?? 300;
		if (wait > 0) {
			await sleep(wait);
		}

		try {
			const module = await importFactory();
			return await extractor(module);
		} catch (error) {
			lankaLogger.printGatewayLog(
				`MOCK ERROR (${actionName}): Failed to load or extract mock`,
				error,
			);
			throw error;
		}
	};
}

/**
 * Extracts a gateway method name from a stack trace.
 *
 * A fallback, and an unreliable one: in built code function names are minified
 * and there is nothing to read. Returns `undefined` rather than an invented
 * name.
 */
function readActionNameFromStack(): string | undefined {
	try {
		const stack = new Error().stack;
		if (!stack) return undefined;

		const lines = stack.split(String.fromCharCode(10));
		for (let i = 3; i < lines.length; i++) {
			const match = /\.(\w+)\s*\(/.exec(lines[i]);
			const methodName = match?.[1];
			if (methodName && !["requestJson", "request", "execute"].includes(methodName)) {
				return methodName;
			}
		}
	} catch {
		// Stack format is not standardised; a missing name is no reason to throw.
	}
	return undefined;
}
