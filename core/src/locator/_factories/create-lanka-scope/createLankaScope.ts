import { caseConvert } from "../../../_internal/case-convert/caseConvert";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import type { LankaSingletonLocator } from "../../singleton/lanka-singleton-locator/LankaSingletonLocator";

/**
 * A service lifetime other than "as long as the application lives".
 *
 * Everything resolved through `lankaSingletons.*` is a singleton for the life of
 * the app. Per-route, per-session and per-modal lifetimes otherwise rest on
 * discipline: every ViewModel calling `resetScenario()` and writing its own
 * `onReset`, in any of which it can be forgotten.
 *
 * A scope provides the same by construction: an object created in it goes away
 * with it, and nobody has to remember.
 *
 * ## What a scope does NOT do
 *
 * It does not shadow root objects and does not take them on close. It takes only
 * ITS OWN — the ones it created. A scope taking others' would be more dangerous
 * than no scopes at all: closing a screen would break the app.
 */
export interface ILankaScope {
	/** Resolves a service in this scope, creating it on first use. */
	resolve<TInstance>(propertyName: string): TInstance;
	/** Disposes everything this scope created and closes it. Idempotent. */
	dispose(): void;
	/** Whether the scope is closed. */
	isDisposed(): boolean;
}

/** A service may have a `dispose` — or may not. */
interface IMaybeDisposable {
	dispose?: () => void;
}

export function createLankaScope(singletons: LankaSingletonLocator): ILankaScope {
	const instances = new Map<string, unknown>();
	let disposed = false;

	return {
		resolve<TInstance>(propertyName: string): TInstance {
			if (disposed) {
				// Resolving from a closed scope is almost always a reference leaked from
				// an already-unmounted screen. Silently handing out an object would
				// extend the life of what was closed, invisibly.
				throw new Error(
					`The scope is closed: "${propertyName}" can no longer be resolved in it. ` +
						`This is usually a scope reference that outlived the screen that created it.`,
				);
			}

			const className = caseConvert(propertyName, "pascalCase");
			if (instances.has(className)) return instances.get(className) as TInstance;

			// The class comes from the root locator while the OBJECT is created here:
			// a scope is a different lifetime, not a different set of services.
			const instance = singletons.createScopedInstance(className, propertyName);
			instances.set(className, instance);
			return instance as TInstance;
		},

		dispose(): void {
			if (disposed) return;
			disposed = true;

			for (const [name, instance] of instances) {
				const disposable = instance as IMaybeDisposable;
				if (typeof disposable.dispose !== "function") continue;
				try {
					disposable.dispose();
				} catch (error) {
					// One failure must not leave the rest alive: that is exactly what a
					// scope exists to prevent.
					lankaLogger.printBootstrapLog(
						`Failed to dispose "${name}" in the scope`,
						error instanceof Error ? error.message : String(error),
					);
				}
			}

			instances.clear();
		},

		isDisposed: () => disposed,
	};
}
