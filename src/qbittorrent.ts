import got from "got";
import type { Config } from "./config.js";

export interface TorrentFile {
	name: string;
	size: number;
	progress: number;
	priority: number;
	is_seed: boolean;
	availability: number;
}

export interface TorrentInfo {
	hash: string;
	name: string;
	size: number;
	state: string;
	progress: number;
}

export class QBittorrentClient {
	private api: typeof got;
	private authenticated = false;

	constructor(private config: Config["qbittorrent"]) {
		this.api = got.extend({
			prefixUrl: `${this.config.url}/api/v2`,
			hooks: {
				beforeRequest: [
					async () => {
						if (!this.authenticated) await this.authenticate();
					},
				],
			},
		});
	}

	private async authenticate(): Promise<void> {
		if (this.authenticated) return;

		await this.api.post("auth/login", {
			body: new URLSearchParams({
				username: this.config.username,
				password: this.config.password,
			}),
		});

		this.authenticated = true;
	}

	async getTorrentFiles(hash: string): Promise<TorrentFile[]> {
		const response = await this.api
			.get(`torrents/files?hash=${hash}`)
			.json<TorrentFile[]>();

		return response;
	}

	async getTorrentInfo(hash: string): Promise<TorrentInfo> {
		const response = await this.api
			.get(`api/v2/torrents/info?hashes=${hash}`)
			.json<TorrentInfo>();

		return response;
	}

	async resumeTorrent(hash: string): Promise<void> {
		await this.authenticate();

		await this.api.post("torrents/resume", {
			body: new URLSearchParams({
				hashes: hash,
			}),
		});
	}

	hasBlacklistedFiles(
		files: TorrentFile[],
		blacklistedExtensions: string[],
	): boolean {
		return files.some((file) => {
			const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
			return blacklistedExtensions.includes(ext);
		});
	}
}
