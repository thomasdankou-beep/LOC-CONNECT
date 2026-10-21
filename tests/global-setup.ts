import "dotenv/config";
import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.DATABASE_URL_TEST ?? "postgresql://locconnect:locconnect@localhost:5432/locconnect_test?schema=public";
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
