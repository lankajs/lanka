/**
 * The gateways this application publishes to `lanka`.
 *
 * These are the layer that TRAVELS: a server component resolves
 * `lankaGateways.atlasMissionGateway` inside a request scope, and a client
 * component resolves the same name in the browser. The gateway layer holds no
 * state, which is exactly why it is the layer that can.
 *
 * SHARDED. The line below pulls in `.lanka_di/Gateways.ts`, which holds the
 * session gateway; `@lanka_di/Gateways` resolves to THIS file, so this is where
 * the two halves become one namespace.
 */
export * from "../.lanka_di/Gateways";
export { AtlasMissionGateway } from "@lanka-playgrounds/_shared/di";
