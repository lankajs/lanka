"use client";

/**
 * The state a screen reads, and the only place a gateway is called from.
 *
 * Four factories cover four cases: plain and lazy for state, stateless for
 * orchestration without reactive fields, shared-store for one feature split
 * across several ViewModels over a common store.
 *
 * `TLankaStatelessVMConfig` is taken from the factory that DECLARES it, not from
 * the lazy factory that re-exports it — one type, one exported name.
 */

export { createLankaVM } from "./_factories/create-lanka-vm/createLankaVM";
export { createLazyLankaVM } from "./_factories/create-lazy-lanka-vm/createLazyLankaVM";
export type { TLazyLankaVM } from "./_factories/create-lazy-lanka-vm/createLazyLankaVM";
export { createStatelessLankaVM } from "./_factories/create-stateless-lanka-vm/createStatelessLankaVM";
export { createLazyStatelessLankaVM } from "./_factories/create-lazy-stateless-lanka-vm/createLazyStatelessLankaVM";
export { createSharedStoreLankaVM } from "./_factories/create-shared-store-lanka-vm/createSharedStoreLankaVM";
export { createLazySharedStoreLankaVM } from "./_factories/create-lazy-shared-store-lanka-vm/createLazySharedStoreLankaVM";
export { ALankaVM } from "./_abstractions/lanka-vm/ALankaVM";
export { ALankaStatelessVM } from "./_abstractions/lanka-stateless-vm/ALankaStatelessVM";
export { ALankaSharedStoreVM } from "./_abstractions/lanka-shared-store-vm/ALankaSharedStoreVM";
export { ALankaSharedStore } from "./_abstractions/lanka-shared-store/ALankaSharedStore";
export { createLankaSharedStore } from "./_factories/create-lanka-shared-store/createLankaSharedStore";

export type {
	ILankaStatelessScenarioBinding,
	ILankaStatelessVMContext,
	TLankaSetState,
	TLankaStatelessVMConfig,
	TLankaStatelessVMHook,
} from "./_factories/create-stateless-lanka-vm/createStatelessLankaVM";
export type { ILankaScenarioBinding } from "./_interfaces/ILankaScenarioBinding";
export type {
	ILankaSharedStoreScenarioBinding,
	ILankaSharedStoreVMConfig,
	TLankaSharedStoreVMHook,
} from "./_interfaces/ILankaSharedStoreVMConfig";
export type { ILankaSharedStoreVMContext } from "./_interfaces/ILankaSharedStoreVMContext";
export type { ILankaVMConfig } from "./_interfaces/ILankaVMConfig";
export type { ILankaVMContext } from "./_interfaces/ILankaVMContext";
export type { TLankaAnyMutators } from "./_types/TLankaAnyMutators";
export type { TUnknownLankaScenarioBinding } from "./_types/TUnknownLankaScenarioBinding";
export type { TLankaVMEnhancer } from "./_types/TLankaVMEnhancer";
export type { TLankaVMStateCreator } from "./_types/TLankaVMStateCreator";
export type { TLankaSharedStoreSetState } from "./_types/TLankaSharedStoreSetState";
