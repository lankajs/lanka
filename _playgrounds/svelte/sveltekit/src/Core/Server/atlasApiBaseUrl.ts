/**
 * Where the API lives, as this deployment's environment says.
 *
 * A function rather than a constant: a module-level read happens once per
 * PROCESS, and a server process outlives a configuration change. It also keeps
 * the default in one place rather than in every caller.
 *
 * `ATLAS_API` with no bundler prefix, unlike the SPA's `VITE_ATLAS_API`. This
 * file is server-only — Kit refuses to bundle `$env/static/private` into a
 * browser chunk — so the value never has to be public, and a name that is not
 * public should not carry a prefix that says it is.
 */
export const atlasApiBaseUrl = (): string => process.env.ATLAS_API ?? "http://127.0.0.1:4380/api";
