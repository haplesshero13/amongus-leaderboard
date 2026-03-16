const inFlightRequests = new Map<string, Promise<unknown>>();

export function runWithInFlightDedup<T>(
  key: string,
  requestFactory: () => Promise<T>
): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = Promise.resolve()
    .then(requestFactory)
    .finally(() => {
      if (inFlightRequests.get(key) === request) {
        inFlightRequests.delete(key);
      }
    });

  inFlightRequests.set(key, request);
  return request;
}
