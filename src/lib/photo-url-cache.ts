import { PHOTO_URL_CACHE_TTL_MS } from "@/lib/photo-constants";

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedPhotoUrl(photoPath: string): string | null {
  const entry = cache.get(photoPath);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(photoPath);
    return null;
  }
  return entry.url;
}

export function setCachedPhotoUrl(
  photoPath: string,
  url: string,
  ttlMs: number = PHOTO_URL_CACHE_TTL_MS,
): void {
  cache.set(photoPath, {
    url,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidatePhotoUrlCache(photoPath?: string | null): void {
  if (!photoPath) {
    cache.clear();
    return;
  }
  cache.delete(photoPath);
}

export function peekCachedPhotoPaths(): string[] {
  return [...cache.keys()];
}
