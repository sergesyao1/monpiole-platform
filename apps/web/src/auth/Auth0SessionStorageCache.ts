import type { Cacheable, ICache } from "@auth0/auth0-react";

const KEY_PREFIX = "monpiole:auth0-cache:";

/** SDK-owned cache scoped to the current browser tab. Never use it for application data. */
export class Auth0SessionStorageCache implements ICache {
  constructor(private readonly storage: Storage = window.sessionStorage) {}

  set<T = Cacheable>(key: string, entry: T): void {
    this.storage.setItem(storageKey(key), JSON.stringify(entry));
  }

  get<T = Cacheable>(key: string): T | undefined {
    const value = this.storage.getItem(storageKey(key));
    if (value === null) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      this.storage.removeItem(storageKey(key));
      return undefined;
    }
  }

  remove(key: string): void {
    this.storage.removeItem(storageKey(key));
  }

  allKeys(): string[] {
    const keys: string[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key.slice(KEY_PREFIX.length));
    }
    return keys;
  }
}

function storageKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}
