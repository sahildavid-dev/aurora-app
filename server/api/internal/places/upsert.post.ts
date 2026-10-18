import type { Confidence, Place, Prisma } from "@prisma/client";
import { z } from "zod";

const socialsSchema = z.object({
	instagram: z.string().nullable(),
	facebook: z.string().nullable(),
	twitter: z.string().nullable(),
	tiktok: z.string().nullable(),
});

// The capture-agent output shape, plus the capture metadata the webhook
// originally received.
const upsertSchema = z.object({
	name: z.string().min(1, "name is required"),
	category: z.string().min(1, "category is required"),
	lat: z.number().nullable(),
	lng: z.number().nullable(),
	address: z.string().nullable(),
	description: z.string().nullable(),
	hours: z.string().nullable(),
	phone: z.string().nullable(),
	website: z.string().nullable(),
	socials: socialsSchema,
	sourceUrl: z.string().nullable(),
	confidence: z.enum(["high", "medium", "low"]),
	notes: z.string().nullable(),
	messageSid: z.string().min(1, "messageSid is required"),
	from: z.string().min(1, "from is required"),
	receivedAt: z
		.string()
		.datetime({ message: "receivedAt must be an ISO 8601 datetime string" }),
	text: z.string(),
	hasImage: z.boolean(),
});

const CONFIDENCE_MAP: Record<"high" | "medium" | "low", Confidence> = {
	high: "HIGH",
	medium: "MEDIUM",
	low: "LOW",
};

/**
 * The agent's single write path. Matching, merging and creating all happen
 * HERE, not in the Trigger.dev task, so a future bulk import or web-app
 * paste gets identical behaviour to a WhatsApp capture.
 */
export default defineEventHandler(async (event) => {
	assertMethod(event, "POST");
	assertInternalRequest(event);

	const raw = await readBody(event);
	const parsed = upsertSchema.safeParse(raw);
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: parsed.error.issues
				.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
				.join("; "),
		});
	}
	const body = parsed.data;

	// Idempotency at the database level, on top of the Trigger.dev
	// idempotency key: a Capture already exists for this messageSid means
	// this exact message was already processed — don't write again.
	const existingCapture = await prisma.capture.findUnique({
		where: { messageSid: body.messageSid },
		include: { place: true },
	});
	if (existingCapture) {
		return {
			action: "skipped" as const,
			changedFields: [] as string[],
			place: existingCapture.place,
		};
	}

	const vendorId = await resolveCaptureVendorId(body.from);
	const confidence = CONFIDENCE_MAP[body.confidence];
	// Stored verbatim on the Capture row, before any merge rules are applied.
	const agentOutput = {
		name: body.name,
		category: body.category,
		lat: body.lat,
		lng: body.lng,
		address: body.address,
		description: body.description,
		hours: body.hours,
		phone: body.phone,
		website: body.website,
		socials: body.socials,
		sourceUrl: body.sourceUrl,
		confidence: body.confidence,
		notes: body.notes,
	} satisfies Prisma.InputJsonValue;

	const incoming: IncomingPlaceData = {
		name: body.name,
		category: body.category,
		lat: body.lat,
		lng: body.lng,
		address: body.address,
		description: body.description,
		hours: body.hours,
		phone: body.phone,
		website: body.website,
		instagram: body.socials.instagram,
		facebook: body.socials.facebook,
		twitter: body.socials.twitter,
		tiktok: body.socials.tiktok,
		sourceUrl: body.sourceUrl,
		notes: body.notes,
		confidence,
	};

	try {
		return await prisma.$transaction(async (tx) => {
			const nameKey = normaliseName(body.name);
			const match = await findMatch(
				{ vendorId, nameKey, lat: body.lat, lng: body.lng },
				tx,
			);

			let place: Place;
			let action: "created" | "updated" | "skipped";
			let changedFields: string[] = [];

			if (!match) {
				place = await tx.place.create({
					data: {
						vendorId,
						name: body.name,
						nameKey,
						category: body.category,
						lat: body.lat,
						lng: body.lng,
						address: body.address,
						description: body.description,
						hours: body.hours,
						phone: body.phone,
						website: body.website,
						instagram: body.socials.instagram,
						facebook: body.socials.facebook,
						twitter: body.socials.twitter,
						tiktok: body.socials.tiktok,
						sourceUrl: body.sourceUrl,
						notes: body.notes,
						confidence,
						status: confidence === "HIGH" ? "CONFIRMED" : "NEEDS_REVIEW",
					},
				});
				action = "created";
			} else {
				const merged = mergePlace(match, incoming);
				changedFields = merged.changedFields;
				place =
					changedFields.length > 0
						? await tx.place.update({
								where: { id: match.id },
								data: merged.data,
							})
						: match;
				action = changedFields.length > 0 ? "updated" : "skipped";
			}

			await tx.capture.create({
				data: {
					vendorId,
					messageSid: body.messageSid,
					from: body.from,
					text: body.text,
					hasImage: body.hasImage,
					receivedAt: new Date(body.receivedAt),
					agentOutput,
					action,
					placeId: place.id,
				},
			});

			return { action, changedFields, place };
		});
	} catch (error) {
		console.error(
			`capture-agent upsert failed for messageSid=${body.messageSid}:`,
			error,
		);
		throw createError({
			statusCode: 500,
			statusMessage: "Database error while saving place",
		});
	}
});
