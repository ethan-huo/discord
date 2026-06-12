import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import * as v from 'valibot'

import type { OutputFormat } from './output.ts'

import { CliError, usageError } from './errors.ts'

const CONFIG_FILE_NAME = 'config.json'
const CONFIG_DIR_NAME = 'discord'

const configSchema = v.object({
	token: v.optional(v.string()),
	server: v.optional(v.string()),
	format: v.optional(v.picklist(['yaml', 'json'])),
})

export type AppGlobals = {
	json?: boolean // --json maps to format: 'json'; default output is YAML
	server?: string
}

export type FileConfig = v.InferOutput<typeof configSchema>

export type ResolvedGlobalConfig = {
	token?: string
	server?: string
	format: OutputFormat
}

export type ConfigContext = {
	dir: string
	path: string
	file: FileConfig | null
	resolved: ResolvedGlobalConfig
}

function mergeConfig(
	...parts: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
	return Object.assign({}, ...parts.filter(Boolean))
}

function validateConfig(input: unknown, source: string): FileConfig {
	const result = v.safeParse(configSchema, input)
	if (result.success) {
		return result.output
	}

	throw usageError(`Invalid config from ${source}.`, {
		details: result.issues.map((issue) => ({
			message: issue.message,
			path: issue.path?.map((entry) => String(entry.key)).join('.') ?? null,
		})),
	})
}

export function getConfigDir(): string {
	const override = process.env.DISCORD_CONFIG_DIR
	if (override) return override

	const xdg = process.env.XDG_CONFIG_HOME
	if (xdg) return join(xdg, CONFIG_DIR_NAME)

	return join(homedir(), '.config', CONFIG_DIR_NAME)
}

export function getConfigPath(): string {
	return join(getConfigDir(), CONFIG_FILE_NAME)
}

async function ensureConfigDir(path: string): Promise<void> {
	await mkdir(path, { recursive: true, mode: 0o700 })
}

export async function loadFromFile(
	path: string = getConfigPath(),
): Promise<FileConfig | null> {
	if (!existsSync(path)) return null

	let parsed: unknown
	try {
		parsed = JSON.parse(await readFile(path, 'utf8'))
	} catch (error) {
		throw new CliError(`Invalid config file at ${path}.`, 1, {
			cause: error,
			details: { path },
		})
	}

	return validateConfig(parsed, `file:${path}`)
}

export function resolveFromEnv(): Record<string, unknown> {
	return {
		...(process.env.DISCORD_TOKEN ? { token: process.env.DISCORD_TOKEN } : {}),
		...(process.env.DISCORD_SERVER
			? { server: process.env.DISCORD_SERVER }
			: {}),
		...(process.env.DISCORD_FORMAT
			? { format: process.env.DISCORD_FORMAT }
			: {}),
	}
}

export async function saveFileConfig(
	config: FileConfig,
	path: string = getConfigPath(),
): Promise<void> {
	const validated = validateConfig(config, 'save')
	const dir = dirname(path)
	await ensureConfigDir(dir)

	const body = `${JSON.stringify(validated, null, 2)}\n`
	await writeFile(path, body, { encoding: 'utf8', mode: 0o600 })

	if (process.platform !== 'win32') {
		await chmod(path, 0o600).catch(() => undefined)
		await chmod(dir, 0o700).catch(() => undefined)
	}
}

export async function updateFileConfig(
	patch: Partial<FileConfig>,
	path: string = getConfigPath(),
): Promise<FileConfig> {
	const current = (await loadFromFile(path)) ?? {}
	const next = validateConfig(mergeConfig(current, patch), 'save')

	await saveFileConfig(next, path)
	return next
}

export async function resolveConfigContext(
	globals: AppGlobals,
): Promise<ConfigContext> {
	const dir = getConfigDir()
	const path = getConfigPath()
	const file = await loadFromFile(path)
	// --json is a boolean flag; map it onto the config-shaped `format` field so
	// it merges over file/env like every other global.
	const globalPatch = {
		...(globals.server ? { server: globals.server } : {}),
		...(globals.json ? { format: 'json' } : {}),
	}
	const config = validateConfig(mergeConfig(file, resolveFromEnv()), 'file/env')
	const resolved = validateConfig(mergeConfig(config, globalPatch), 'globals')

	return {
		dir,
		path,
		file,
		resolved: {
			token: resolved.token,
			server: resolved.server,
			format: resolved.format ?? 'yaml',
		},
	}
}
