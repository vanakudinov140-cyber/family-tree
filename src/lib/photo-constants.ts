export const PERSON_PHOTOS_BUCKET = "person-photos";

/** Signed URL lifetime requested from Supabase. */
export const PHOTO_SIGNED_URL_TTL_SECONDS = 3600;

/** Local memory cache expires before the signed URL. */
export const PHOTO_URL_CACHE_TTL_MS = 50 * 60 * 1000;

export const PHOTO_SOURCE_MAX_BYTES = 12 * 1024 * 1024;
export const PHOTO_OUTPUT_MAX_BYTES = 2 * 1024 * 1024;
export const PHOTO_MIN_DIMENSION = 300;
export const PHOTO_MAX_DIMENSION = 8000;
export const PHOTO_OUTPUT_SIZE = 1024;
export const PHOTO_WEBP_QUALITY = 0.86;
export const PHOTO_JPEG_QUALITY = 0.88;

export const PHOTO_ALLOWED_INPUT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PhotoInputMime = (typeof PHOTO_ALLOWED_INPUT_MIME)[number];

const PHOTO_PATH_REGEX =
  /^people\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$/i;

export function isValidPersonPhotoPath(
  path: string,
  personId?: string,
): boolean {
  if (!path || path.includes("..") || path.includes("\\")) {
    return false;
  }
  if (/^https?:\/\//i.test(path)) {
    return false;
  }
  if (!PHOTO_PATH_REGEX.test(path)) {
    return false;
  }
  if (personId) {
    const folder = path.split("/")[1]?.toLowerCase();
    if (folder !== personId.toLowerCase()) {
      return false;
    }
  }
  return true;
}

export function createPersonPhotoPath(
  personId: string,
  extension: "webp" | "jpg" | "jpeg" | "png",
): string {
  const fileId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ext = extension === "jpeg" ? "jpg" : extension;
  return `people/${personId}/${fileId}.${ext}`;
}
