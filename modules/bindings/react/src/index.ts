"use client";

/**
 * `@lankajs/react` — how a React component reads a lanka ViewModel.
 *
 * One name, `useLankaVM`, and it is the same name every member of
 * `modules/bindings/` publishes. That is deliberate: a consumer moving a screen
 * from React to Vue rewrites the view and not the vocabulary, and the guide they
 * read is the same guide. What differs between members is what the call answers
 * — a plain state here, a `ShallowRef` in Vue, an `Accessor` in Solid — because
 * that is the framework's own idea of reactivity and the one thing a binding
 * cannot abstract away.
 *
 * This package publishes ONE thing the shelf does not: `toLankaReactVM`, which
 * makes a ViewModel callable again. A binding may do that — the whole point of a
 * per-framework package is that it knows what its framework finds natural, and a
 * hook is what React finds natural. It adds no state and changes no behaviour;
 * the same ViewModel read through Vue answers the same.
 *
 * It also re-publishes core's six ViewModel factories under CORE'S OWN NAMES,
 * each already wearing React's shape — so a declaration moves from the
 * framework-free spelling to this one by changing the import line and nothing
 * else. Every member of this shelf publishes the same six, which is why they are
 * not idioms of this package: what differs is what the call ANSWERS, exactly as
 * it already does for `useLankaVM`.
 *
 * The directive is on this barrel because React Server Components make an import
 * of a hook a build error. `lanka/viewmodel` carries none: core has no hook any
 * more, so a server component may read a ViewModel's state and only what RENDERS
 * it is a client component.
 */

export { createLankaVM } from "./_factories/create-lanka-vm/createLankaVM";
export { createLazyLankaVM } from "./_factories/create-lazy-lanka-vm/createLazyLankaVM";
export { createLazySharedStoreLankaVM } from "./_factories/create-lazy-shared-store-lanka-vm/createLazySharedStoreLankaVM";
export { createLazyStatelessLankaVM } from "./_factories/create-lazy-stateless-lanka-vm/createLazyStatelessLankaVM";
export { createSharedStoreLankaVM } from "./_factories/create-shared-store-lanka-vm/createSharedStoreLankaVM";
export { createStatelessLankaVM } from "./_factories/create-stateless-lanka-vm/createStatelessLankaVM";
export { toLankaReactVM } from "./to-lanka-react-vm/toLankaReactVM";
export { useLankaShallow } from "./use-lanka-shallow/useLankaShallow";
export { useLankaVM } from "./use-lanka-vm/useLankaVM";

export type { TLankaReactVM, TLankaReactVMHook } from "./to-lanka-react-vm/toLankaReactVM";
