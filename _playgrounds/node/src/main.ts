import { atlasApiBaseUrl } from "./Core/Server/atlasApiBaseUrl";
import { createAtlasNodeService } from "./createAtlasNodeService";

/**
 * The executable entry, and the only file here that reads the environment.
 *
 * Three lines, like every other application's entry in this folder — which is
 * the point of them all being three lines: what differs between the five hosts
 * is above this file, not in it.
 */
const service = await createAtlasNodeService({ apiBaseUrl: atlasApiBaseUrl(), port: 4396 });

process.on("SIGINT", () => void service.stop());
