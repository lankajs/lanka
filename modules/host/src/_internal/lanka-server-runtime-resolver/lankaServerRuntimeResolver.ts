import { getLankaProcessRuntime } from "lanka/internal";
import { lankaServerStorage } from "../lanka-server-storage/lankaServerStorage";
import type { ILankaRuntime } from "lanka/internal";

/**
 * The strategy this package installs into core.
 *
 * Package-private, and the reason is worth writing down: published, it would be
 * a name a consumer cannot use for anything. Installing it without this
 * package's storage answers `null` for every call, and filling that storage is
 * `runLankaRequest`. A seam for a host with scoping of its own would have to
 * publish the store as well, and nobody has asked for one.
 *
 * ## Inside a scope, the scope's instance or nothing
 *
 * A scope exists and its `runtime` is still `null` only between `run` opening
 * and the instance being created — a window the setup itself is inside. There
 * the honest answer is "no instance", and core turns it into a named failure. A
 * fallback HERE would be one user's render reading another user's framework,
 * which is the failure this whole seam exists to make impossible.
 *
 * ## Outside every scope, the process's own instance
 *
 * That is a different question, and it used to get the same answer. The resolver
 * is installed once per process and never removed, so the first `runLankaRequest`
 * turned every later ambient call in that process into a failure — for the life
 * of the process, with a message about request scopes that named nothing the
 * caller had done.
 *
 * Found by `_playgrounds/node`: a service that holds ONE ViewModel of its own
 * and also answers requests. Its process-level instance is legitimate — a worker
 * with a cache, a dev server between reloads, a suite between cases — and there
 * is no request whose instance could be confused with it, because a request's
 * instance lives only inside its own storage.
 *
 * So this defers rather than refuses, and what it defers to is exactly what the
 * call would have resolved to had nobody installed a resolver at all. A process
 * that holds no ambient instance — a Next server, every host this package was
 * written for — has `null` there and fails as loudly as before.
 */
export const lankaServerRuntimeResolver = (): ILankaRuntime | null => {
	const scope = lankaServerStorage.getStore();

	return scope ? scope.runtime : getLankaProcessRuntime();
};
