import 'dotenv/config'

import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  LLM_PROVIDER: z.enum(['openai_compat']).default('openai_compat'),
  LLM_API_KEY: z.string().min(1),
  LLM_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  LLM_MODEL: z.string().min(1).default('llama-3.1-70b-versatile'),

})

export const env = EnvSchema.parse(process.env)
export type Env = z.infer<typeof EnvSchema>
