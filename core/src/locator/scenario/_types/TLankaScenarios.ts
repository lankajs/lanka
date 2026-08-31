/**
 * Scenario classes read from the consumer's barrel.
 *
 * Adding one takes two steps and no registration:
 *
 * 1. write a class extending `ALankaScenario`;
 * 2. add ONE export line to `.lanka_di/lankaScenarios.ts` at the project root.
 *
 * The type below is derived from that module's exports, so the property name
 * and the instance type appear by themselves.
 */
import * as ScenariosModule from "@lanka_di/Scenarios";

/**
 * Turns a PascalCase class name into a camelCase property name: `SessionUpdated` → `sessionUpdated`.
 */
type TPascalToCamelCase<S extends string> = S extends `${infer P1}${infer P2}`
	? `${Lowercase<P1>}${P2}`
	: S;

/** Extracts the scenario name from the constructor. */
type TExtractScenarioName<T> = T extends new () => infer Instance
	? Instance extends { readonly name: infer N }
		? N extends string
			? N
			: never
		: never
	: never;

/** Derives the property name from a scenario constructor. */
type TScenarioPropertyName<T> = TPascalToCamelCase<TExtractScenarioName<T>>;

/** Whether the type is a scenario class — a constructor yielding a named instance. */
type TIsScenarioClass<T> = T extends new () => infer Instance
	? Instance extends { readonly name: string }
		? true
		: false
	: false;

/**
 * Builds the scenario type from every export of the barrel.
 *
 * Derived automatically; no list has to be maintained by hand.
 */
export type TLankaScenarios = {
	[
		K in keyof typeof ScenariosModule as TIsScenarioClass<
			(typeof ScenariosModule)[K]
		> extends true
			? TScenarioPropertyName<(typeof ScenariosModule)[K]>
			: never
	]: (typeof ScenariosModule)[K] extends new () => infer Instance ? Instance : never;
};
