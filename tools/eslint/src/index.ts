/**
 * @lankajs/tool-eslint — the framework's boundaries, checked by the framework.
 *
 * ## Why a package
 *
 * A framework whose main promise — imports go one way — is verified by copies of
 * a script inside each consumer does not verify it at all, and the third
 * consumer gets nothing.
 *
 * ## Why every rule has a FAILING fixture
 *
 * A rule without one is a glob that matches nothing: it does not fail, it
 * silently checks nobody. So in this package's tests "the code must fail" matters
 * more than "the code must pass".
 */

export { lankaEslintPlugin } from "./lanka-eslint-plugin/lankaEslintPlugin";
export { lankaBoundaries } from "./lanka-boundaries/lankaBoundaries";
export { lankaNoUpwardImports } from "./_rules/lanka-no-upward-imports/lankaNoUpwardImports";
export { lankaGatewaysOnlyInViewModels } from "./_rules/lanka-gateways-only-in-view-models/lankaGatewaysOnlyInViewModels";
export { lankaDiBarrelsAreFrameworkOnly } from "./_rules/lanka-di-barrels-are-framework-only/lankaDiBarrelsAreFrameworkOnly";
export { lankaNoGatewayToGateway } from "./_rules/lanka-no-gateway-to-gateway/lankaNoGatewayToGateway";
export { lankaLayerStyle } from "./_rules/lanka-layer-style/lankaLayerStyle";
export { lankaNoViewModelToViewModel } from "./_rules/lanka-no-view-model-to-view-model/lankaNoViewModelToViewModel";
