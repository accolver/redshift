// Store for docs page state
let titleVisible = $state(true);
let currentTitle = $state('');

export const docsStore = {
	get titleVisible() {
		return titleVisible;
	},
	set titleVisible(value: boolean) {
		titleVisible = value;
	},
	get currentTitle() {
		return currentTitle;
	},
	set currentTitle(value: string) {
		currentTitle = value;
	}
};
