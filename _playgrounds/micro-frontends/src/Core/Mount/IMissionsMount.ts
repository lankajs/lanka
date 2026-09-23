import type { IAtlasMission } from "@lanka-playgrounds/_shared";
import type { ILankaScope } from "lanka/locator";

/**
 * What the shell hands a module that shares its lanka.
 *
 * `scope` is the shell's to own: it creates one per module and disposes it when
 * the module leaves, which takes the module's ViewModels off the bus without the
 * module having to remember anything. A module with its OWN lanka cannot take
 * one — a scope belongs to one copy — and makes its own instead.
 */
export interface IMissionsMount {
	readonly missions: readonly IAtlasMission[];
	readonly scope: ILankaScope;
}
