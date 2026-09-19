import type { ILankaInitChoices } from "./ILankaInitChoices";
import type { ILankaInitDependency } from "./ILankaInitDependency";
import type { ILankaInitFile } from "./ILankaInitFile";
import type { ILankaInitNote } from "./ILankaInitNote";

/**
 * What a set of choices comes to: the packages, the files and what is left over.
 *
 * Decided without reading a disk, which is what makes it printable, comparable
 * and testable in one call. Whether any of these files is ALREADY THERE is a
 * different question, and `applyLankaInit` — the only part of this package that
 * has a file system — is what answers it.
 */
export interface ILankaInitPlan {
	readonly choices: ILankaInitChoices;
	/** In the order a package manager should be given them: runtime, then development. */
	readonly dependencies: readonly ILankaInitDependency[];
	readonly files: readonly ILankaInitFile[];
	readonly notes: readonly ILankaInitNote[];
	/**
	 * The `@lankajs/tool-di` contract version the barrels above were written for.
	 *
	 * Recorded because this tool writes barrels from the contract BUNDLED WITH
	 * ITSELF, and then asks a package manager to install whatever `@lankajs/tool-di`
	 * resolves to today. The day the contract's version moves, an older
	 * `lanka-init` writes barrels the newly installed framework refuses — loudly,
	 * on the first build, which is right and is also the worst five minutes for it
	 * to happen in. A number in the plan is what lets a caller — and the command's
	 * own output — say so before the build does.
	 */
	readonly contractVersion: number;
}
