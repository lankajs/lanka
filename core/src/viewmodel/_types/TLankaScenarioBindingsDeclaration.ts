/**
 * Scenario bindings as a ViewModel declares them: the list, or a factory for it.
 *
 * The factory form exists for the same reason `TLankaDependencyBag` has one, and
 * for a sharper case. A ViewModel declared at module level writes its bindings as
 * an array literal, and each entry names its scenario — `lankaScenarios.<name>`,
 * which is a LOCATOR read. Written directly, that read happens while the module
 * is being evaluated, and a module body can run before `createLanka` has: then
 * the locator refuses with "lanka used before an instance existed" and nothing
 * renders.
 *
 * Import order is not a defence. It holds inside one chunk, and a bundler decides
 * chunks — in ES modules the body of an imported chunk runs before the body of
 * the chunk importing it, so an application that put its ViewModels in their own
 * chunks evaluated them ahead of its own `createLanka` call. Measured in a real
 * app: 44 application chunks were statically imported by the entry, and its whole
 * browser-level suite died on the first of them.
 *
 * `gateways` and `services` already accept a factory for the identical reason.
 * Bindings were the one field left out, and they are the field that reads the
 * locator most.
 */
export type TLankaScenarioBindingsDeclaration<TBinding> =
	readonly TBinding[] | (() => readonly TBinding[]);
