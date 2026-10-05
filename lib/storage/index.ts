import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";
import { AppError } from "../errors";

/**
 * Stockage de fichiers. Deux familles de clés :
 *  - "public/..." : photos de produits, visibles par tous via /api/files/public/...
 *  - "private/..." : preuves de retour, pièces de litige, preuves de livraison. Jamais publiques :
 *    l'accès passe par /api/files/private/... qui contrôle les droits.
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_ATTACHMENT_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"] as const;
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

class LocalDriver implements StorageDriver {
  private root = path.resolve(env().STORAGE_DIR);

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new AppError("BAD_REQUEST", "Chemin de fichier invalide.");
    return full;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    await writeFile(`${full}.mime`, contentType);
  }

  async get(key: string) {
    const full = this.resolve(key);
    try {
      const body = await readFile(full);
      let contentType = MIME_BY_EXT[path.extname(full).slice(1).toLowerCase()] ?? "application/octet-stream";
      try {
        contentType = (await readFile(`${full}.mime`, "utf8")).trim() || contentType;
      } catch {}
      return { body, contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(key);
    await rm(full, { force: true });
    await rm(`${full}.mime`, { force: true });
  }
}

class S3Driver implements StorageDriver {
  private client = new S3Client({
    region: env().S3_REGION,
    endpoint: env().S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(env().S3_ENDPOINT),
    credentials:
      env().S3_ACCESS_KEY_ID && env().S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env().S3_ACCESS_KEY_ID!, secretAccessKey: env().S3_SECRET_ACCESS_KEY! }
        : undefined,
  });
  private bucket = env().S3_BUCKET ?? "";

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) return null;
      return { body: Buffer.from(bytes), contentType: res.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (!driver) driver = env().STORAGE_DRIVER === "s3" ? new S3Driver() : new LocalDriver();
  return driver;
}

const EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** Contrôle le type réel du fichier à partir de ses octets de tête (et non du seul type annoncé par le client). */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.length > 4 && buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

export async function saveUpload(
  file: File,
  folder: string,
  visibility: "public" | "private",
  allowed: readonly string[] = ALLOWED_IMAGE_TYPES,
): Promise<{ key: string; mimeType: string; size: number }> {
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION_ERROR", "Le fichier dépasse 6 Mo.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime || !allowed.includes(mime)) throw new AppError("VALIDATION_ERROR", "Type de fichier non autorisé.");
  const key = `${visibility}/${folder}/${randomUUID()}.${EXT_BY_MIME[mime]}`;
  await storage().put(key, buf, mime);
  return { key, mimeType: mime, size: buf.length };
}

export const publicUrl = (key: string): string => `/api/files/${key}`;
