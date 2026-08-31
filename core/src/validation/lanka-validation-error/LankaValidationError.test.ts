import { describe, it, expect } from "vitest";
import { LankaValidationError } from "./LankaValidationError";

describe("LankaValidationError", () => {
	it("should create an instance of LankaValidationError", () => {
		const err = new LankaValidationError("Invalid data");

		expect(err).toBeInstanceOf(LankaValidationError);
		expect(err.name).toBe("LankaValidationError");
	});

	it("should set status to 422", () => {
		const err = new LankaValidationError("Invalid data");

		expect(err.status).toBe(422);
	});

	it("should set message correctly", () => {
		const err = new LankaValidationError("Something went wrong");

		expect(err.message).toBe("Something went wrong");
	});

	it("should use provided errors array if passed", () => {
		const errors = ["email is required", "name is too short"];
		const err = new LankaValidationError("Validation failed", errors);

		expect(err.errors).toEqual(errors);
	});

	it("should fallback to [message] if no errors array provided", () => {
		const err = new LankaValidationError("Field is required");

		expect(err.errors).toEqual(["Field is required"]);
	});

	it("should extend Error and have a stack trace", () => {
		const err = new LankaValidationError("Oops");

		expect(err).toBeInstanceOf(Error);
		expect(typeof err.stack).toBe("string");
	});
	it("stress: repeated error creation (timing)", () => {
		const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

		const start = now();
		let last: LankaValidationError | undefined;
		for (let i = 0; i < 1000; i += 1) {
			last = new LankaValidationError("Invalid data");
		}
		const durationMs = now() - start;

		console.info(`LankaValidationError stress duration: ${durationMs.toFixed(2)}ms`);
		expect(last).toBeInstanceOf(LankaValidationError);
	});
});
