import { useLankaVM } from "../../src/index";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { ILankaFakeFormActions, ILankaFakeFormState } from "@lankajs/tool-testing";

type TRenameVM = ILankaReadableVM<ILankaFakeFormState & ILankaFakeFormActions>;

/** The screen's needs: the hook, and a way to watch each input's renders. */
export interface IPlaygroundRenameScreenProps {
	renameVM: TRenameVM;
	onCustomerRender?: () => void;
	onNoteRender?: () => void;
}

const CustomerInput = ({ renameVM, onRender }: { renameVM: TRenameVM; onRender?: () => void }) => {
	const { customer, fieldErrors, setCustomer } = useLankaVM(renameVM);
	onRender?.();

	const message = fieldErrors.find((field) => field.path.join(".") === "customer")?.message;

	return (
		<label>
			customer
			<input
				aria-label="customer"
				value={customer}
				onChange={(event) => setCustomer(event.target.value)}
			/>
			{message ? <span role="alert">{message}</span> : null}
		</label>
	);
};

const NoteInput = ({ renameVM, onRender }: { renameVM: TRenameVM; onRender?: () => void }) => {
	const { note, setNote } = useLankaVM(renameVM);
	onRender?.();

	return (
		<label>
			note
			<input
				aria-label="note"
				value={note}
				onChange={(event) => setNote(event.target.value)}
			/>
		</label>
	);
};

/**
 * A form whose inputs live in the ViewModel, one component per input.
 *
 * Each input calls the hook ITSELF and reads only its own key, which is what
 * makes the granularity real: typing into the customer field re-renders the
 * customer field. A screen that read both keys in one component would repaint
 * both — correct, and the reason a growing form eventually moves to a library.
 */
export const PlaygroundRenameScreen = ({
	renameVM,
	onCustomerRender,
	onNoteRender,
}: IPlaygroundRenameScreenProps) => (
	<form>
		<CustomerInput renameVM={renameVM} onRender={onCustomerRender} />
		<NoteInput renameVM={renameVM} onRender={onNoteRender} />
	</form>
);
