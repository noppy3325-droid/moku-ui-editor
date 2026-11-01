/** Serial writes prevent an older autosave from completing after a newer document. */
export function createSaveQueue<T>(write: (snapshot: T) => Promise<void>) {
  let settled: Promise<void> = Promise.resolve();
  return {
    enqueue(snapshot: T): Promise<void> {
      const task = settled.then(() => write(snapshot));
      settled = task.catch(() => undefined);
      return task;
    },
    settled: () => settled,
  };
}
