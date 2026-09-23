import type { IMissionsMount } from "./IMissionsMount";

/**
 * Every module's entry, whatever renders inside it.
 *
 * Asynchronous where a framework's start is — Angular creates an application
 * before it renders anything — so a shell awaits every mount the same way and
 * never needs to know which one it is holding.
 */
export type TMissionsMount = (
	element: Element,
	mount: IMissionsMount,
) => (() => void) | Promise<() => void>;
