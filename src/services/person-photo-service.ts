import {
  PERSON_PHOTOS_BUCKET,
  PHOTO_SIGNED_URL_TTL_SECONDS,
  createPersonPhotoPath,
  isValidPersonPhotoPath,
} from "@/lib/photo-constants";
import {
  getCachedPhotoUrl,
  invalidatePhotoUrlCache,
  setCachedPhotoUrl,
} from "@/lib/photo-url-cache";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { DbPerson } from "@/lib/supabase/types";
import { FamilyDataError, mapRpcError } from "@/services/family-service";

export interface SetPersonPhotoResult {
  person: DbPerson;
  previousPhotoPath: string | null;
  newPhotoPath: string;
}

export interface ClearPersonPhotoResult {
  person: DbPerson;
  previousPhotoPath: string | null;
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new FamilyDataError(
      "Фотографии недоступны: используются локальные тестовые данные",
    );
  }
  return client;
}

function asPersonRow(value: unknown): DbPerson {
  if (!value || typeof value !== "object") {
    throw new FamilyDataError("Не удалось сохранить фотографию");
  }
  return value as DbPerson;
}

export { createPersonPhotoPath, invalidatePhotoUrlCache };

export async function uploadPersonPhoto(
  personId: string,
  blob: Blob,
  extension: "webp" | "jpg" | "jpeg" | "png",
): Promise<string> {
  const client = requireClient();
  const path = createPersonPhotoPath(personId, extension);
  if (!isValidPersonPhotoPath(path, personId)) {
    throw new FamilyDataError("Некорректный путь фотографии");
  }

  const contentType =
    extension === "webp"
      ? "image/webp"
      : extension === "png"
        ? "image/png"
        : "image/jpeg";

  const { error } = await client.storage
    .from(PERSON_PHOTOS_BUCKET)
    .upload(path, blob, {
      cacheControl: "3600",
      contentType,
      upsert: false,
    });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[person-photo] upload failed", error.message);
    }
    throw new FamilyDataError("Не удалось загрузить фотографию");
  }

  return path;
}

export async function setPersonPhoto(
  personId: string,
  photoPath: string,
): Promise<SetPersonPhotoResult> {
  const client = requireClient();
  if (!isValidPersonPhotoPath(photoPath, personId)) {
    throw new FamilyDataError("Некорректный путь фотографии");
  }

  const { data, error } = await client.rpc("set_person_photo", {
    target_person_id: personId,
    new_photo_path: photoPath,
  });

  if (error) {
    throw new FamilyDataError(
      mapRpcError(error.message, "Не удалось сохранить фотографию"),
    );
  }

  if (!data || typeof data !== "object") {
    throw new FamilyDataError("Не удалось сохранить фотографию");
  }

  const row = data as {
    person?: unknown;
    previous_photo_path?: string | null;
    new_photo_path?: string | null;
  };

  const person = asPersonRow(row.person);
  const previousPhotoPath =
    typeof row.previous_photo_path === "string" ? row.previous_photo_path : null;
  const newPhotoPath =
    typeof row.new_photo_path === "string" ? row.new_photo_path : photoPath;

  if (previousPhotoPath) {
    invalidatePhotoUrlCache(previousPhotoPath);
  }

  return { person, previousPhotoPath, newPhotoPath };
}

export async function removeStoredPhoto(
  photoPath: string | null | undefined,
): Promise<boolean> {
  if (!photoPath || !isValidPersonPhotoPath(photoPath)) {
    return true;
  }

  const client = getSupabaseClient();
  if (!client) {
    return false;
  }

  const { error } = await client.storage
    .from(PERSON_PHOTOS_BUCKET)
    .remove([photoPath]);

  invalidatePhotoUrlCache(photoPath);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[person-photo] remove failed", error.message);
    }
    return false;
  }
  return true;
}

/**
 * Two-phase replace: upload new → RPC → delete old (best-effort).
 * On RPC failure, deletes only the newly uploaded file.
 */
