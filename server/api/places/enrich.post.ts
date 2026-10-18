const BATCH = 25;
const CONCURRENCY = 5;

// Fills city / region / country for places that have not been geocoded yet. Called repeatedly
// by the Places page until `remaining` is 0; each call does one small batch so it stays well
// inside a serverless request's time limit.
export default defineEventHandler(async (event) => {
	const vendor = await requireVendor(event);
	if (!geocodingConfigured()) {
		throw createError({
			statusCode: 503,
			statusMessage: "GOOGLE_GEOCODING_API_KEY is not set",
		});
	}

	const batch = await prisma.place.findMany({
		where: { vendorId: vendor.id, geocodedAt: null },
		select: { id: true, name: true, lat: true, lng: true, address: true },
		take: BATCH,
	});

	let failure: string | undefined;
	for (let i = 0; i < batch.length && !failure; i += CONCURRENCY) {
		await Promise.all(
			batch.slice(i, i + CONCURRENCY).map(async (place) => {
				try {
					// No coordinates (saved-list imports): find the place by name first. Existing
					// coordinates and addresses are never overwritten.
					const found =
						place.lat === null || place.lng === null
							? await findPlaceByName(
									[place.name, place.address].filter(Boolean).join(", "),
								)
							: null;
					const location = found ?? (await geocodePlace(place));
					await prisma.place.update({
						where: { id: place.id },
						data: {
							...(found
								? {
										lat: found.lat,
										lng: found.lng,
										...(place.address
											? {}
											: { address: found.formattedAddress }),
									}
								: {}),
							city: location?.city,
							region: location?.region,
							country: location?.country,
							countryCode: location?.countryCode,
							geocodedAt: new Date(),
						},
					});
				} catch (error) {
					if (error instanceof GeocodeError && !error.fatal) {
						// Google can't read this one place (e.g. a name that is really coordinates):
						// mark it done so it doesn't block the rest, and move on.
						await prisma.place.update({
							where: { id: place.id },
							data: { geocodedAt: new Date() },
						});
					} else {
						// Quota, bad key, outage: leave geocodedAt unset so a later run retries.
						failure =
							error instanceof Error ? error.message : "Geocoding failed";
					}
				}
			}),
		);
	}
	if (failure) {
		throw createError({ statusCode: 502, statusMessage: failure });
	}

	const remaining = await prisma.place.count({
		where: { vendorId: vendor.id, geocodedAt: null },
	});
	return { processed: batch.length, remaining };
});
