import type { AppHandlers } from './schema.ts'

import { auditHandlers } from './handlers/audit.ts'
import { channelHandlers } from './handlers/channel.ts'
import { emojiHandlers } from './handlers/emoji.ts'
import { inviteHandlers } from './handlers/invite.ts'
import { memberHandlers } from './handlers/member.ts'
import { messageHandlers } from './handlers/message.ts'
import { permissionHandlers } from './handlers/permission.ts'
import { roleHandlers } from './handlers/role.ts'
import { serverHandlers } from './handlers/server.ts'

export const handlers: AppHandlers = {
	...serverHandlers,
	...inviteHandlers,
	...channelHandlers,
	...roleHandlers,
	...memberHandlers,
	...permissionHandlers,
	...messageHandlers,
	...emojiHandlers,
	...auditHandlers,
}
