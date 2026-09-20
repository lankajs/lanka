/**
 * The miniature application this package is exercised through.
 *
 * There is almost nothing in it, and that is the point: the ViewModel every
 * binding's playground reads is `createLankaFakeVM` from `@lankajs/tool-testing`
 * — one ViewModel, so that five playgrounds making deliberately identical claims
 * are making them about the same thing. What is local to a binding is the VIEW.
 */

export { useLankaVM } from "../src/index";

export { usePlaygroundDeclaredTodosVM } from "./use-playground-declared-todos-vm/usePlaygroundDeclaredTodosVM";
export { usePlaygroundLazyTodosVM } from "./use-playground-lazy-todos-vm/usePlaygroundLazyTodosVM";
export { playgroundVMBuildLog } from "./playground-vm-build-log/playgroundVMBuildLog";
