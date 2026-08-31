import type { ILankaPlugin } from "../../ILankaPlugin";
import type { ILankaInstance } from "../../_factories/create-lanka/createLanka";

export interface ILankaPluginRegistry {
	/** Installs a plugin and returns the function that removes it. */
	use: (plugin: ILankaPlugin) => () => void;
	/** Removes every plugin, newest first is NOT guaranteed — see `removeAll`. */
	removeAll: () => void;
}

/**
 * The plugins installed on one framework instance.
 *
 * Owns three decisions that are easy to get subtly wrong and impossible to see
 * from the outside: a duplicate is refused, removal is idempotent, and removing
 * all of them iterates a COPY of the values.
 */
export const createLankaPluginRegistry = (instance: ILankaInstance): ILankaPluginRegistry => {
	const removers = new Map<string, () => void>();

	return {
		use(plugin: ILankaPlugin): () => void {
			if (removers.has(plugin.name)) {
				// Rejected LOUDLY: two copies of a retry policy double the request
				// count, and that shows up only as backend load — much later, and to
				// somebody else.
				throw new Error(
					`Plugin "${plugin.name}" is already registered on this lanka instance. ` +
						"Registering twice almost always means two copies of one policy.",
				);
			}

			const uninstall = plugin.install(instance);

			const remove = (): void => {
				// Idempotent: a caller may hold the remover and also dispose the
				// instance, and uninstalling twice is how a plugin's own teardown ends
				// up running against a framework that is already gone.
				if (!removers.has(plugin.name)) return;
				removers.delete(plugin.name);
				uninstall?.();
			};

			removers.set(plugin.name, remove);
			return remove;
		},

		removeAll(): void {
			// A COPY: each remover deletes its own entry, and mutating the map being
			// iterated skips every second plugin.
			for (const remove of [...removers.values()]) remove();
			removers.clear();
		},
	};
};
