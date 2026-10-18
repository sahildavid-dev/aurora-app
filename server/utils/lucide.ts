import lucide from "@iconify-json/lucide/icons.json";

// The Lucide icon set, for the category icon picker and for map markers (which need the raw
// SVG body). Imported on the server only; the client asks for names and bodies over the API.
const icons = lucide.icons as Record<string, { body: string }>;

export const lucideNames: string[] = Object.keys(icons).sort();

export function lucideBody(name: string): string | null {
	return icons[name]?.body ?? null;
}
