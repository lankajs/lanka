import { registerLankaFakes } from "../../src/register-lanka-fakes/registerLankaFakes";
import { resetLanka } from "../../src/resetLanka";
import { createLankaFakeTransport } from "../../src/lankaTestFakes";
import { createPlaygroundProfileVM } from "../create-playground-profile-vm/createPlaygroundProfileVM";
import { PlaygroundProfileAudit } from "../playground-profile-audit/PlaygroundProfileAudit";
import type { ILankaFakes } from "../../src/register-lanka-fakes/registerLankaFakes";
import type { ILankaFakeTransportConfig } from "../../src/lankaTestFakes";
import type { IPlaygroundApp } from "../_interfaces/IPlaygroundApp";

/**
 * Somebody else's application, started the way a test starts one.
 *
 * The application registers its OWN singleton here, exactly as it would in
 * `bootstrap`, so a scene overriding it with a double is overriding something
 * real rather than filling a hole left for it. That is what makes
 * `registerLankaFakes` a demonstration and not a rehearsal.
 */
export const startPlaygroundApp = (
	options: { transport?: ILankaFakeTransportConfig; fakes?: ILankaFakes } = {},
): IPlaygroundApp => {
	const lanka = resetLanka();
	const transport = createLankaFakeTransport(options.transport);

	registerLankaFakes(lanka, {
		singletons: { PlaygroundProfileAudit: new PlaygroundProfileAudit() },
	});
	if (options.fakes) registerLankaFakes(lanka, options.fakes);

	return { lanka, transport, useProfileVM: createPlaygroundProfileVM({ transport, lanka }) };
};
