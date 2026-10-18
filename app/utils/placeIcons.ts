// Lucide icon bodies (24x24 viewBox) used for map markers, copied from @iconify-json/lucide.
const ICONS: Record<string, string> = {
	star: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"/>',
	heart:
		'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676a.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
	flag: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
	bookmark:
		'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"/>',
	utensils:
		'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20m14-7V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2zm0 0v7"/>',
	coffee:
		'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 2v2m4-2v2m2 4a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2"/>',
	wine: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 22h8M7 10h10m-5 5v7m0-7a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5"/>',
	bed: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
	"shopping-bag":
		'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 10a4 4 0 0 1-8 0M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/></g>',
	trees:
		'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0m-3 6v6m6-3v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/></g>',
	landmark:
		'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 18v-7m1.119-8.795a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949zM14 18v-7m4 7v-7M3 22h18M6 18v-7"/>',
	dumbbell:
		'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829zM2.5 21.5l1.4-1.4M20.1 3.9l1.4-1.4M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829zM9.6 14.4l4.8-4.8"/>',
	"map-pin":
		'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></g>',
	music:
		'<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></g>',
	"book-open":
		'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v16m8.001-2A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2a5 5 0 0 1 4-2z"/>',
	ticket:
		'<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Zm11-4v2m0 10v2m0-8v2"/>',
};

// First matching keyword in the place's free-text category wins; order matters.
const CATEGORY_ICONS: [RegExp, keyof typeof ICONS][] = [
	[/cafe|coffee|bakery|tea/i, "coffee"],
	[/restaurant|food|dining|eat|pizza|burger|brunch|diner/i, "utensils"],
	[/bar|pub|wine|cocktail|brewery|drink/i, "wine"],
	[/hotel|stay|hostel|resort|lodg|airbnb/i, "bed"],
	[/shop|store|market|boutique|mall/i, "shopping-bag"],
	[/park|nature|beach|garden|trail|hike|outdoor|forest/i, "trees"],
	[/museum|gallery|art|landmark|monument|temple|church|historic/i, "landmark"],
	[/gym|fitness|sport|yoga|studio/i, "dumbbell"],
	[/music|club|venue|concert|theatre|theater/i, "music"],
	[/book|library/i, "book-open"],
	[/event|ticket|festival/i, "ticket"],
];

export function placeIconName(category: string): string {
	return CATEGORY_ICONS.find(([re]) => re.test(category))?.[1] ?? "map-pin";
}

// Google Maps' own saved-list markers: a solid coloured disc with a white glyph. The vendor's
// own choice for a category (Categories page) wins; otherwise the list a place belongs to
// picks the colour and glyph, then a type icon (restaurant, cafe...), then a bookmark.
export interface CategoryStyleView {
	icon: string;
	color: string;
	/** Raw SVG body of the icon (from the server) when it is not one of the built-in ones. */
	body: string | null;
}

const LIST_STYLES: [RegExp, { icon: string; color: string }][] = [
	[/favou?rite/i, { icon: "heart", color: "#e0566f" }],
	[/want to go|to go|wishlist|bucket/i, { icon: "flag", color: "#2e8b57" }],
	[/star|saved/i, { icon: "star", color: "#e8a317" }],
];
const DEFAULT_LIST = { icon: "bookmark", color: "#3b82a0" };
const TYPE_DISC = "#3c4c3f";
const FILLED_ICONS = ["star", "heart", "flag", "bookmark"];

/** The look a category has when the vendor has not styled it. */
export function defaultCategoryStyle(category: string): {
	icon: string;
	color: string;
} {
	const list = LIST_STYLES.find(([re]) => re.test(category))?.[1];
	if (list) return list;
	const typeIcon = CATEGORY_ICONS.find(([re]) => re.test(category))?.[1];
	return typeIcon ? { icon: typeIcon, color: TYPE_DISC } : DEFAULT_LIST;
}

// The marker as a data URL for Google Maps: coloured disc, white ring, soft shadow, and a
// white glyph (filled for the list icons, outlined for everything else).
export function placeMarkerUrl(
	category: string,
	styles?: Record<string, CategoryStyleView>,
): string {
	const custom = styles?.[category];
	const { icon, color } = custom ?? defaultCategoryStyle(category);
	const body = (
		custom?.body ??
		ICONS[icon] ??
		ICONS["map-pin"] ??
		""
	).replaceAll(
		'fill="none"',
		FILLED_ICONS.includes(icon) ? 'fill="#fff"' : 'fill="none"',
	);
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
		`<circle cx="20" cy="21.5" r="15" fill="#000" opacity="0.18"/>` +
		`<circle cx="20" cy="20" r="15" fill="${color}" stroke="#fff" stroke-width="2.5"/>` +
		`<g transform="translate(11.5 11.5) scale(0.7083)" color="#fff">${body}</g></svg>`;
	return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
