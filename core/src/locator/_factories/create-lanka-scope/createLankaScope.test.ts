import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { ALankaSingleton } from "../../singleton/_abstractions/lanka-singleton/ALankaSingleton";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "../../../bootstrap/_factories/create-lanka/createLanka";

/**
 * A scope: a service lifetime other than "as long as the application lives".
 *
 * ## What this fixes
 *
 * Everything resolved through `lankaSingletons.*` is a singleton for the life
 * of the application. Per-route, per-session and per-modal lifetimes otherwise
 * rest on discipline: every ViewModel calling `resetScenario()` and writing its
 * own `onReset`.
 *
 * A scope also closes the lazy-ViewModel leak: created in a route's scope, it
 * goes away with the route and nobody has to remember `dispose()`.
 */

class CountedService extends ALankaSingleton {
	static created = 0;
	static disposed = 0;
	readonly id: number;

	constructor() {
		super();
		CountedService.created += 1;
		this.id = CountedService.created;
	}

	dispose(): void {
		CountedService.disposed += 1;
	}
}

describe("locator scopes", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		CountedService.created = 0;
		CountedService.disposed = 0;
		lanka = createLanka({ host: lankaTestHost });
	});

	it("a scope resolves its own instance, not the root one", () => {
		lanka.locators.singletons.register("CountedService", CountedService);

		const root = lanka.resolve<CountedService>("countedService");
		const scope = lanka.createScope();
		const scoped = scope.resolve<CountedService>("countedService");

		expect(scoped).not.toBe(root);
		expect(CountedService.created).toBe(2);
	});

	it("within one scope the object is the same", () => {
		lanka.locators.singletons.register("CountedService", CountedService);
		const scope = lanka.createScope();

		expect(scope.resolve("countedService")).toBe(scope.resolve("countedService"));
	});

	it("two scopes do not share an object", () => {
		lanka.locators.singletons.register("CountedService", CountedService);

		const first = lanka.createScope().resolve<CountedService>("countedService");
		const second = lanka.createScope().resolve<CountedService>("countedService");

		expect(first.id).not.toBe(second.id);
	});

	it("a scope's `dispose()` disposes its objects and leaves the root ones alone", () => {
		lanka.locators.singletons.register("CountedService", CountedService);
		const root = lanka.resolve<CountedService>("countedService");

		const scope = lanka.createScope();
		scope.resolve("countedService");
		scope.dispose();

		expect(CountedService.disposed).toBe(1);
		// The root object survives: a scope takes ITS OWN, not everything it saw.
		expect(lanka.resolve<CountedService>("countedService")).toBe(root);
	});

	it("an object without `dispose` does not block scope disposal", () => {
		class Plain extends ALankaSingleton {}
		lanka.locators.singletons.register("Plain", Plain);

		const scope = lanka.createScope();
		scope.resolve("plain");

		expect(() => scope.dispose()).not.toThrow();
	});

	it("one failing `dispose` does not stop the others", () => {
		// Otherwise one broken service would leave a tail of live objects behind —
		// exactly what a scope exists to prevent.
		class Angry extends ALankaSingleton {
			dispose(): void {
				throw new Error("refusing");
			}
		}
		lanka.locators.singletons.register("Angry", Angry);
		lanka.locators.singletons.register("CountedService", CountedService);

		const scope = lanka.createScope();
		scope.resolve("angry");
		scope.resolve("countedService");

		expect(() => scope.dispose()).not.toThrow();
		expect(CountedService.disposed).toBe(1);
	});

	it("a closed scope hands out no new objects", () => {
		lanka.locators.singletons.register("CountedService", CountedService);
		const scope = lanka.createScope();
		scope.dispose();

		// Resolving from a closed scope is almost always a reference leaked from an
		// already-unmounted screen. Silently handing out an object would extend the
		// life of what was closed.
		expect(() => scope.resolve("countedService")).toThrowError(/closed/i);
	});

	it("a scope's `dispose()` is idempotent", () => {
		lanka.locators.singletons.register("CountedService", CountedService);
		const scope = lanka.createScope();
		scope.resolve("countedService");

		scope.dispose();
		scope.dispose();

		expect(CountedService.disposed).toBe(1);
	});

	it("disposing the instance disposes its scopes too", () => {
		lanka.locators.singletons.register("CountedService", CountedService);
		const scope = lanka.createScope();
		scope.resolve("countedService");

		lanka.dispose();

		expect(CountedService.disposed).toBe(1);
	});

	it("a scope calls the factory exactly once per object", () => {
		const factory = vi.fn(() => new CountedService());
		lanka.locators.singletons.register("CountedService", CountedService);
		const scope = lanka.createScope();

		scope.resolve("countedService");
		scope.resolve("countedService");

		expect(CountedService.created).toBe(1);
		expect(factory).not.toHaveBeenCalled();
	});
});
