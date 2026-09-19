/**
 * Where the API lives, as this deployment's environment says.
 *
 * A function rather than a constant: a module-level read happens once per
 * PROCESS, and a server process outlives a configuration change. It also keeps
 * the default in one place rather than in every caller.
 *
 * `ATLAS_API` with no `VITE_` in front of it, and the prefix is the whole point
 * of the name. Vite only inlines the variables that carry the prefix, and what
 * it inlines it ships: a prefixed name is a value every visitor can read out of
 * the bundle. This one is read on a server, by a process nobody downloads, so
 * it must not be public — and the browser half reads `VITE_ATLAS_API` instead,
 * because a browser bundle has no other way to be told anything.
 */
export const atlasApiBaseUrl = (): string => process.env.ATLAS_API ?? "http://127.0.0.1:4380/api";
