import type { AppHandlers } from '../schema.ts'

import { AUDIT_ACTIONS, AUDIT_ACTION_NAMES, parseInteger } from '../domain.ts'
import { usageError } from '../errors.ts'
import { handled } from '../handler.ts'
import { getRuntime } from '../runtime.ts'
import { printStructured } from './helpers.ts'

export const auditHandlers: Pick<AppHandlers, 'audit'> = {
	audit: {
		log: handled(async (options) => {
			const input = options.input
			const context = options.context
			const runtime = await getRuntime(context)
			const limit = input.limit
				? parseInteger(input.limit, { label: 'limit', min: 1, max: 100 })
				: 20

			const actionType = input.type ? AUDIT_ACTIONS[input.type] : undefined
			if (input.type && actionType === undefined) {
				throw usageError(`Unknown action type "${input.type}".`, {
					hint: 'Run "discord audit types" to discover valid action names.',
					details: { available: Object.keys(AUDIT_ACTIONS) },
				})
			}

			const log = await runtime.client.getAuditLog(runtime.guildId!, {
				limit,
				action_type: actionType,
				user_id: input.user,
			})

			const userMap = new Map(log.users.map((user) => [user.id, user.username]))
			const entries = log.audit_log_entries.map((entry) => ({
				id: entry.id,
				action_type: entry.action_type,
				action_name:
					AUDIT_ACTION_NAMES[entry.action_type] ??
					`unknown(${entry.action_type})`,
				actor_id: entry.user_id ?? null,
				actor_username: entry.user_id
					? (userMap.get(entry.user_id) ?? null)
					: null,
				target_id: entry.target_id ?? null,
				reason: entry.reason ?? null,
				changes: entry.changes ?? [],
			}))

			printStructured(entries, context)
		}),

		types: handled(async (options) => {
			const context = options.context
			const types = Object.entries(AUDIT_ACTIONS).map(([name, value]) => ({
				name,
				value,
			}))
			printStructured(types, context)
		}),
	},
}
