import type { PluginAPI } from '@ampcode/plugin'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

/** Cursor/Grok CLI tool names registered by this shim (mirrors pi-xai-oauth XAI_CURSOR_TOOL_NAMES). */
export const CURSOR_TOOL_NAMES = [
	'Shell',
	'LS',
	'Grep',
	'Glob',
	'Edit',
	'StrReplace',
	'Write',
	'Delete',
	'WebSearch',
] as const

export type CursorToolName = (typeof CURSOR_TOOL_NAMES)[number]

const DEFAULT_CURSOR_GLOB_LIMIT = 1000
const DEFAULT_CURSOR_GREP_LIMIT = 1000

// --- Argument helpers (aligned with pi-xai-oauth cursor-args.ts) ---

/** Coerce Cursor/Grok CLI-style tool arguments into an object. */
export function objectFromCursorArgs(value: unknown): Record<string, unknown> {
	if (!value) return {}
	if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
	if (typeof value !== 'string') return {}
	const trimmed = value.trim()
	if (!trimmed) return {}
	try {
		const parsed = JSON.parse(trimmed)
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>
		}
	} catch {
		// Plain string arguments are common; callers decide how to use them.
	}
	return { value: trimmed }
}

/** Return the first non-empty string-like argument. */
export function firstString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) return value
	}
}

function firstNumber(...values: unknown[]): number | undefined {
	for (const value of values) {
		if (typeof value === 'number' && Number.isFinite(value)) return value
		if (typeof value === 'string' && value.trim()) {
			const parsed = Number(value)
			if (Number.isFinite(parsed)) return parsed
		}
	}
}

function firstBoolean(...values: unknown[]): boolean | undefined {
	for (const value of values) {
		if (typeof value === 'boolean') return value
		if (typeof value === 'string' && value.trim()) {
			const normalized = value.trim().toLowerCase()
			if (['true', '1', 'yes', 'y'].includes(normalized)) return true
			if (['false', '0', 'no', 'n'].includes(normalized)) return false
		}
	}
}

function cursorPath(params: Record<string, unknown>): string | undefined {
	return firstString(
		params.path,
		params.file_path,
		params.filePath,
		params.target_file,
		params.targetFile,
		params.value,
	)
}

function cursorContent(params: Record<string, unknown>): string | undefined {
	return firstString(params.content, params.contents, params.text, params.value)
}

function cursorOldText(params: Record<string, unknown>): string | undefined {
	return firstString(
		params.oldText,
		params.old_text,
		params.old_string,
		params.oldString,
		params.old,
		params.target,
	)
}

function cursorNewText(params: Record<string, unknown>): string | undefined {
	return firstString(
		params.newText,
		params.new_text,
		params.new_string,
		params.newString,
		params.new,
		params.replacement,
	)
}

function cursorSearchPattern(params: Record<string, unknown>): string | undefined {
	return firstString(params.pattern, params.query, params.regex, params.substring, params.value)
}

function cursorGlob(params: Record<string, unknown>): string | undefined {
	return firstString(
		params.glob,
		params.include,
		params.glob_pattern,
		params.globPattern,
		params.glob_filter,
		params.globFilter,
		params.filter,
	)
}

/** Normalize arguments for the Cursor/Grok CLI Write shim. */
export function normalizeWriteArgs(args: unknown) {
	const params = objectFromCursorArgs(args)
	return {
		path: cursorPath(params) || '',
		content: cursorContent(params) ?? '',
	}
}

/** Normalize arguments for the Cursor/Grok CLI Edit/StrReplace shims. */
export function normalizeEditArgs(args: unknown) {
	const params = objectFromCursorArgs(args)
	if (Array.isArray(params.edits)) {
		return {
			path: cursorPath(params) || '',
			edits: params.edits.map((edit: unknown) => {
				const item = objectFromCursorArgs(edit)
				return { oldText: cursorOldText(item) || '', newText: cursorNewText(item) ?? '' }
			}),
		}
	}
	return {
		path: cursorPath(params) || '',
		edits: [{ oldText: cursorOldText(params) || '', newText: cursorNewText(params) ?? '' }],
	}
}

/** Normalize arguments for the Cursor/Grok CLI Grep shim. */
export function normalizeGrepArgs(args: unknown) {
	const params = objectFromCursorArgs(args)
	const pattern = cursorSearchPattern(params)
	if (!pattern) {
		const received = Object.keys(params).sort().join(', ') || '(none)'
		throw new Error(`Grep requires a non-empty pattern (or query alias). Received keys: ${received}`)
	}
	return {
		pattern,
		path: firstString(
			params.path,
			params.directory,
			params.dir,
			params.folder,
			params.file_path,
			params.filePath,
		),
		glob: cursorGlob(params),
		ignoreCase: firstBoolean(
			params.ignoreCase,
			params.ignore_case,
			params.case_insensitive,
			params.caseInsensitive,
		),
		literal: firstBoolean(params.literal, params.fixed_strings, params.fixedStrings),
		context: firstNumber(params.context, params.context_lines, params.contextLines),
		limit: firstNumber(params.limit, params.max_results, params.maxResults),
	}
}

