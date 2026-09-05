import type { ILankaInstance } from "lanka/bootstrap";
import type { createPlaygroundProfileVM } from "../create-playground-profile-vm/createPlaygroundProfileVM";
import type { ILankaFakeTransport } from "../../src/lankaTestFakes";

/** Somebody else's application, running. */
export interface IPlaygroundApp {
	lanka: ILankaInstance;
	/** The seam the outside world was stubbed at, and the only one. */
	transport: ILankaFakeTransport;
	useProfileVM: ReturnType<typeof createPlaygroundProfileVM>;
}
