import { describe, expect, it } from "vitest";
import { createLankaFakeFormVM } from "./createLankaFakeFormVM";

/**
 * The double five playgrounds render, tested where it lives.
 *
 * It is used through a renderer everywhere else, which proves the binding rather
 * than the double — and a double whose own behaviour is only ever asserted
 * through somebody else's component is a double nobody has read. What matters
 * here is the property the scenes depend on: two fields that are two ROOT keys,
 * and a refusal carrying an address.
 */
describe("createLankaFakeFormVM", () => {
	it("starts with the two fields a form scene needs", () => {
		const formVM = createLankaFakeFormVM();

		expect(formVM.getState().customer).toBe("Ann");
		expect(formVM.getState().note).toBe("");
		expect(formVM.getState().fieldErrors).toEqual([]);
	});

	it("moves ONE field per setter, which is what the scenes rest on", () => {
		// Access tracking compares root keys, so a reader of `note` must be able to
		// sit through every change to `customer`. A single `values` object would
		// make that impossible and the form scenes meaningless.
		const formVM = createLankaFakeFormVM();
		const before = formVM.getState().note;

		formVM.getState().setCustomer("Bo");

		expect(formVM.getState().customer).toBe("Bo");
		expect(formVM.getState().note).toBe(before);
	});

	it("moves the note without touching the customer", () => {
		const formVM = createLankaFakeFormVM();

		formVM.getState().setNote("call first");

		expect(formVM.getState().note).toBe("call first");
		expect(formVM.getState().customer).toBe("Ann");
	});

	it("refuses an empty customer at that field's own address", async () => {
		const formVM = createLankaFakeFormVM();
		formVM.getState().setCustomer("");

		await formVM.getState().submit();

		expect(formVM.getState().fieldErrors).toEqual([
			{ path: "customer", message: "customer is required" },
		]);
	});

	it("treats whitespace as empty, because a form does", async () => {
		const formVM = createLankaFakeFormVM();
		formVM.getState().setCustomer("   ");

		await formVM.getState().submit();

		expect(formVM.getState().fieldErrors).toHaveLength(1);
	});

	it("clears the refusal once the field is filled", async () => {
		const formVM = createLankaFakeFormVM();
		formVM.getState().setCustomer("");
		await formVM.getState().submit();

		formVM.getState().setCustomer("Bo");
		await formVM.getState().submit();

		expect(formVM.getState().fieldErrors).toEqual([]);
	});
});
