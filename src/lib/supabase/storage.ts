import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

/**
 * Sanitiza nombres de archivo
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 100);
}

/**
 * Sube una imagen de producto
 * Ruta: {vendorId}/{productId}/{filename}
 */
export async function uploadProductImage(
  supabase: SupabaseClient,
  file: File,
  vendorId: string,
  productId: string
): Promise<{ path: string; url: string }> {
  // Validación en cliente
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    throw new Error("La imagen no debe superar 5MB");
  }

  const validMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!validMimes.includes(file.type)) {
    throw new Error("Formato de imagen no válido (JPEG, PNG, WebP, GIF)");
  }

  const uuid = uuidv4();
  const sanitized = sanitizeFileName(file.name);
  const fileName = `${uuid}_${sanitized}`;
  const path = `${vendorId}/${productId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(data.path);

  return {
    path: data.path,
    url: publicUrl,
  };
}

/**
 * Sube un archivo ZIP de producto
 * Ruta: {vendorId}/{productId}/{versionId}/{filename}
 */
export async function uploadProductFile(
  supabase: SupabaseClient,
  file: File,
  vendorId: string,
  productId: string,
  versionId: string
): Promise<{ path: string; size: number }> {
  // Validación en cliente
  const MAX_SIZE = 100 * 1024 * 1024; // 100MB
  if (file.size > MAX_SIZE) {
    throw new Error("El archivo no debe superar 100MB");
  }

  const validMimes = [
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
  ];
  if (!validMimes.includes(file.type) && !file.name.endsWith(".zip")) {
    throw new Error("Solo se aceptan archivos ZIP");
  }

  const uuid = uuidv4();
  const sanitized = sanitizeFileName(file.name);
  const fileName = `${uuid}_${sanitized}`;
  const path = `${vendorId}/${productId}/${versionId}/${fileName}`;

  const { data, error } = await supabase.storage
    .from("product-files")
    .upload(path, file, {
      cacheControl: "0", // No cachear archivos de descarga
      upsert: false,
    });

  if (error) throw error;

  return {
    path: data.path,
    size: file.size,
  };
}

/**
 * Genera una URL firmada (temporal) para descargar un archivo
 * Válida por 60 segundos
 */
export async function getSignedDownloadUrl(
  supabase: SupabaseClient,
  filePath: string,
  expiresIn: number = 60
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("product-files")
    .createSignedUrl(filePath, expiresIn);

  if (error) throw error;

  return data.signedUrl;
}

/**
 * Elimina una imagen del Storage
 */
export async function deleteProductImage(
  supabase: SupabaseClient,
  filePath: string
): Promise<void> {
  const { error } = await supabase.storage
    .from("product-images")
    .remove([filePath]);

  if (error) throw error;
}

/**
 * Elimina un archivo del Storage
 */
export async function deleteProductFile(
  supabase: SupabaseClient,
  filePath: string
): Promise<void> {
  const { error } = await supabase.storage
    .from("product-files")
    .remove([filePath]);

  if (error) throw error;
}
