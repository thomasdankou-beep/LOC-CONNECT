import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit contenir au moins 32 caractères"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  APP_URL: z.string().url().default("http://localhost:3000"),
  PAYMENT_PROVIDER: z.string().default("simulated"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("LOC'CONNECT <no-reply@locconnect.example>"),
  CRON_SECRET: z.string().min(8).default("change-me-cron"),
  SEED_DEMO_PASSWORD: z.string().default("Demo2026!Loc"),
  DEMO_MODE: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Variables d'environnement validées. Les secrets ne sont lus que côté serveur. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Configuration invalide: ${issues}`);
    }
    // En production, refuser les valeurs d'exemple : un secret publié dans le dépôt n'en est plus un.
    if (process.env.NODE_ENV === "production") {
      const weak = (["AUTH_SECRET", "PAYMENT_WEBHOOK_SECRET", "CRON_SECRET"] as const).filter((k) => /remplacez-moi|change-me/i.test(parsed.data[k]));
      if (weak.length) throw new Error(`Configuration invalide: ${weak.join(", ")} utilise encore une valeur d'exemple. Générez un secret aléatoire (openssl rand -base64 48).`);
    }
    cached = parsed.data;
  }
  return cached;
}
