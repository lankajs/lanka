import { createLanka, resetActiveLanka } from "lanka/bootstrap";
import { lankaTestHost } from "./lankaTestHost";
import type { ILankaInstance } from "lanka/bootstrap";
import type { ILankaHost } from "lanka/config";

/**
 * A clean framework before every test.
 *
 * ## A kit function rather than a line in someone's `beforeEach`
 *
 * Without a public way to start over, tests reach into internal registries
 * directly, and any registry refactor breaks all of them at once.
 *
 * ## A NEW instance rather than cleaning the old one
 *
 * Cleaning leaves behind whatever nobody remembered to clean — exactly the class
 * of failure an instance removes: a fresh object cannot carry someone else's
 * state by oversight.
 *
 * The host is the test host: a test that is not about the host has no reason to
 * declare one, and `createLanka` requires it — rightly.
 */
/**
 * The instance created by the PREVIOUS call.
 *
 * Kept because dropping an instance is not the same as disposing it. ViewModels
 * are declared at module level and outlive any test; their subscriptions are
 * removed by the `dispose()` of the instance whose registry holds them. Merely
 * moving the pointer to a new instance leaves the previous test's subscriptions
 * alive, and the second test receives events the first subscribed to.
 */
let previous: ILankaInstance | null = null;

export function resetLanka(host: ILankaHost = lankaTestHost): ILankaInstance {
	// Order matters: dispose the previous one first, then release the pointer.
	// Disposal goes through the active instance, and clearing the pointer early
	// would leave it disposing into nothing.
	previous?.dispose();
	resetActiveLanka();

	previous = createLanka({ host });
	return previous;
}
