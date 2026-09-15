/** Everything the rename screen can do. */
export interface IPlaygroundRenameActions {
	setCustomer: (customer: string) => void;
	setNote: (note: string) => void;
	submit: () => Promise<void>;
}
