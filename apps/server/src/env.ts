import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env.local") });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  TWITCH_REDIRECT_URI: z.string().url().default("http://localhost:3000/auth/callback"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  SESSION_SECRET: z.string().min(32).optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid local configuration: ${missing}`);
}

export const env = {
  ...parsed.data,
  SESSION_SECRET: parsed.data.SESSION_SECRET ?? randomBytes(32).toString("hex")
};
