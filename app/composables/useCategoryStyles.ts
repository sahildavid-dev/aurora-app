import type { CategoryStyleView } from "~/utils/placeIcons";

export interface CategoryItem {
	name: string;
	count: number;
	icon: string | null;
	color: string | null;
	body: string | null;
}

// The vendor's category list (with counts) and the styles they chose, shared between the map
// and the Categories page.
export function useCategoryStyles() {
	const items = useState<CategoryItem[]>("category-items", () => []);
	const loaded = useState("category-items-loaded", () => false);

	async function load() {
		const res = await $fetch<{ items: CategoryItem[] }>("/api/categories");
		items.value = res.items;
		loaded.value = true;
	}

	// name -> style, only for categories the vendor customised (the map falls back to defaults).
	const styles = computed(() => {
		const map: Record<string, CategoryStyleView> = {};
		for (const c of items.value) {
			if (c.icon && c.color)
				map[c.name] = { icon: c.icon, color: c.color, body: c.body };
		}
		return map;
	});

	return { items, loaded, load, styles };
}
