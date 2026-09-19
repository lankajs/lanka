import { lankaDiContract } from "../../lanka-di-contract/lankaDiContract";
import type { TLankaDiDirname } from "../../lanka-di-contract/lankaDiContract";

/**
 * The legal directory name that is not this one.
 *
 * Two callers with two uses, and they are the same question. A message about a
 * directory that cannot be used needs somewhere to send the reader, because the
 * other name is equally correct and equally supported. A project SHARDING its
 * barrels needs the same answer for the opposite reason: the other directory is
 * where the rest of its wiring is.
 *
 * Derived from the contract rather than written down, so a rename there is a
 * rename here. It does NOT survive the list growing: destructuring a third entry
 * compiles happily and this would answer `first` for the new name, quietly and
 * wrongly. The guard against that is the length assertion below, which fails the
 * moment `dirnames` stops being a pair — an "other" is only a question a pair
 * can be asked, and a third directory makes this function the wrong shape rather
 * than merely out of date.
 */
export const otherLankaDiDirname = (dirname: TLankaDiDirname): TLankaDiDirname => {
	const [first, second] = lankaDiContract.dirnames satisfies readonly [
		TLankaDiDirname,
		TLankaDiDirname,
	];

	return dirname === first ? second : first;
};
