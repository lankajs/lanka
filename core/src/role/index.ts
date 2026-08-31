/**
 * `lanka/role` — defining a layer of your own, in both styles.
 *
 * The framework's nine roles — gateway, request, scenario, ViewModel, shared
 * store, singleton, plugin, bootstrap step, bridge — are each written as a class
 * to extend AND a factory to call, over one implementation. This subsystem is
 * the bridge that makes that true, and it is published because an application
 * with a layer of its own gets the same from one line.
 *
 * Canon: `skills/parity/SKILL.md`.
 */

export { defineLankaRole } from "./define-lanka-role/defineLankaRole";
export type {
	ILankaRoleFactory,
	ILankaRoleOpening,
	TLankaRoleOpener,
} from "./define-lanka-role/defineLankaRole";
