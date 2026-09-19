import { createAtlasHost } from "@lanka-playgrounds/_shared/di";
import type { ILankaHost } from "lanka";

/**
 * What this application supplies to `lanka`.
 *
 * A literal rather than a build variable, and that is the device's difference: a
 * phone has no `import.meta.env` and no `process.env` at runtime. What a release
 * talks to is decided when the binary is built, which is what `app.json` and an
 * EAS profile are for.
 */
export const lankaHost: ILankaHost = createAtlasHost("http://127.0.0.1:4380/api");
