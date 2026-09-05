import {
	lankaDevtoolsPanelRows,
	type TLankaDevtoolsPanelTab,
} from "../lanka-devtools-panel-rows/lankaDevtoolsPanelRows";
import type { ILankaDevtoolsSnapshot } from "../../../lanka-devtools-collector/LankaDevtoolsCollector";

/**
 * The four lists, in the order they are offered.
 *
 * Declared here rather than beside the rows: WHICH lists exist is what the rows
 * answer, and in WHAT ORDER they are offered is what the panel decides.
 */
const TABS: readonly TLankaDevtoolsPanelTab[] = ["events", "logs", "requests", "scenarios"];

export interface ILankaDevtoolsPanelViewConfig {
	getSnapshot: () => ILankaDevtoolsSnapshot;
	tab: TLankaDevtoolsPanelTab;
	collapsed: boolean;
	/** What the clear button does. Absent, there is no clear button. */
	onClear?: () => void;
}

export interface ILankaDevtoolsPanelView {
	element: HTMLElement;
	/** Redraws the list from the current snapshot. */
	update: () => void;
}

/**
 * The panel's DOM, and the state that belongs to the panel rather than to the
 * inspector: which tab, what filter, open or collapsed.
 *
 * Plain DOM and no view library, permanently. The package has no opinion about
 * what a consumer renders their interface with, and acquiring one here would put
 * a dependency in every application that installs a debug tool.
 */
export const createLankaDevtoolsPanelView = (
	config: ILankaDevtoolsPanelViewConfig,
): ILankaDevtoolsPanelView => {
	let tab = config.tab;
	let filter = "";

	const element = box();
	const list = document.createElement("div");
	const filterField = filterInput((value) => {
		filter = value;
		update();
	});

	const update = (): void => {
		list.textContent = "";
		for (const row of lankaDevtoolsPanelRows(config.getSnapshot(), tab, filter)) {
			list.appendChild(line(row.text, row.tone));
		}
	};

	const tabs = tabStrip(
		() => tab,
		(next) => {
			tab = next;
			update();
		},
	);

	const body = document.createElement("div");
	body.append(tabs, filterField, list);
	body.hidden = config.collapsed;

	element.append(
		titleBar(config, () => {
			body.hidden = !body.hidden;
		}),
		body,
	);
	update();

	return { element, update };
};

/** The frame: fixed, bottom right, above everything a consumer may have. */
const box = (): HTMLElement => {
	const element = document.createElement("div");
	element.dataset.lankaDevtools = "";
	element.style.cssText =
		"position:fixed;right:8px;bottom:8px;z-index:2147483647;width:360px;max-width:calc(100vw - 16px);" +
		"max-height:50vh;overflow:auto;background:#111;color:#eee;font:12px/1.4 monospace;" +
		"padding:8px;border-radius:6px;opacity:.94";
	return element;
};

/** The name, the copy button, the clear button, and the collapse toggle. */
const titleBar = (config: ILankaDevtoolsPanelViewConfig, toggle: () => void): HTMLElement => {
	const bar = document.createElement("div");
	bar.style.cssText = "display:flex;gap:6px;align-items:center;margin-bottom:6px";

	const name = document.createElement("strong");
	name.textContent = "lanka";
	name.style.cssText = "flex:1;cursor:pointer";
	name.addEventListener("click", toggle);
	bar.append(name);

	bar.append(
		button("copy", () => {
			// Not a download and not the clipboard API: a debug panel that asked for
			// a permission would be refused in exactly the session it is needed.
			void navigator.clipboard?.writeText(JSON.stringify(config.getSnapshot(), null, 2));
		}),
	);
	if (config.onClear) bar.append(button("clear", config.onClear));

	return bar;
};

/** One button per list, the current one marked. */
const tabStrip = (
	current: () => TLankaDevtoolsPanelTab,
	pick: (tab: TLankaDevtoolsPanelTab) => void,
): HTMLElement => {
	const strip = document.createElement("div");
	strip.style.cssText = "display:flex;gap:4px;margin-bottom:6px";

	const buttons = TABS.map((tab) =>
		button(tab, () => {
			pick(tab);
			for (const [index, element] of buttons.entries()) {
				element.style.opacity = TABS[index] === current() ? "1" : ".55";
			}
		}),
	);
	for (const [index, element] of buttons.entries()) {
		element.style.opacity = TABS[index] === current() ? "1" : ".55";
		strip.append(element);
	}

	return strip;
};

const filterInput = (onType: (value: string) => void): HTMLElement => {
	const field = document.createElement("input");
	field.placeholder = "filter";
	field.style.cssText =
		"width:100%;box-sizing:border-box;margin-bottom:6px;background:#000;color:#eee;" +
		"border:1px solid #333;border-radius:3px;padding:2px 4px;font:inherit";
	field.addEventListener("input", () => {
		onType(field.value);
	});
	return field;
};

const button = (label: string, onClick: () => void): HTMLElement => {
	const element = document.createElement("button");
	element.type = "button";
	element.textContent = label;
	element.style.cssText =
		"background:#222;color:#eee;border:1px solid #333;border-radius:3px;" +
		"padding:1px 6px;font:inherit;cursor:pointer";
	element.addEventListener("click", onClick);
	return element;
};

const TONE_COLOR = { bad: "#ff8a80", quiet: "#8a8a8a" } as const;

const line = (text: string, tone?: "bad" | "quiet"): HTMLElement => {
	const element = document.createElement("div");
	element.textContent = text;
	if (tone) element.style.color = TONE_COLOR[tone];
	return element;
};
