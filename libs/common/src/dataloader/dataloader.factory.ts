import DataLoader from 'dataloader';

export type BatchLoadFn<K, V> = (keys: K[]) => Promise<V[]>;

export class DataloaderFactory {
  private loaders = new Map<string, DataLoader<any, any>>();

  create<K, V>(name: string, batchFn: BatchLoadFn<K, V>): DataLoader<K, V> {
    if (!this.loaders.has(name)) {
      this.loaders.set(name, new DataLoader(batchFn));
    }
    return this.loaders.get(name) as DataLoader<K, V>;
  }
}
