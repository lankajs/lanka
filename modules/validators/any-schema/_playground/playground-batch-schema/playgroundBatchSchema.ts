import { createLankaSchema } from "../../src/index";
import { readPlaygroundFrame } from "../read-playground-frame/readPlaygroundFrame";
import type { IPlaygroundProtocolFrame } from "../_interfaces/IPlaygroundProtocolFrame";

/**
 * A batch of frames, reading each one with the same function.
 *
 * `array(frame)` spelled in JavaScript. The index goes into the path prefix, so
 * a bad third frame still reports `2.seq` rather than `seq` — without that, a
 * batch of twenty reports twenty failures at the same address and the form has
 * nowhere to put nineteen of them.
 *
 * Every failing frame is reported, not the first: the reader raises issues and
 * the loop keeps going, which is the same promise `abortEarly: false` makes in
 * yup and the port makes everywhere.
 */
export const playgroundBatchSchema = createLankaSchema<IPlaygroundProtocolFrame[]>(
	(data, issue) => {
		if (!Array.isArray(data)) {
			issue("a batch is a list of frames");
			return [];
		}

		return data.map((frame, index) => readPlaygroundFrame(frame, issue, [index]));
	},
	"acme-protocol",
);
