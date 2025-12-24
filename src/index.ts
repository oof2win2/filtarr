import { AutoRouter } from "itty-router";
import { loadConfig } from "./config.js";
import { QBittorrentClient } from "./qbittorrent.js";
import { RadarrClient, RadarrWebhookSchema } from "./radarr.js";

const config = await loadConfig();
const qbClient = new QBittorrentClient(config.qbittorrent);
const radarrClient = new RadarrClient(config.radarr);

const router = AutoRouter({ port: config.port });

router.post("/radarr", async (request) => {
	const wh = RadarrWebhookSchema.safeParse(await request.json());
	if (!wh.success) {
		return new Response(JSON.stringify(wh.error), { status: 400 });
	}
	const webhook = wh.data;

	const files = await qbClient.getTorrentFiles(webhook.downloadId);
	if (!qbClient.hasBlacklistedFiles(files, config.blacklistedExtensions)) {
		return new Response("OK");
	}

	const { records: queueItems } = await radarrClient.getQueueItems({
		movieIds: [webhook.movie.id],
	});

	const itemToRemove = queueItems.find(
		(i) => i.downloadId === webhook.downloadId,
	);
	// the item was removed
	if (!itemToRemove) return new Response("OK");

	await radarrClient.removeFromQueue({
		id: itemToRemove.id,
		blocklist: true,
		removeFromClient: true,
	});

	return new Response("OK");
});

// Serve via Bun
export default { ...router };
