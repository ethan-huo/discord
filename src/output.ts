import { encode } from '@toon-format/toon'

import { toErrorPayload, type ErrorPayload } from './errors.ts'

export type OutputFormat = 'toon' | 'json'

export function renderOutput(data: unknown, format: OutputFormat): string {
	if (format === 'json') {
		return JSON.stringify(data, null, 2)
	}

	// TOON stays compact for agents while still preserving nested structure.
	return encode(data).trimEnd()
}

export function printResult(data: unknown, format: OutputFormat): void {
	console.log(renderOutput(data, format))
}

export function printError(error: unknown, format: OutputFormat): void {
	const payload = toErrorPayload(error)
	console.error(renderOutput(payload, format))
}

export type { ErrorPayload }
