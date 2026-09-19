/**
 * The gateways this application publishes to `lanka`.
 *
 * One export line per class and no registration: the framework derives the
 * locator from these exports, so `lankaGateways.atlasMissionGateway` is typed
 * the moment a line is added here.
 */
export { AtlasMissionGateway } from "@lanka-playgrounds/_shared/di";
export { AtlasSessionGateway } from "@lanka-playgrounds/_shared/di";
export { AtlasBoardGateway } from "@lanka-playgrounds/_shared/di";
