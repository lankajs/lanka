/**
 * The gateways this application publishes to `lanka`.
 *
 * These are the layer that TRAVELS: a server component resolves
 * `lankaGateways.atlasMissionGateway` inside a request scope, and a client
 * component resolves the same name in the browser. The gateway layer holds no
 * state, which is exactly why it is the layer that can.
 */
export { AtlasMissionGateway } from "@lanka-playgrounds/_shared/di";
export { AtlasSessionGateway } from "@lanka-playgrounds/_shared/di";
