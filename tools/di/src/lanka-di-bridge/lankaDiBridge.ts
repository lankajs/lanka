import type { TLankaDiDirname } from "../lanka-di-contract/lankaDiContract";

/**
 * The line a barrel carries to pull in its shard from the other directory.
 *
 * ## Why a line in the consumer's file and not resolution
 *
 * `@lanka_di/Gateways` is an ALIAS, and an alias is a path substitution: it can
 * name one file. Two directories each holding a `Gateways.ts` cannot be merged
 * by aliasing, in any of the six bundlers here or in `tsc` — a `paths` entry
 * with two candidates picks the first that exists, which is a fallback and not
 * a union. The union has to be a real module that re-exports both, and the
 * honest place for it is the barrel a consumer already writes.
 *
 * So `@lanka_di/Gateways` keeps resolving to exactly one file — the one in the
 * primary directory — and that file says out loud where the rest of it is. A
 * reader who opens it learns the whole story; nothing is assembled behind them
 * by a resolver they cannot see, and nothing is generated into a directory they
 * are told not to edit.
 *
 * ## `export *` and not a named list
 *
 * The namespace barrels are read as namespaces: the framework derives the
 * locator from whatever they export, so a shard's exports must arrive under
 * their own names and a list here would be a second place to add a gateway.
 *
 * Its one hazard is a name exported by BOTH sides: ESM resolves an ambiguous
 * star export by dropping the name, silently. `lankaDiExportedNames` exists for
 * that, and `verifyLankaDi` reports the collision rather than leaving a gateway
 * that is simply not there.
 *
 * ## The path
 *
 * Relative, because the two directories are siblings at the consumer's root and
 * a relative specifier is the one form that needs no configuration to resolve.
 * Extensionless, matching every other import a consumer writes here.
 */
export const lankaDiBridge = (secondary: TLankaDiDirname, file: string): string =>
	`export * from "../${secondary}/${file.replace(/\.ts$/, "")}";`;
