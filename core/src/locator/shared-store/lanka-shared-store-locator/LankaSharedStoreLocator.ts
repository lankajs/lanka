import { ALankaLocator } from "../../_abstractions/lanka-locator/ALankaLocator";
import { findExportedClass } from "../../_internal/find-exported-class/findExportedClass";
import { ALankaSharedStore } from "../../../viewmodel/_abstractions/lanka-shared-store/ALankaSharedStore";
import * as SharedStoresModule from "@lanka_di/SharedStores";

type TSharedStoreState = object;

/**
 * LankaSharedStoreLocator configuration.
 */
export interface ILankaSharedStoreLocatorConfig {
	/** The module holding shared store classes — the consumer's barrel. */
	sharedStoreIndexModule?: Record<string, unknown>;
}

/**
 * Resolves shared stores by property name (camelCase) or class name
 * (PascalCase), constructing them on first use and caching them.
 */
export class LankaSharedStoreLocator extends ALankaLocator<ALankaSharedStore<TSharedStoreState>> {
	private readonly sharedStoreIndexModule?: Record<string, unknown>;

	constructor(config?: ILankaSharedStoreLocatorConfig) {
		super({
			findClassByName: (className: string) => {
				// Hand-registered classes are read by `ALankaLocator` itself, ahead of
				// this callback. This is only the barrel.
				return (
					findExportedClass<ALankaSharedStore<TSharedStoreState>>(
						SharedStoresModule,
						className,
					) ??
					(this.sharedStoreIndexModule
						? findExportedClass<ALankaSharedStore<TSharedStoreState>>(
								this.sharedStoreIndexModule,
								className,
							)
						: undefined)
				);
			},
			createInstance: (Class) => {
				return new Class();
			},
			notFoundError: (className, propertyName) =>
				`SharedStore "${className}" (accessed as "${propertyName}") not found. ` +
				`Make sure the class extends ALankaSharedStore and is exported from @lanka_di/SharedStores.ts ` +
				`or registered via registerSharedStore method.`,
		});

		this.sharedStoreIndexModule = config?.sharedStoreIndexModule;
	}
}