/** Normalize arguments for the Cursor/Grok CLI Glob shim. */
export function normalizeGlobArgs(args: unknown) {
	const params = objectFromCursorArgs(args)
	return {
		pattern:
			firstString(
				params.pattern,
				params.glob,
				params.glob_pattern,
				params.globPattern,
				params.query,
				params.value,
			) || '**/*',
		path: firstString(params.path, params.directory, params.dir, params.folder, params.cwd),
		limit: firstNumber(params.limit, params.max_results, params.maxResults),
	}
}

/** Normalize arguments for the Cursor/Grok CLI LS shim. */
export function normalizeLsArgs(args: unknown) {
	const params = objectFromCursorArgs(args)
	return {
		path: cursorPath(params) ?? firstString(params.dir_path) ?? '.',
		limit: firstNumber(params.limit, params.max_results, params.maxResults),
	}
}

/** Normalize arguments for the Cursor/Grok CLI Shell shim. */
export function normalizeShellArgs(args: unknown) {
	const params = objectFromCursorArgs(args)
	return {
		command: firstString(params.command, params.cmd, params.value) || '',
		timeout: firstNumber(params.timeout, params.timeout_ms, params.timeoutMs),
	}
}

/** Normalize arguments for the Cursor/Grok CLI Delete shim. */
export function normalizeDeleteArgs(args: unknown) {
	const params = objectFromCursorArgs(args)
	return {
		path: cursorPath(params) || '',
		recursive: firstBoolean(params.recursive, params.directory, params.dir) ?? false,
	}
}

/** Normalize arguments for the Cursor/Grok CLI WebSearch shim. */
export function normalizeWebSearchArgs(args: unknown) {
	const params = objectFromCursorArgs(args)
	return {
		query: firstString(params.query, params.search_term, params.value) || '',
	}
}

// --- Workspace / shell helpers ---

