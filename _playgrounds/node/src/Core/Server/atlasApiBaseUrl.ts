/**
 * Where the API lives, as this deployment's environment says.
 *
 * A function rather than a constant: a module-level read happens once per
 * PROCESS, and a service process outlives a configuration change. Read from
 * `ATLAS_API` and not from a framework's public-variable convention, because
 * nothing here is bundled and nothing is sent to a browser.
 */
export const atlasApiBaseUrl = (): string => process.env.ATLAS_API ?? "http://127.0.0.1:4380/api";
