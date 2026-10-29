// Record and replay (#6). `record` calls the API and saves each response under
// a hash of its request; `replay` serves saved responses and never touches the
// network, so tests and local UI work cost $0 and are deterministic.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { ReplayMissError } from './errors';

export type LLMMode = 'live' | 'record' | 'replay';

/** The one API call the provider makes. The Anthropic client in live use, a stub in tests. */
export type SendMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
  options: { signal?: AbortSignal },
) => Promise<Anthropic.Message>;

/** A saved request and its response, one JSON file per request. */
interface Recording {
  request: Anthropic.MessageCreateParamsNonStreaming;
  response: Anthropic.Message;
}

/** JSON with object keys sorted, so equal requests always hash the same. */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

export function requestKey(params: Anthropic.MessageCreateParamsNonStreaming): string {
  return createHash('sha256').update(stableStringify(params)).digest('hex').slice(0, 32);
}

/** Wraps `send` to save every response in `dir`. */
export function recording(send: SendMessage, dir: string): SendMessage {
  return async (params, options) => {
    const response = await send(params, options);
    const recorded: Recording = { request: params, response };
    await mkdir(dir, { recursive: true });
    // Write then rename, so a crash can't leave a half-written recording behind.
    const path = join(dir, `${requestKey(params)}.json`);
    await writeFile(`${path}.tmp`, `${JSON.stringify(recorded, null, 2)}\n`);
    await rename(`${path}.tmp`, path);
    return response;
  };
}

/** Serves responses saved by `recording`. A request with no recording throws `ReplayMissError`. */
export function replaying(dir: string): SendMessage {
  return async (params) => {
    const key = requestKey(params);
    let text: string;
    try {
      text = await readFile(join(dir, `${key}.json`), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new ReplayMissError(key);
      throw err;
    }
    return (JSON.parse(text) as Recording).response;
  };
}
