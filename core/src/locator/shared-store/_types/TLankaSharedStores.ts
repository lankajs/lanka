/**
 * Shared-store classes read from the consumer's barrel.
 *
 * Adding one takes two steps and no registration:
 *
 * 1. write a class extending `ALankaSharedStore`;
 * 2. add ONE export line to `.lanka_di/lankaSharedStores.ts` at the project root.
 *
 * The type below is derived from that module's exports, so the property name
 * and the instance type appear by themselves.
 */
import * as SharedStoresModule from "@lanka_di/SharedStores";
import { ALankaSharedStore } from "../../../viewmodel/_abstractions/lanka-shared-store/ALankaSharedStore";

/**
 * Turns a PascalCase class name into a camelCase property name: `RoleEditorStore` → `roleEditorStore`.
 */
type TPascalToCamelCase<S extends string> = S extends `${infer P1}${infer P2}`
	? `${Lowercase<P1>}${P2}`
	: S;

/** Whether the type is a shared-store class. */
type TIsSharedStoreClass<T> = T extends new () => infer Instance
	? Instance extends ALankaSharedStore<object>
		? true
		: false
	: false;

/**
 * Builds the shared-store type from every export of the barrel.
 *
 * Derived automatically; no list has to be maintained by hand.
 */
export type TLankaSharedStores = {
	[
		K in keyof typeof SharedStoresModule as TIsSharedStoreClass<
			(typeof SharedStoresModule)[K]
		> extends true
			? TPascalToCamelCase<K & string>
			: never
	]: (typeof SharedStoresModule)[K] extends new () => infer Instance ? Instance : never;
};
