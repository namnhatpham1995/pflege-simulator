let queue: Promise<unknown> = Promise.resolve();

/**
 * The libSQL client uses one connection per process, so overlapping
 * transactions would refuse to start. Writes are queued; correctness across
 * processes rests on the version checks and the unique constraints.
 */
export function serialiseWrites<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work, work);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
