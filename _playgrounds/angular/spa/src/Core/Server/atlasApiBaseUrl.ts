/**
 * Where the API lives, as this deployment's environment says.
 *
 * A function rather than a constant: a module-level read happens once per
 * PROCESS, and a server process outlives a configuration change. It also keeps
 * the default in one place rather than in every caller.
 */
export const atlasApiBaseUrl = (): string => process.env.ATLAS_API ?? "http://127.0.0.1:4380/api";
