import type { ILankaInstance } from "./_factories/create-lanka/createLanka";

/**
 * A plugin is an extension core knows by SHAPE rather than by name.
 *
 * ## Plugin versus module
 *
 * A module is called by the application (`app → module`) and core does not know
 * it exists. A plugin sits on the path core itself walks (`app → core → plugin`).
 * The test question: does core need a hook for this to work? No — then it is a
 * module, and making it a plugin costs more, because the hook has to be supported
 * forever.
 *
 * ## Why `install` receives the instance
 *
 * So a plugin has no private route to the framework. Everything it can do comes
 * from the instance it was given, which means two instances in one process (a
 * test beside the app) do not share its configuration.
 */
export interface ILankaPlugin {
	/**
	 * The name the plugin is recognised by. Registering the same name twice is
	 * rejected: two copies of a retry policy would silently double the request
	 * count.
	 */
	readonly name: string;
	/**
	 * Installation. The returned function removes everything the plugin installed
	 * and is called when the plugin is removed and when the instance is disposed.
	 */
	install: (lanka: ILankaInstance) => (() => void) | void;
}
