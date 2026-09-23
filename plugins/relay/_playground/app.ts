/**
 * Two applications on one page that were never built together: a shop that
 * owns a cart, and a header that shows its count.
 *
 * Each has its own framework instance and its own bus, and they know each other
 * by one string, the channel. Each screen's ViewModel is resolved in a scope, so
 * an application that leaves the page takes its ViewModels off the bus with it.
 */
export { startPlaygroundShop } from "./start-playground-shop/startPlaygroundShop";
export { startPlaygroundHeader } from "./start-playground-header/startPlaygroundHeader";
export { playgroundCartChanged } from "./playground-cart-changed/playgroundCartChanged";
export type { IPlaygroundApplication } from "./_interfaces/IPlaygroundApplication";
export type { TPlaygroundCartVM } from "./playground-cart/playgroundCart";
export type { TPlaygroundBadgeVM } from "./playground-badge/playgroundBadge";
