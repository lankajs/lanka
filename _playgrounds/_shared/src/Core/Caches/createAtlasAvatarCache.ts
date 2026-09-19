import { LankaBlobCachePolicy } from "@lankajs/blob-cache";
import type { ILankaBlobCacheEnvironment } from "@lankajs/blob-cache";

/**
 * The avatars, cached so they stop being fetched on every screen entry.
 *
 * Only immutable URLs may go in here, and the server promises exactly that: an
 * avatar's bytes are derived from the crew id and its response says
 * `Cache-Control: immutable`. This cache never checks freshness and never asks
 * the server, so a mutable URL would be served stale forever.
 *
 * Here rather than in one application, because nothing about it is React: it is
 * a policy over bytes, and every ecosystem that renders a face needs the same
 * one. A copy per framework would be five caches disagreeing about what
 * immutable means.
 *
 * The whole environment is injectable, which is what lets a test force a rung of
 * the fallback chain without a browser — and the chain is chosen once, by a real
 * write-and-read PROBE rather than by capability detection, because iOS private
 * mode exposes `indexedDB` and then leaves `open()` pending forever.
 */
export const createAtlasAvatarCache = (
	environment?: ILankaBlobCacheEnvironment,
): LankaBlobCachePolicy =>
	// Two calls rather than a default of `undefined`: the browser environment is
	// the package's own default, and passing `undefined` through would replace it
	// with nothing.
	environment ? new LankaBlobCachePolicy(environment) : new LankaBlobCachePolicy();
