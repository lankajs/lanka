import { caseConvert } from "../../../_internal/case-convert/caseConvert";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import { lankaVMRecipes } from "../../../viewmodel/_internal/lanka-vm-recipes/lankaVMRecipes";
import type { LankaScenarioVMRegistry } from "../../../scenario/_registries/lanka-scenario-vm-registry/LankaScenarioVMRegistry";
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
 *
 * The same rule decides how a ViewModel becomes a scope's own: it is RESOLVED
 * in it, `resolveLankaVM(definition, { scope })`, never captured by having been
 * built while some callback ran. Those leave with the scope too — off the bus
 * and out of the registry.
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

export function createLankaScope(
	singletons: LankaSingletonLocator,
	viewModels: LankaScenarioVMRegistry,
): ILankaScope {
	const instances = new Map<string, unknown>();
	let disposed = false;

	const scope: ILankaScope = {
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

			// ViewModels first: a handler may still reach a service below.
			for (const viewModel of lankaVMRecipes.release(scope)) {
				try {
					viewModel.resetScenario();
				} catch (error) {
					lankaLogger.printBootstrapLog(
						"Failed to reset a ViewModel's scenarios in the scope",
						error instanceof Error ? error.message : String(error),
					);
				}
				viewModels.unregister(viewModel);
			}

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

	return scope;
}
