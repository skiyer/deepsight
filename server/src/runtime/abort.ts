export type AbortSource = AbortController | AbortSignal | undefined;

const getSignal = (source: AbortSource): AbortSignal | undefined => {
  if (!source) return undefined;
  return source instanceof AbortController ? source.signal : source;
};

export function isAbortError(error: unknown, source?: AbortSource): boolean {
  const signal = getSignal(source);
  if (signal?.aborted) return true;
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || /aborted/i.test(error.message);
}
