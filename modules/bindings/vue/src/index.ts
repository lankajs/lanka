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
 * No `"use client"`: that is React Server Components' mechanism, and Vue has
 * none. Nuxt renders this package on the server as ordinary code.
 */

export { defineLankaStore } from "./define-lanka-store/defineLankaStore";
export { lankaStoreToRefs } from "./lanka-store-to-refs/lankaStoreToRefs";
export { useLankaVM } from "./use-lanka-vm/useLankaVM";

export type { ILankaVMRef } from "./use-lanka-vm/useLankaVM";
export type { TLankaStore } from "./define-lanka-store/defineLankaStore";
export type { TLankaStoreRefs } from "./lanka-store-to-refs/lankaStoreToRefs";
