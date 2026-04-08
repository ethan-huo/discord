import type { Member } from '../discord.ts'
import type { AppContext } from '../runtime.ts'

import { CliError } from '../errors.ts'
import { printResult } from '../output.ts'

export function printStructured(data: unknown, context: AppContext): void {
	printResult(data, context.config.resolved.format)
}

export function actionResult(
	action: string,
	data?: Record<string, unknown>,
): Record<string, unknown> {
	return {
		action,
		...(data ?? {}),
	}
}

export function requireMemberUser(member: Member): NonNullable<Member['user']> {
	if (!member.user) {
		throw new CliError('Discord returned a member without a user payload.', 1, {
			details: { member },
		})
	}

	return member.user
}
