import type { APIEmbed } from "discord.js";

export const successEmbed = (title: string, description?: string) => {
	const embed: APIEmbed = { color: 0xedf8aa, author: { name: title, icon_url: "https://r2.aki.wtf/check.png" } };
	if (description !== undefined) {
		embed.description = description;
	}

	return embed;
};

export const errorEmbed = (title: string, description?: string, icon = "report") => {
	const embed: APIEmbed = { color: 0xf44458, author: { name: title, icon_url: `https://r2.aki.wtf/${icon}.png` } };
	if (description !== undefined) {
		embed.description = description;
	}

	return embed;
};
