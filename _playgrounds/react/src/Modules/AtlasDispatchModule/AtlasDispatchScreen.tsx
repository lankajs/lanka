import { useLankaVM } from "@lankajs/react";
import type {
	IAtlasCrewStepActions,
	IAtlasDispatchDraft,
	IAtlasDispatchStepActions,
} from "@lanka-playgrounds/_shared";
import type { JSX } from "react";
import type { TLankaSharedStoreVMHook } from "lanka/viewmodel";

export interface IAtlasDispatchScreenProps {
	/**
	 * A shared-store hook, not a zustand store.
	 *
	 * The framework's own type, because the state lives in the STORE and the hook
	 * is a reader over it — a `UseBoundStore` here would be claiming this screen
	 * may `setState` on somebody else's buffer.
	 */
	stepVM: TLankaSharedStoreVMHook<IAtlasDispatchDraft, IAtlasDispatchStepActions>;
	crewStepVM: TLankaSharedStoreVMHook<IAtlasDispatchDraft, IAtlasCrewStepActions>;
	/** What to do with a finished draft. The screen orchestrates nothing itself. */
	onPlace: (draft: IAtlasDispatchDraft) => void;
}

/**
 * Two steps, one draft.
 *
 * Both halves are on screen at once here, which a router would normally split —
 * and that is exactly what makes the point visible: the two ViewModels never
 * speak to each other, they write into one store, and neither could tell whether
 * the other is mounted.
 *
 * What they share is a BUFFER being co-edited, which is why it is a shared store
 * and not a scenario. A scenario carries something that HAPPENED; if you would
 * describe the link with a past-tense verb, it is a scenario.
 */
export const AtlasDispatchScreen = ({
	stepVM,
	crewStepVM,
	onPlace,
}: IAtlasDispatchScreenProps): JSX.Element => {
	const { title, priority, step, setTitle, setPriority, goToCrewStep } = useLankaVM(stepVM);
	const { crewId, chooseCrew, goBack, draft } = useLankaVM(crewStepVM);

	return (
		<section aria-label="Dispatch">
			{step === 1 ? (
				<div>
					<input
						aria-label="Mission title"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
					/>
					<input
						aria-label="Priority"
						type="number"
						value={priority}
						onChange={(event) => setPriority(Number(event.target.value))}
					/>
					<button type="button" onClick={goToCrewStep}>
						Choose the crew
					</button>
				</div>
			) : (
				<div>
					<p data-testid="draft-title">{title}</p>
					<select
						aria-label="Crew"
						value={crewId ?? ""}
						onChange={(event) => chooseCrew(event.target.value || null)}
					>
						<option value="">Nobody yet</option>
						<option value="c-1">Ada Lovelace</option>
						<option value="c-2">Grace Hopper</option>
						<option value="c-3">Katherine Johnson</option>
					</select>
					<button type="button" onClick={goBack}>
						Back
					</button>
					<button type="button" onClick={() => onPlace(draft())}>
						Place the dispatch
					</button>
				</div>
			)}
		</section>
	);
};
