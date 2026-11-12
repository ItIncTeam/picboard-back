import DataLoader from 'dataloader';

// An entry may be an Error instead of a value: DataLoader rejects only that
// key's promise and resolves the rest. Throwing inside a batch function
// instead rejects every key in the batch.
export type BatchLoadFn<K, V> = (keys: K[]) => Promise<(V | Error)[]>;

export class DataloaderFactory {
  private loaders = new Map<string, DataLoader<any, any>>();

  create<K, V>(name: string, batchFn: BatchLoadFn<K, V>): DataLoader<K, V> {
    if (!this.loaders.has(name)) {
      this.loaders.set(name, new DataLoader(batchFn));
    }
    return this.loaders.get(name) as DataLoader<K, V>;
  }
}
