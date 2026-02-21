require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_ORIGIN: z.string().url(),

  // DB
  MONGODB_URI: z.string().min(10),

  // SMTP
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_SECURE: z
    .string()
    .transform(v => v === 'true')
    .or(z.boolean())
    .default(false),
  INQUIRY_TO_EMAIL: z.string().email(),

  // Auth
  JWT_SECRET_KEY: z.string().min(16, 'JWT secret must be >= 32 chars'),
  JWT_EXPIRATION: z.string().default('1h'),
  JWT_REFRESH_SECRET_KEY: z.string().min(16, 'JWT refresh secret must be >= 32 chars'),
  JWT_REFRESH_EXPIRATION: z.string().default('30d'),
  REFRESH_COOKIE_NAME: z.string().default('rt'),

  // Seed admin
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

module.exports = parsed.data;