/** Resolve a requested path while refusing operations outside the workspace. */
export function safeWorkspacePath(amp: PluginAPI, requestedPath: string): string {
	const workspaceRoot = amp.system.workspaceRoot
	if (!workspaceRoot) throw new Error('No workspace is open.')
	const workspace = amp.helpers.filePathFromURI(workspaceRoot)
	const resolved = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(workspace, requestedPath)
	const relativePath = relative(workspace, resolved)
	if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
		throw new Error(`Refusing to operate outside the workspace: ${requestedPath}`)
	}
	return resolved
}

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`
}

async function runWorkspaceCommand(amp: PluginAPI, command: string) {
	const workspaceRoot = amp.system.workspaceRoot
	if (!workspaceRoot) throw new Error('No workspace is open.')
	const cwd = amp.helpers.filePathFromURI(workspaceRoot)
	try {
		return await amp.$`sh -lc ${`cd ${shellQuote(cwd)} && ${command}`}`
	} catch (error) {
		const result = error as { exitCode?: number; stdout?: string; stderr?: string }
		return {
			exitCode: result.exitCode ?? 1,
			stdout: result.stdout ?? '',
			stderr: result.stderr ?? (error instanceof Error ? error.message : String(error)),
		}
	}
}

// --- Tool registration (Amp PluginAPI; schemas aligned with pi-xai-oauth cursor-shims.ts) ---

/**
 * Register Cursor/Grok CLI compatibility shims.
 * Mirrors pi-xai-oauth `registerCursorToolShims`, adapted to Amp's PluginAPI.
 */
export function registerCursorToolShims(amp: PluginAPI) {
	const register = (definition: Parameters<PluginAPI['registerTool']>[0]) => {
		try {
			amp.registerTool(definition)
		} catch (error) {
			amp.logger.log(
				`Skipping ${definition.name} wrapper: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	// Shell — command/cmd + optional timeout (pi-xai-oauth schema)
	register({
		name: 'Shell',
		description:
			'Cursor/Grok CLI compatibility shim for the existing shell capability. Executes command/cmd in the workspace shell.',
		inputSchema: {
			type: 'object',
			properties: {
				command: { type: 'string', description: 'Shell command to execute' },
				cmd: { type: 'string', description: 'Alias for command' },
				timeout: { type: 'number', description: 'Timeout in milliseconds' },
			},
			required: [],
		},
		async execute(input) {
			const { command } = normalizeShellArgs(input)
			if (!command) return 'Error: Shell requires command or cmd.'
			const result = await runWorkspaceCommand(amp, command)
			return [`exitCode: ${result.exitCode}`, result.stdout, result.stderr].filter(Boolean).join('\n')
		},
	})

	// LS — path + limit (pi-xai-oauth schema)
	register({
		name: 'LS',
		description:
			'Cursor/Grok CLI compatibility shim for listing workspace files. Prefer the native Read tool for file contents.',
		inputSchema: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Directory or file path' },
				dir_path: { type: 'string', description: 'Alias for path' },
				limit: { type: 'number', description: 'Maximum entries to return' },
			},
			required: [],
		},
		async execute(input) {
			const { path: requestedPath } = normalizeLsArgs(input)
			const path = safeWorkspacePath(amp, requestedPath || '.')
			const result = await runWorkspaceCommand(amp, `ls -la ${shellQuote(path)}`)
			return result.stdout || result.stderr || `exitCode: ${result.exitCode}`
		},
	})

	// Grep — pattern required in spirit; query alias; include/glob/ignoreCase/literal/context/limit
	register({
		name: 'Grep',
		description:
			'Search file contents for a required pattern (search regex/string). query is an optional alias for pattern. include/glob only filter which files are searched — they are not the search text.',
		inputSchema: {
			type: 'object',
			properties: {
				pattern: {
					type: 'string',
					description:
						'REQUIRED search text (regex or literal). This is the string to find in files — not a file glob.',
				},
				query: {
					type: 'string',
					description: 'Alias for pattern (Cursor/Grok CLI style). Mapped to pattern before execution.',
				},
				path: { type: 'string', description: 'Directory or file to search' },
				include: {
					type: 'string',
					description: 'Glob filter for which files to search, e.g. *.ts (NOT the search text)',
				},
				glob: {
					type: 'string',
					description: 'Glob filter for which files to search, e.g. *.ts (NOT the search text)',
				},
				glob_filter: { type: 'string', description: 'Cursor-style alias for glob' },
				ignoreCase: { type: 'boolean', description: 'Case-insensitive search' },
				literal: {
					type: 'boolean',
					description: 'Treat pattern as a literal string instead of regex',
				},
				context: {
					type: 'number',
					description: 'Number of context lines before/after each match',
				},
				limit: { type: 'number', description: 'Maximum matches' },
			},
			required: [],
		},
		async execute(input) {
			let params: ReturnType<typeof normalizeGrepArgs>
			try {
				params = normalizeGrepArgs(input)
			} catch (error) {
				return `Error: ${error instanceof Error ? error.message : String(error)}`
			}
			const requestedPath = params.path ?? '.'
			const limit = Math.min(params.limit ?? DEFAULT_CURSOR_GREP_LIMIT, DEFAULT_CURSOR_GREP_LIMIT)
			const flags = [
				'--line-number',
				'--no-heading',
				'--color=never',
				`--max-count ${Math.max(1, limit)}`,
			]
			if (params.literal) flags.push('--fixed-strings')
			if (params.ignoreCase) flags.push('--ignore-case')
			if (params.context && params.context > 0) {
				flags.push(`--context ${Math.min(20, Math.floor(params.context))}`)
			}
			if (params.glob) flags.push(`--glob ${shellQuote(params.glob)}`)
			const result = await runWorkspaceCommand(
				amp,
				`rg ${flags.join(' ')} -- ${shellQuote(params.pattern)} ${shellQuote(safeWorkspacePath(amp, requestedPath))}`,
			)
			return (
				result.stdout ||
				(result.exitCode === 1
					? 'No matches found.'
					: result.stderr || `exitCode: ${result.exitCode}`)
			)
		},
	})

	// Glob — pattern/glob + path + limit
	register({
		name: 'Glob',
		description:
			'Cursor/Grok CLI compatibility shim for finding files. Finds files matching pattern/glob.',
		inputSchema: {
			type: 'object',
			properties: {
				pattern: { type: 'string', description: 'Glob pattern, e.g. **/*.ts' },
				glob: { type: 'string', description: 'Cursor-style alias for pattern' },
				path: { type: 'string', description: 'Directory to search' },
				limit: { type: 'number', description: 'Maximum results' },
			},
			required: [],
		},
		async execute(input) {
			const params = normalizeGlobArgs(input)
			if (!params.pattern) return 'Error: Glob requires pattern or glob.'
			const requestedPath = params.path ?? '.'
			const limit = Math.min(params.limit ?? DEFAULT_CURSOR_GLOB_LIMIT, DEFAULT_CURSOR_GLOB_LIMIT)
			// Use find -name for simple patterns; for **/* style, strip to basename pattern
			const namePattern = params.pattern.includes('/')
				? params.pattern.split('/').pop() || params.pattern
				: params.pattern
			const result = await runWorkspaceCommand(
				amp,
				`find ${shellQuote(safeWorkspacePath(amp, requestedPath))} -path '*/.git' -prune -o -path '*/node_modules' -prune -o -name ${shellQuote(namePattern)} -print | head -n ${Math.max(1, limit)}`,
			)
			return result.stdout || result.stderr || 'No files found.'
		},
	})

	const registerEditWrapper = (name: 'Edit' | 'StrReplace') =>
		register({
			name,
			description:
				name === 'StrReplace'
					? 'Cursor/Grok CLI compatibility shim for exact string replacement. Accepts old_string/new_string or oldText/newText.'
					: 'Cursor/Grok CLI compatibility shim for edit. Accepts edits or old_string/new_string aliases.',
			inputSchema: {
				type: 'object',
				properties: {
					path: { type: 'string', description: 'Path to edit' },
					file_path: { type: 'string', description: 'Cursor-style alias for path' },
					...(name === 'Edit'
						? {
								edits: {
									type: 'array',
									description:
										'Array of { oldText/old_string, newText/new_string } replacements',
								},
							}
						: {}),
					old_string: { type: 'string', description: 'Text to replace' },
					new_string: { type: 'string', description: 'Replacement text' },
					oldText: { type: 'string', description: 'pi-style alias for old_string' },
					newText: { type: 'string', description: 'pi-style alias for new_string' },
				},
				required: [],
			},
			async execute(input) {
				const params = normalizeEditArgs(input)
				if (!params.path) return `Error: ${name} requires path/file_path.`
				if (!params.edits.length || params.edits.every((e) => !e.oldText)) {
					return `Error: ${name} requires old_string/oldText (or edits).`
				}
				const path = safeWorkspacePath(amp, params.path)
				let original = await readFile(path, 'utf8')
				let applied = 0
				for (const edit of params.edits) {
					if (!edit.oldText) continue
					if (!original.includes(edit.oldText)) {
						return `Error: old_string was not found in ${params.path}.`
					}
					original = original.replace(edit.oldText, edit.newText)
					applied += 1
				}
				await writeFile(path, original, 'utf8')
				return `Updated ${params.path} (${applied} replacement${applied === 1 ? '' : 's'}).`
			},
		})

	registerEditWrapper('Edit')
	registerEditWrapper('StrReplace')

	// Write — path/file_path + content/contents
	register({
		name: 'Write',
		description:
			'Cursor/Grok CLI compatibility shim for file creation/update in the workspace. Prefer create_file/edit_file for normal Amp calls.',
		inputSchema: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Path to write' },
				file_path: { type: 'string', description: 'Cursor-style alias for path' },
				content: { type: 'string', description: 'Content to write' },
				contents: { type: 'string', description: 'Cursor-style alias for content' },
			},
			required: [],
		},
		async execute(input) {
			const { path: requestedPath, content } = normalizeWriteArgs(input)
			if (!requestedPath) return 'Error: Write requires path or file_path.'
			const path = safeWorkspacePath(amp, requestedPath)
			await mkdir(dirname(path), { recursive: true })
			await writeFile(path, content, 'utf8')
			return `Wrote ${requestedPath}.`
		},
	})

	// Delete — path/file_path + recursive
	register({
		name: 'Delete',
		description:
			'Cursor/Grok CLI compatibility shim for deleting a workspace file. Directories require recursive=true.',
		inputSchema: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Path to delete' },
				file_path: { type: 'string', description: 'Cursor-style alias for path' },
				recursive: { type: 'boolean', description: 'Allow recursive directory deletion' },
			},
			required: [],
		},
		async execute(input) {
			const { path: requestedPath, recursive } = normalizeDeleteArgs(input)
			if (!requestedPath) return 'Error: Delete requires path or file_path.'
			await rm(safeWorkspacePath(amp, requestedPath), {
				recursive: !!recursive,
				force: false,
			})
			return `Deleted ${requestedPath}.`
		},
	})

	// WebSearch — query/search_term (Amp: redirect to native web_search; pi uses xAI API)
	register({
		name: 'WebSearch',
		description:
			'Cursor/Grok CLI compatibility shim. Prefer the native web_search tool; this wrapper turns query/search_term into a web_search-ready objective.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'Search query' },
				search_term: { type: 'string', description: 'Alias for query' },
			},
			required: [],
		},
		async execute(input) {
			const { query } = normalizeWebSearchArgs(input)
			if (!query) return 'Error: WebSearch requires query or search_term.'
			return `Use the native web_search tool with objective: ${query}`
		},
	})
}

/** @deprecated Prefer registerCursorToolShims — kept for local call-site clarity. */
export const registerCursorToolWrappers = registerCursorToolShims

/**
 * Amp loads every `*.ts` under the plugins directory as a plugin entrypoint.
 * Export a default so this shared module is a valid plugin and registers the
 * Cursor/Grok CLI shims once (instead of only via mode-plugin imports).
 */
export default function (amp: PluginAPI) {
	registerCursorToolShims(amp)
}
