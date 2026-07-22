import {
  PHOTO_ALLOWED_INPUT_MIME,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_DIMENSION,
  PHOTO_MIN_DIMENSION,
  PHOTO_OUTPUT_MAX_BYTES,
  PHOTO_OUTPUT_SIZE,
  PHOTO_SOURCE_MAX_BYTES,
  PHOTO_WEBP_QUALITY,
  type PhotoInputMime,
} from "@/lib/photo-constants";

export class PhotoProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoProcessingError";
  }
}

export interface CropAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PreparedPersonPhoto {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  extension: "webp" | "jpg";
  width: number;
  height: number;
}

function isAllowedMime(value: string): value is PhotoInputMime {
  return (PHOTO_ALLOWED_INPUT_MIME as readonly string[]).includes(value);
}

export function validatePhotoFile(file: File): void {
  if (!isAllowedMime(file.type)) {
    throw new PhotoProcessingError("Неподдерживаемый формат файла");
  }
  if (file.size > PHOTO_SOURCE_MAX_BYTES) {
    throw new PhotoProcessingError("Файл слишком большой");
  }
  if (file.size === 0) {
    throw new PhotoProcessingError("Не удалось прочитать изображение");
  }
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      // Fall through to HTMLImageElement.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new PhotoProcessingError("Не удалось прочитать изображение"));
      img.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getSourceSize(
  source: ImageBitmap | HTMLImageElement,
): { width: number; height: number } {
  return {
    width: "naturalWidth" in source ? source.naturalWidth || source.width : source.width,
    height:
      "naturalHeight" in source ? source.naturalHeight || source.height : source.height,
  };
}

export async function loadImageForCrop(file: File): Promise<{
  objectUrl: string;
  width: number;
  height: number;
}> {
  validatePhotoFile(file);
  const decoded = await decodeImage(file);
  const { width, height } = getSourceSize(decoded);
  if ("close" in decoded && typeof decoded.close === "function") {
    decoded.close();
  }
  if (width < PHOTO_MIN_DIMENSION || height < PHOTO_MIN_DIMENSION) {
    throw new PhotoProcessingError("Изображение слишком маленькое");
  }
  if (width > PHOTO_MAX_DIMENSION || height > PHOTO_MAX_DIMENSION) {
    throw new PhotoProcessingError("Изображение слишком большое");
  }
  return {
    objectUrl: URL.createObjectURL(file),
    width,
    height,
  };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality);
  });
  if (!blob) {
    throw new PhotoProcessingError("Не удалось подготовить фотографию");
  }
  return blob;
}

export async function preparePersonPhoto(
  source: File | Blob,
  crop: CropAreaPixels,
): Promise<PreparedPersonPhoto> {
  if (source instanceof File) {
    validatePhotoFile(source);
  } else if (!isAllowedMime(source.type || "")) {
    throw new PhotoProcessingError("Неподдерживаемый формат файла");
  }

  if (
    crop.width < PHOTO_MIN_DIMENSION ||
    crop.height < PHOTO_MIN_DIMENSION
  ) {
    throw new PhotoProcessingError("Изображение слишком маленькое");
  }

  const file =
    source instanceof File
      ? source
      : new File([source], "photo", { type: source.type || "image/jpeg" });

  const decoded = await decodeImage(file);
  const { width: srcW, height: srcH } = getSourceSize(decoded);

  if (srcW < PHOTO_MIN_DIMENSION || srcH < PHOTO_MIN_DIMENSION) {
    if ("close" in decoded && typeof decoded.close === "function") {
      decoded.close();
    }
    throw new PhotoProcessingError("Изображение слишком маленькое");
  }

  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_OUTPUT_SIZE;
  canvas.height = PHOTO_OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in decoded && typeof decoded.close === "function") {
      decoded.close();
    }
    throw new PhotoProcessingError("Не удалось подготовить фотографию");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    decoded,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    PHOTO_OUTPUT_SIZE,
    PHOTO_OUTPUT_SIZE,
  );

  if ("close" in decoded && typeof decoded.close === "function") {
    decoded.close();
  }

  let blob: Blob;
  let contentType: "image/webp" | "image/jpeg";
  let extension: "webp" | "jpg";

  try {
    blob = await canvasToBlob(canvas, "image/webp", PHOTO_WEBP_QUALITY);
    if (blob.type !== "image/webp" || blob.size === 0) {
      throw new Error("webp unsupported");
    }
    contentType = "image/webp";
    extension = "webp";
  } catch {
    blob = await canvasToBlob(canvas, "image/jpeg", PHOTO_JPEG_QUALITY);
    contentType = "image/jpeg";
    extension = "jpg";
  }

  canvas.width = 0;
  canvas.height = 0;

  if (blob.size > PHOTO_OUTPUT_MAX_BYTES * 1.5) {
    // Soft target is 2 MB; reject extreme outputs.
    throw new PhotoProcessingError("Не удалось подготовить фотографию");
  }

  return {
    blob,
    contentType,
    extension,
    width: PHOTO_OUTPUT_SIZE,
    height: PHOTO_OUTPUT_SIZE,
  };
}
