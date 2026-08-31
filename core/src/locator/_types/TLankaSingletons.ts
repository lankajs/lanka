/**
 * Singleton classes, read from the consumer's barrel.
 *
 * Adding one takes two steps and no registration:
 *
 * 1. write the class;
 * 2. add ONE export line to `.lanka_di/lankaSingletons.ts` at the project root.
 *
 * The type below is derived from that module's exports, so the property name
 * and the instance type appear by themselves.
 */
import * as SingletonsModule from "@lanka_di/Singletons";
import type { ALankaSingleton } from "../singleton/_abstractions/lanka-singleton/ALankaSingleton";

/**
 * Turns a PascalCase class name into a camelCase property name: `UserProfile` → `userProfile`.
 */
type TPascalToCamelCase<S extends string> = S extends `${infer P1}${infer P2}`
	? `${Lowercase<P1>}${P2}`
	: S;

/** Whether a type is a class constructor. */
/**
 * A class marked as a singleton.
 *
 * Selecting on "is a constructor" admits anything, so a stray barrel export
 * silently becomes part of the public `lankaSingletons.*` and a typo is caught at
 * runtime on first use.
 */
type TIsSingletonClass<T> = T extends new () => infer Instance
	? Instance extends ALankaSingleton
		? true
		: false
	: false;

/**
 * Builds the singletons type from the barrel's exports.
 *
 * Derived automatically; no list has to be maintained by hand.
 */
export type TLankaSingletons = {
	[
		K in keyof typeof SingletonsModule as TIsSingletonClass<
			(typeof SingletonsModule)[K]
		> extends true
			? TPascalToCamelCase<K & string>
			: never
	]: (typeof SingletonsModule)[K] extends new () => infer Instance ? Instance : never;
};
