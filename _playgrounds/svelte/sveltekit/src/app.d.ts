/**
 * What this application adds to Kit's own types.
 *
 * `App.Locals` is the one that matters: `hooks.server.ts` writes the API base
 * URL there so a `load` function reads ONE answer rather than each one reading
 * the environment for itself. Declaring it is what makes `event.locals` typed
 * instead of `any` in every route.
 */
declare global {
	namespace App {
		interface Locals {
			atlasApiBaseUrl: string;
		}
	}
}

export {};
