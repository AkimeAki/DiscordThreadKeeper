import type { APIEmbed } from "discord.js";

const createEmbed = (color: number, icon: string, title: string, description?: string) => {
	const embed: APIEmbed = { color, author: { name: title, icon_url: `https://r2.aki.wtf/${icon}.png` } };
	if (description !== undefined) {
		embed.description = description;
	}

	return embed;
};

export const successEmbed = (title: string, description?: string) => {
	return createEmbed(0xedf8aa, "check", title, description);
};

export const errorEmbed = (title: string, description?: string, icon = "report") => {
	return createEmbed(0xf44458, icon, title, description);
};
