import "dotenv/config";

// Les tests d'intégration tournent sur une base dédiée, jamais sur la base de développement.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? "postgresql://locconnect:locconnect@localhost:5432/locconnect_test?schema=public";
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-test";
process.env.PAYMENT_WEBHOOK_SECRET ??= "test-webhook-secret-1234567890";
process.env.PAYMENT_PROVIDER = "simulated";
