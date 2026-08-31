/**
 * Gateway classes read from the consumer's barrel.
 *
 * Adding one takes two steps and no registration:
 *
 * 1. write a class extending `ALankaGateway`;
 * 2. add ONE export line to `.lanka_di/lankaGateways.ts` at the project root.
 *
 * The type below is derived from that module's exports, so the property name
 * and the instance type appear by themselves.
 */
import * as GatewaysModule from "@lanka_di/Gateways";
import type { ALankaGateway } from "../../../gateway/_abstractions/lanka-gateway/ALankaGateway";

/**
 * Turns a PascalCase class name into a camelCase property name: `UserGateway` → `userGateway`.
 */
type TPascalToCamelCase<S extends string> = S extends `${infer P1}${infer P2}`
	? `${Lowercase<P1>}${P2}`
	: S;

/** Whether the type is a gateway class — an `ALankaGateway` subclass. */
type TIsGatewayClass<T> = T extends new () => infer Instance
	? Instance extends ALankaGateway<unknown>
		? true
		: false
	: false;

/**
 * Builds the gateway type from every export of the barrel.
 *
 * Derived automatically; no list has to be maintained by hand.
 */
export type TLankaGateways = {
	[
		K in keyof typeof GatewaysModule as TIsGatewayClass<(typeof GatewaysModule)[K]> extends true
			? TPascalToCamelCase<K & string>
			: never
	]: (typeof GatewaysModule)[K] extends new () => infer Instance ? Instance : never;
};
