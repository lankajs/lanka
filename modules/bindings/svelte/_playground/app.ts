/**
 * The miniature application this package is exercised through.
 *
 * There is almost nothing in it, and that is the point: the ViewModel every
 * binding's playground reads is `createLankaFakeVM` from `@lankajs/tool-testing`
 * — one ViewModel, so that four playgrounds making deliberately identical claims
 * are making them about the same thing. What is local to a binding is the VIEW,
 * and that is what its scenes are about.
 */

export { useLankaVM } from "../src/index";
