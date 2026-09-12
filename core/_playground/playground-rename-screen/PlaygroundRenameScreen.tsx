import type { IPlaygroundRenameActions } from "../_interfaces/IPlaygroundRenameActions";
import type { IPlaygroundRenameState } from "../_interfaces/IPlaygroundRenameState";

type TUseRenameVM = () => IPlaygroundRenameState & IPlaygroundRenameActions;

/** The screen's needs: the hook, and a way to watch each input's renders. */
export interface IPlaygroundRenameScreenProps {
	useRenameVM: TUseRenameVM;
	onCustomerRender?: () => void;
	onNoteRender?: () => void;
}

const CustomerInput = ({
	useRenameVM,
	onRender,
}: {
	useRenameVM: TUseRenameVM;
	onRender?: () => void;
}) => {
	const { customer, fieldErrors, setCustomer } = useRenameVM();
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

const NoteInput = ({
	useRenameVM,
	onRender,
}: {
	useRenameVM: TUseRenameVM;
	onRender?: () => void;
}) => {
	const { note, setNote } = useRenameVM();
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
	useRenameVM,
	onCustomerRender,
	onNoteRender,
}: IPlaygroundRenameScreenProps) => (
	<form>
		<CustomerInput useRenameVM={useRenameVM} onRender={onCustomerRender} />
		<NoteInput useRenameVM={useRenameVM} onRender={onNoteRender} />
	</form>
);
