import type { ILankaInstance } from "../../_factories/create-lanka/createLanka";
import type { ILankaPlugin } from "../../ILankaPlugin";

/**
 * A plugin, written as a class.
 *
 * The functional style is a function returning `{ name, install }`, and it is
 * what the framework's own five plugins use — a plugin is a value handed to
 * `use()`, and the ecosystem writes those as `react()`, `pinia()`,
 * `tsconfigPaths()`.
 *
 * This is the same contract for an application that keeps its plugins as
 * classes: `name` is a field, `install` is a method, and `uninstall` is the
 * teardown the framework calls on removal and on dispose. Nothing above can
 * tell which style wrote it — `use()` sees `ILankaPlugin` either way.
 */
export abstract class ALankaPlugin implements ILankaPlugin {
	public abstract readonly name: string;

	/** Everything this plugin puts in place. Return nothing if there is nothing to undo. */
	protected abstract onInstall(lanka: ILankaInstance): void;

	/**
	 * Removes what `onInstall` put in place.
	 *
	 * A default that does nothing rather than an abstract member: an abstract one
	 * would break every existing subclass the day it was added, and most plugins
	 * genuinely have nothing to undo.
	 */
	protected onUninstall(): void {
		/* Nothing to undo unless a subclass says otherwise. */
	}

	public install(lanka: ILankaInstance): () => void {
		this.onInstall(lanka);

		return () => {
			this.onUninstall();
		};
	}
}
