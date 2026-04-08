import type { Channel, DiscordClient, Emoji, Member, Role } from './discord.ts'

import { CHANNEL_TYPE_NAMES } from './domain.ts'
import {
	normalizeChannelLookup,
	normalizeMemberLookup,
	normalizeRoleLookup,
} from './domain.ts'
import { CliError, notFoundError, usageError } from './errors.ts'

export async function resolveChannel(
	client: DiscordClient,
	guildId: string,
	reference: string,
): Promise<Channel> {
	const channels = await client.listChannels(guildId)

	const byId = channels.find((channel) => channel.id === reference)
	if (byId) return byId

	const lookup = normalizeChannelLookup(reference)
	const matches = channels.filter(
		(channel) => normalizeChannelLookup(channel.name) === lookup,
	)
	if (matches.length === 1) return matches[0]!

	if (matches.length > 1) {
		const names = matches
			.map(
				(channel) =>
					`#${channel.name} (${CHANNEL_TYPE_NAMES[channel.type] ?? '?'})`,
			)
			.join(', ')
		throw new CliError(`Ambiguous channel "${lookup}". Matches: ${names}`, 1)
	}

	throw notFoundError(`Channel "${reference}" not found.`)
}

export async function resolveCategory(
	client: DiscordClient,
	guildId: string,
	reference: string,
): Promise<Channel> {
	const channels = await client.listChannels(guildId)

	const byId = channels.find(
		(channel) => channel.id === reference && channel.type === 4,
	)
	if (byId) return byId

	const lookup = normalizeChannelLookup(reference)
	const matches = channels.filter(
		(channel) =>
			channel.type === 4 && normalizeChannelLookup(channel.name) === lookup,
	)

	if (matches.length === 1) return matches[0]!
	if (matches.length > 1) {
		throw new CliError(`Ambiguous category "${reference}".`, 1)
	}

	throw notFoundError(`Category "${reference}" not found.`)
}

export async function resolveRole(
	client: DiscordClient,
	guildId: string,
	reference: string,
): Promise<Role> {
	const roles = await client.listRoles(guildId)

	const byId = roles.find((role) => role.id === reference)
	if (byId) return byId

	const lookup = normalizeRoleLookup(reference)
	const matches = roles.filter(
		(role) => normalizeRoleLookup(role.name) === lookup,
	)

	if (matches.length === 1) return matches[0]!
	if (matches.length > 1) {
		const names = matches.map((role) => `@${role.name}`).join(', ')
		throw new CliError(`Ambiguous role "${lookup}". Matches: ${names}`, 1)
	}

	throw notFoundError(`Role "${reference}" not found.`)
}

export async function resolveMember(
	client: DiscordClient,
	guildId: string,
	reference: string,
): Promise<Member> {
	if (/^\d+$/.test(reference)) {
		return client.getMember(guildId, reference)
	}

	const lookup = normalizeMemberLookup(reference)
	const candidates = await client.searchMembers(guildId, lookup, 25)
	const exactSearchMatches = candidates.filter((member) =>
		matchesMemberLookup(member, lookup),
	)

	if (exactSearchMatches.length === 1) return exactSearchMatches[0]!
	if (exactSearchMatches.length > 1) {
		const names = exactSearchMatches
			.map((member) => describeMember(member))
			.join(', ')
		throw new CliError(`Ambiguous user "${reference}". Matches: ${names}`, 1)
	}

	// Discord member search is prefix-based for usernames/nicknames and cannot be trusted as an
	// exact resolver, so fall back to a full exact scan before accepting any non-ID member reference.
	const allMembers = await client.listMembers(guildId, Number.POSITIVE_INFINITY)
	const exactMatches = allMembers.filter((member) =>
		matchesMemberLookup(member, lookup),
	)
	if (exactMatches.length === 1) return exactMatches[0]!
	if (exactMatches.length > 1) {
		const names = exactMatches
			.map((member) => describeMember(member))
			.join(', ')
		throw new CliError(`Ambiguous user "${reference}". Matches: ${names}`, 1)
	}

	if (candidates.length > 0) {
		throw usageError(`Member "${reference}" matched only by prefix.`, {
			hint: 'Use the full username, nickname, global display name, or the numeric user ID.',
			details: {
				prefix_matches: candidates
					.slice(0, 10)
					.map((member) => describeMember(member)),
			},
		})
	}

	throw notFoundError(`Member "${reference}" not found.`)
}

export async function resolveEmoji(
	client: DiscordClient,
	guildId: string,
	reference: string,
): Promise<Emoji> {
	const emojis = await client.listEmojis(guildId)
	const emoji = emojis.find(
		(item) =>
			item.id === reference ||
			item.name.toLowerCase() === reference.toLowerCase(),
	)

	if (!emoji) {
		throw notFoundError(`Emoji "${reference}" not found.`)
	}

	return emoji
}

function matchesMemberLookup(member: Member, lookup: string): boolean {
	const username = member.user?.username?.toLowerCase() ?? ''
	const globalName = member.user?.global_name?.toLowerCase() ?? ''
	const nickname = member.nick?.toLowerCase() ?? ''

	return username === lookup || globalName === lookup || nickname === lookup
}

function describeMember(member: Member): string {
	const user = member.user
	if (!user) return '(unknown user payload)'

	const parts = [`${user.username} (${user.id})`]
	if (member.nick) parts.push(`nick:${member.nick}`)
	if (user.global_name) parts.push(`global:${user.global_name}`)
	return parts.join(', ')
}
