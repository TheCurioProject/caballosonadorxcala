/**
 * Photos picked in CALA's website editors are resized in the browser before
 * they are uploaded. Vercel rejects request bodies above 4.5 MB before our code
 * runs, and camera photos are often bigger, so every upload goes through here.
 *
 * Safari cannot encode WebP from a canvas (it silently returns PNG, which can
 * weigh more than the original), so the encoded type is checked and JPEG is
 * used when WebP is not really produced.
 */
const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Decoded | null> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Older Safari: decode through an <img>.
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * A copy of `file` no larger than `maxSide` pixels and ~3 MB, as WebP (or
 * JPEG where the browser cannot write WebP). Small files of an accepted type
 * are returned as they are.
 */
export async function prepareImage(file: File, maxSide = 2400): Promise<File> {
  if (typeof document === "undefined") return file;
  const decoded = await decode(file);
  if (!decoded) return file;
  try {
    const fits = Math.max(decoded.width, decoded.height) <= maxSide;
    if (fits && file.size <= MAX_BYTES && ACCEPTED.includes(file.type)) return file;
    let side = Math.min(maxSide, Math.max(decoded.width, decoded.height));
    const base = file.name.replace(/\.[^.]+$/, "") || "foto";
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = side / Math.max(decoded.width, decoded.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const context = canvas.getContext("2d");
      if (!context) return file;
      context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      const quality = attempt < 2 ? 0.86 : 0.78;
      let blob = await encode(canvas, "image/webp", quality);
      let type = "image/webp";
      if (!blob || blob.type !== "image/webp") {
        blob = await encode(canvas, "image/jpeg", quality);
        type = "image/jpeg";
      }
      if (!blob) return file;
      if (blob.size <= MAX_BYTES || attempt === 4)
        return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type, lastModified: Date.now() });
      side = Math.round(side * 0.8);
    }
    return file;
  } finally {
    decoded.close();
  }
}
