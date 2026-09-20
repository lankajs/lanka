/**
 * Which ViewModel declarations have actually been BUILT, in the order they were.
 *
 * A module-level array rather than a spy, because the moment the lazy scenes ask
 * about is over before the first `beforeEach` runs: importing `./app` declares
 * both ViewModels, the EAGER one builds its store there and then, and the lazy
 * one must not. A spy installed in a hook arrives too late to have seen either.
 *
 * `createActions` is where each declaration writes its name, because that is the
 * one place a store's construction is observable from outside it — the lazy
 * proxy answers `name` and `dispose` from the config, so neither of those tells
 * a scene anything about whether the store exists yet.
 */
export const playgroundVMBuildLog: string[] = [];
