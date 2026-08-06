// Клиентское сжатие изображений перед загрузкой в Storage:
// уменьшаем до 1200px по длинной стороне и конвертируем в WebP.
export const MAX_UPLOAD_DIMENSION = 1200;

export type CompressResult = {
  file: File;
  width: number;
  height: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = url;
  });
}

/**
 * Сжимает изображение до maxDim по длинной стороне и отдаёт WebP-файл.
 * Если браузер не умеет WebP через canvas — возвращает исходный файл.
 */
export async function compressImage(
  file: File,
  maxDim: number = MAX_UPLOAD_DIMENSION,
  quality = 0.82,
): Promise<CompressResult> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) {
    return { file, width: 0, height: 0 };
  }
  // SVG и GIF (анимация) не пересжимаем
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return { file, width: 0, height: 0 };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { file, width: 0, height: 0 };
  }

  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { file, width: 0, height: 0 };
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob || blob.type !== "image/webp") {
    return { file, width, height };
  }
  // Если WebP оказался тяжелее оригинала и размер не менялся — оставляем исходник
  if (scale === 1 && blob.size >= file.size) {
    return { file, width, height };
  }
  const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return {
    file: new File([blob], name, { type: "image/webp" }),
    width,
    height,
  };
}
