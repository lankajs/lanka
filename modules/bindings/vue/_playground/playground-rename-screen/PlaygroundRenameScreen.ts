import { defineComponent, h } from "vue";
import { useLankaVM } from "../../src/index";
import type { PropType } from "vue";
import type { ILankaReadableVM } from "lanka/viewmodel";
import type { ILankaFakeFormActions, ILankaFakeFormState } from "@lankajs/tool-testing";

type TRenameVM = ILankaReadableVM<ILankaFakeFormState & ILankaFakeFormActions>;

const CustomerInput = defineComponent({
	name: "PlaygroundCustomerInput",
	props: {
		renameVM: { type: Object as PropType<TRenameVM>, required: true },
		onRender: { type: Function as PropType<() => void>, default: undefined },
	},
	setup(props) {
		const state = useLankaVM(props.renameVM);

		return () => {
			props.onRender?.();
			const { customer, fieldErrors, setCustomer } = state.value;
			const message = fieldErrors.find(
				(field) => field.path.join(".") === "customer",
			)?.message;

			return h("label", [
				"customer",
				h("input", {
					"aria-label": "customer",
					value: customer,
					onInput: (event: Event) => {
						setCustomer((event.target as HTMLInputElement).value);
					},
				}),
				message ? h("span", { role: "alert" }, message) : null,
			]);
		};
	},
});

const NoteInput = defineComponent({
	name: "PlaygroundNoteInput",
	props: {
		renameVM: { type: Object as PropType<TRenameVM>, required: true },
		onRender: { type: Function as PropType<() => void>, default: undefined },
	},
	setup(props) {
		const state = useLankaVM(props.renameVM);

		return () => {
			props.onRender?.();
			const { note, setNote } = state.value;

			return h("label", [
				"note",
				h("input", {
					"aria-label": "note",
					value: note,
					onInput: (event: Event) => {
						setNote((event.target as HTMLInputElement).value);
					},
				}),
			]);
		};
	},
});

/**
 * A form whose inputs live in the ViewModel, one component per input.
 *
 * Each input calls `useLankaVM` ITSELF and reads only its own key, which is what
 * makes the granularity real: typing into the customer field re-renders the
 * customer field. The identical claim, proved the identical way, in
 * `@lankajs/react`'s playground — and that the two files differ only in Vue's
 * and React's own syntax is the point of the shelf.
 */
export const PlaygroundRenameScreen = defineComponent({
	name: "PlaygroundRenameScreen",
	props: {
		renameVM: { type: Object as PropType<TRenameVM>, required: true },
		onCustomerRender: { type: Function as PropType<() => void>, default: undefined },
		onNoteRender: { type: Function as PropType<() => void>, default: undefined },
	},
	setup(props) {
		return () =>
			h("form", [
				h(CustomerInput, { renameVM: props.renameVM, onRender: props.onCustomerRender }),
				h(NoteInput, { renameVM: props.renameVM, onRender: props.onNoteRender }),
			]);
	},
});