export async function replacePersonPhoto(
  personId: string,
  blob: Blob,
  extension: "webp" | "jpg",
  onStage?: (stage: "upload" | "save") => void,
): Promise<{
  result: SetPersonPhotoResult;
  oldFileCleanupFailed: boolean;
}> {
  onStage?.("upload");
  const newPath = await uploadPersonPhoto(personId, blob, extension);

  try {
    onStage?.("save");
    const result = await setPersonPhoto(personId, newPath);
    let oldFileCleanupFailed = false;
    if (
      result.previousPhotoPath &&
      result.previousPhotoPath !== result.newPhotoPath
    ) {
      const removed = await removeStoredPhoto(result.previousPhotoPath);
      oldFileCleanupFailed = !removed;
    }
    return { result, oldFileCleanupFailed };
  } catch (error) {
    await removeStoredPhoto(newPath);
    throw error;
  }
}

export async function clearPersonPhoto(
  personId: string,
): Promise<{
  result: ClearPersonPhotoResult;
  fileCleanupFailed: boolean;
}> {
  const client = requireClient();
  const { data, error } = await client.rpc("clear_person_photo", {
    target_person_id: personId,
  });

  if (error) {
    throw new FamilyDataError(
      mapRpcError(error.message, "Не удалось удалить фотографию"),
    );
  }

  if (!data || typeof data !== "object") {
    throw new FamilyDataError("Не удалось удалить фотографию");
  }

  const row = data as {
    person?: unknown;
    previous_photo_path?: string | null;
  };

  const person = asPersonRow(row.person);
  const previousPhotoPath =
    typeof row.previous_photo_path === "string" ? row.previous_photo_path : null;

  if (previousPhotoPath) {
    invalidatePhotoUrlCache(previousPhotoPath);
  }

  let fileCleanupFailed = false;
  if (previousPhotoPath) {
    const removed = await removeStoredPhoto(previousPhotoPath);
    fileCleanupFailed = !removed;
  }

  return {
    result: { person, previousPhotoPath },
    fileCleanupFailed,
  };
}

export async function getSignedPhotoUrl(
  photoPath: string,
): Promise<string | null> {
  if (!isValidPersonPhotoPath(photoPath)) {
    return null;
  }

  const cached = getCachedPhotoUrl(photoPath);
  if (cached) {
    return cached;
  }

  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) {
    return null;
  }

  const { data, error } = await client.storage
    .from(PERSON_PHOTOS_BUCKET)
    .createSignedUrl(photoPath, PHOTO_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    if (process.env.NODE_ENV === "development") {
      console.error("[person-photo] signed url failed", error?.message);
    }
    return null;
  }

  setCachedPhotoUrl(photoPath, data.signedUrl);
  return data.signedUrl;
}

export async function getSignedPhotoUrls(
  photoPaths: Iterable<string>,
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      [...photoPaths].filter(
        (path): path is string =>
          typeof path === "string" && isValidPersonPhotoPath(path),
      ),
    ),
  ];

  const result = new Map<string, string>();
  const missing: string[] = [];

  for (const path of unique) {
    const cached = getCachedPhotoUrl(path);
    if (cached) {
      result.set(path, cached);
    } else {
      missing.push(path);
    }
  }

  if (missing.length === 0) {
    return result;
  }

  const client = getSupabaseClient();
  if (!client) {
    return result;
  }

  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) {
    return result;
  }

  const { data, error } = await client.storage
    .from(PERSON_PHOTOS_BUCKET)
    .createSignedUrls(missing, PHOTO_SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    if (process.env.NODE_ENV === "development") {
      console.error("[person-photo] batch signed urls failed", error?.message);
    }
    return result;
  }

  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) {
      setCachedPhotoUrl(item.path, item.signedUrl);
      result.set(item.path, item.signedUrl);
    }
  }

  return result;
}
