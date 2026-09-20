/**
 * `@lankajs/vue` — how a Vue component reads a lanka ViewModel.
 *
 * One name, `useLankaVM`, and it is the same name every member of
 * `modules/bindings/` publishes. A consumer moving a screen between frameworks
 * rewrites the view and not the vocabulary, and the guide they read is the same
 * guide. What differs is what the call answers — a `ShallowRef` here, the state
 * itself in React — because that is the framework's own reactivity and the one
 * thing a binding cannot abstract away.
 *
 * It also re-publishes core's six ViewModel factories under CORE'S OWN NAMES,
 * each already wearing Vue's read — so a declaration moves from the
 * framework-free spelling to this one by changing the import line and nothing
 * else. Every member of this shelf publishes the same six, which is why they are
 * not idioms of this package: what differs is what the call ANSWERS, exactly as
 * it already does for `useLankaVM`.
 *
 * No `"use client"`: that is React Server Components' mechanism, and Vue has
 * none. Nuxt renders this package on the server as ordinary code.
 */

export { createLankaVM } from "./_factories/create-lanka-vm/createLankaVM";
export { createLazyLankaVM } from "./_factories/create-lazy-lanka-vm/createLazyLankaVM";
export { createLazySharedStoreLankaVM } from "./_factories/create-lazy-shared-store-lanka-vm/createLazySharedStoreLankaVM";
export { createLazyStatelessLankaVM } from "./_factories/create-lazy-stateless-lanka-vm/createLazyStatelessLankaVM";
export { createSharedStoreLankaVM } from "./_factories/create-shared-store-lanka-vm/createSharedStoreLankaVM";
export { createStatelessLankaVM } from "./_factories/create-stateless-lanka-vm/createStatelessLankaVM";
export { defineLankaComposable } from "./define-lanka-composable/defineLankaComposable";
export { lankaVMToRefs } from "./lanka-vm-to-refs/lankaVMToRefs";
export { toLankaCallableVM } from "./to-lanka-callable-vm/toLankaCallableVM";
export { useLankaVM } from "./use-lanka-vm/useLankaVM";

export type { ILankaVMRef } from "./use-lanka-vm/useLankaVM";
export type { TLankaVueCallableVM } from "./to-lanka-callable-vm/toLankaCallableVM";
export type { TLankaVueVM } from "./define-lanka-composable/defineLankaComposable";
export type { TLankaVMRefs } from "./lanka-vm-to-refs/lankaVMToRefs";
