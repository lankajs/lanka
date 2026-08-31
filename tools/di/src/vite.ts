/**
 * The vite half, behind its own subpath.
 *
 * A subpath rather than the root barrel so a webpack consumer never resolves a
 * module that imports vite's types, and the other way round.
 */
export { lankaDiVite } from "./lanka-di-vite/lankaDiVite";
