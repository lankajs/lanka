import { AsyncLocalStorage } from "node:async_hooks";
import type { ILankaRuntime } from "lanka/internal";

/**
 * The box one scope's instance sits in.
 *
 * A mutable field rather than the instance itself, because the store has to
 * EXIST before the instance does: creating an instance already reaches for the
 * active runtime, and a store written after that call would be written too late.
 */
export interface ILankaServerScopeStore {
	runtime: ILankaRuntime | null;
}

/**
 * One `AsyncLocalStorage` for the process, shared by the resolver that reads it
 * and the scope that fills it.
 *
 * A second instance would be a second answer to "which instance is active", and
 * the two would disagree exactly when it matters — under concurrent load.
 */
export const lankaServerStorage = new AsyncLocalStorage<ILankaServerScopeStore>();
