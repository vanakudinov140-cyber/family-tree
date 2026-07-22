import { PERSON_PHOTOS_BUCKET, PHOTO_SIGNED_URL_TTL_SECONDS } from "@/lib/photo-constants";
import {
  createProposalPhotoPath,
  isValidProposalPhotoPath,
} from "@/lib/family-proposal-schema";
import { getSupabaseClient } from "@/lib/supabase/client";
import { FamilyDataError } from "@/services/family-service";

export async function uploadProposalPhoto(
  userId: string,
  blob: Blob,
  extension: "webp" | "jpg",
): Promise<string> {
  const client = getSupabaseClient();
  if (!client) {
    throw new FamilyDataError("Не удалось загрузить фотографию");
  }

  const path = createProposalPhotoPath(userId, extension);
  if (!isValidProposalPhotoPath(path, userId)) {
    throw new FamilyDataError("Некорректный путь предложенной фотографии");
  }

  const contentType = extension === "webp" ? "image/webp" : "image/jpeg";
  const { error } = await client.storage.from(PERSON_PHOTOS_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    contentType,
    upsert: false,
  });

  if (error) {
    throw new FamilyDataError("Не удалось загрузить фотографию");
  }

  return path;
}

export async function removeProposalPhoto(
  photoPath: string | null | undefined,
): Promise<boolean> {
  if (!photoPath || !isValidProposalPhotoPath(photoPath)) {
    return true;
  }

  const client = getSupabaseClient();
  if (!client) {
    return false;
  }

  const { error } = await client.storage
    .from(PERSON_PHOTOS_BUCKET)
    .remove([photoPath]);

  return !error;
}

export async function getSignedProposalPhotoUrl(
  photoPath: string,
): Promise<string | null> {
  if (!isValidProposalPhotoPath(photoPath)) {
    return null;
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
    return null;
  }

  return data.signedUrl;
}

export async function downloadProposalPhotoBlob(photoPath: string): Promise<Blob> {
  const signedUrl = await getSignedProposalPhotoUrl(photoPath);
  if (!signedUrl) {
    throw new FamilyDataError("Не удалось получить предложенную фотографию");
  }

  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new FamilyDataError("Не удалось скачать предложенную фотографию");
  }

  return response.blob();
}
