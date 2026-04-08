import { constants as fsConstants } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

import { CliError, notFoundError, usageError } from './errors.ts'

export async function readStdinText(): Promise<string> {
	return await Bun.stdin.text()
}

export async function ensureFileExists(path: string): Promise<string> {
	const resolved = resolve(path)
	try {
		await access(resolved, fsConstants.R_OK)
	} catch {
		throw notFoundError(`File not found: ${resolved}`)
	}
	return resolved
}

export async function ensureFilesExist(paths: string[]): Promise<string[]> {
	return await Promise.all(paths.map((path) => ensureFileExists(path)))
}

export async function getTotalFileSize(paths: string[]): Promise<number> {
	const sizes = await Promise.all(
		paths.map(async (path) => (await stat(path)).size),
	)
	return sizes.reduce((total, size) => total + size, 0)
}

export async function fileToDataUrl(path: string): Promise<string> {
	const resolved = await ensureFileExists(path)
	const bytes = await readFile(resolved)
	const extension = resolved.toLowerCase().endsWith('.gif')
		? 'gif'
		: resolved.toLowerCase().endsWith('.png')
			? 'png'
			: 'jpeg'
	return `data:image/${extension};base64,${Buffer.from(bytes).toString('base64')}`
}

export function ensureMaxBytes(
	totalBytes: number,
	maxBytes: number,
	label: string,
): void {
	if (totalBytes > maxBytes) {
		throw usageError(`${label} exceeds ${formatBytes(maxBytes)}.`)
	}
}

function formatBytes(value: number): string {
	if (value >= 1024 * 1024) {
		return `${(value / (1024 * 1024)).toFixed(1)} MiB`
	}
	return `${(value / 1024).toFixed(1)} KiB`
}
