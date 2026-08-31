/**
 * An application whose backend answers in ONE specific way, which is the point
 * of this package: request policy is configuration, not framework.
 *
 * The policy lives in its own file because it is the part a consumer replaces;
 * the gateway lives in its own because it is the part that must stay unaware.
 */
export { startPlaygroundHttp } from "./start-playground-http/startPlaygroundHttp";
export { startPlaygroundHttpWith } from "./start-playground-http-with/startPlaygroundHttpWith";
export { createPlaygroundScript } from "./_testing/create-playground-script/createPlaygroundScript";
export { createPlaygroundTransport } from "./_testing/create-playground-transport/createPlaygroundTransport";
export { createPlaygroundHttpPolicy } from "./create-playground-http-policy/createPlaygroundHttpPolicy";
export { PlaygroundOrderGateway } from "./playground-order-gateway/PlaygroundOrderGateway";
export type { IPlaygroundServerScript } from "./_interfaces/IPlaygroundServerScript";
export type { IPlaygroundHttp } from "./start-playground-http/startPlaygroundHttp";
