/**
 * The singleton marker: "this class is published by the application in
 * `lankaSingletons`".
 *
 * ## Why a marker when the class is exported anyway
 *
 * The other three locators have one: a gateway extends `ALankaGateway`, a
 * scenario has a `name`, a store extends `ALankaSharedStore`. Without a marker
 * the selection is "anything that is a function with a prototype", so a stray
 * export in the barrel — a helper, a companion class, an accidental re-export —
 * becomes part of the public `lankaSingletons.*`, and a typo in a name is caught
 * at runtime on first use, far from where it was made.
 *
 * ## A base class rather than a field
 *
 * A marker field can be put on anything, an object included, and the type would
 * again stop telling a class from a non-class. Inheritance also gives TypeScript
 * something it can select on in a mapped type.
 *
 * The class is empty deliberately: all it carries is the statement "I am meant
 * for the locator".
 */
export abstract class ALankaSingleton {
	/**
	 * A runtime check, for the locator, which cannot see types.
	 *
	 * Looks at the prototype chain rather than the name: names are lost to
	 * minification, and a name check would work only until the build.
	 */
	static is(candidate: unknown): boolean {
		if (typeof candidate !== "function") return false;

		let proto: unknown = Object.getPrototypeOf(candidate) as unknown;
		while (typeof proto === "function") {
			if (proto === ALankaSingleton) return true;
			proto = Object.getPrototypeOf(proto) as unknown;
		}
		return false;
	}
}
