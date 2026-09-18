import { atlasApiBaseUrl } from "./Core/Server/atlasApiBaseUrl";
import type { Handle } from "@sveltejs/kit";

/**
 * One place where every request enters, and the only thing this application
 * does there.
 *
 * `handle` wraps the WHOLE render — the `load` functions, the components, the
 * response — which is the shape no other server host here can show: Next's
 * server component is one function, and a Nitro route handler is one call. That
 * makes a hook the natural place for anything that must be true for all of them.
 *
 * ## Why the SCOPE is not opened here
 *
 * It would be the obvious move and it is the wrong one. `runLankaRequest` holds
 * an instance for the duration of a callback, and a `load` function that
 * inherited it from a hook would work without saying so — until somebody called
 * the same function from a script, a test or a queue worker, where no hook ran
 * and the gateway resolves against nothing. A scope that is visible at the call
 * site is a scope a reader can check; one inherited from a hook two files away
 * is a scope that is right by accident.
 *
 * So this hook carries CONFIGURATION, not lifetime: one answer to "where is the
 * API", read once per request instead of once per `load`.
 */
export const handle: Handle = ({ event, resolve }) => {
	event.locals.atlasApiBaseUrl = atlasApiBaseUrl();

	return resolve(event);
};
