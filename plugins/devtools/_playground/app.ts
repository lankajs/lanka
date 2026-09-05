/**
 * An application being watched, whole.
 *
 * The activity the inspector should notice is its own file, so an enabled and a
 * disabled inspector are given exactly the same thing to notice — which is what
 * makes "a disabled one accumulates nothing" a claim rather than a hope.
 */
export { startPlaygroundInspected } from "./start-playground-inspected/startPlaygroundInspected";
export { playgroundCartChanged } from "./playground-cart-changed/PlaygroundCartChanged";
export { playgroundCheckoutBlocked } from "./playground-checkout-blocked/PlaygroundCheckoutBlocked";
export { PlaygroundCartGateway } from "./playground-cart-gateway/PlaygroundCartGateway";
export { useTheApp } from "./use-the-app/useTheApp";
export type { IPlaygroundInspected } from "./_interfaces/IPlaygroundInspected";
export type { IPlaygroundInspectedConfig } from "./start-playground-inspected/startPlaygroundInspected";
