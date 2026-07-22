"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { PHOTO_URL_CACHE_TTL_MS } from "@/lib/photo-constants";
import { invalidatePhotoUrlCache } from "@/lib/photo-url-cache";
import { getSignedPhotoUrls } from "@/services/person-photo-service";

/**
 * Batch-fetches signed URLs for visible photo paths.
 * Guests (no session) get an empty map and see monograms.
 */
export function usePersonPhotoUrls(
  photoPaths: Array<string | null | undefined>,
): {
  urlsByPath: Map<string, string>;
  isLoading: boolean;
} {
  const { session } = useAuth();
  const [urlsByPath, setUrlsByPath] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const requestId = useRef(0);

  const normalizedKey = useMemo(() => {
    const unique = [
      ...new Set(
        photoPaths.filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        ),
      ),
    ].sort();
    return unique.join("|");
  }, [photoPaths]);

  const paths = useMemo(
    () => (normalizedKey ? normalizedKey.split("|") : []),
    [normalizedKey],
  );

  useEffect(() => {
    if (!session || paths.length === 0) {
      return;
    }
    // Refresh before signed URLs expire (cache TTL is shorter than link TTL).
    const interval = window.setInterval(
      () => setRefreshTick((value) => value + 1),
      Math.max(60_000, Math.floor(PHOTO_URL_CACHE_TTL_MS * 0.9)),
    );
    return () => window.clearInterval(interval);
  }, [paths, session]);

  useEffect(() => {
    if (!session || paths.length === 0) {
      setUrlsByPath(new Map());
      setIsLoading(false);
      return;
    }

    const currentRequest = ++requestId.current;
    if (refreshTick === 0) {
      setIsLoading(true);
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (refreshTick > 0) {
            for (const path of paths) {
              invalidatePhotoUrlCache(path);
            }
          }
          const next = await getSignedPhotoUrls(paths);
          if (currentRequest !== requestId.current) return;
          setUrlsByPath(next);
        } catch {
          if (currentRequest !== requestId.current) return;
          setUrlsByPath(new Map());
        } finally {
          if (currentRequest === requestId.current) {
            setIsLoading(false);
          }
        }
      })();
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [paths, refreshTick, session]);

  return { urlsByPath, isLoading };
}

export function resolvePersonPhotoUrl(
  photoPath: string | null | undefined,
  urlsByPath: Map<string, string>,
): string | undefined {
  if (!photoPath) return undefined;
  return urlsByPath.get(photoPath);
}
