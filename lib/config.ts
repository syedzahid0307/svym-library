const requiredServerVars = {
  DATABASE_URL: process.env.DATABASE_URL,
  IMAGEKIT_PRIVATE_KEY: process.env.IMAGEKIT_PRIVATE_KEY,
  UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
  UPSTASH_REDIS_TOKEN: process.env.UPSTASH_REDIS_TOKEN,
  QSTASH_URL: process.env.QSTASH_URL,
  QSTASH_TOKEN: process.env.QSTASH_TOKEN,
  RESEND_TOKEN: process.env.RESEND_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY,
  NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
  NEXT_PUBLIC_API_ENDPOINT: process.env.NEXT_PUBLIC_API_ENDPOINT,
  NEXT_PUBLIC_PROD_API_ENDPOINT: process.env.NEXT_PUBLIC_PROD_API_ENDPOINT,
} as const;

// Every env var used to previously go through a `!` non-null assertion,
// which is a TypeScript-only promise ("trust me, this exists") with zero
// runtime check behind it. In practice that meant a missing var failed
// deep inside whatever code path first touched it - e.g. the 3am cron
// job discovering CRON_SECRET is undefined, or ImageKit uploads failing
// with a cryptic SDK error instead of "you forgot to set a key."
//
// This check runs once, at module load, and only on the server -
// `config.ts` is also imported by a few client components (for the two
// NEXT_PUBLIC_* ImageKit values), and running a hard validation throw
// inside a browser bundle would crash the app for every visitor the
// moment any var it doesn't have access to is checked. `typeof window
// === "undefined"` is true only in a real Node/edge server context, so
// the client bundle skips this entirely.
if (typeof window === "undefined") {
  const missing = Object.entries(requiredServerVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Check .env.example for the full list and what each one is for.`,
    );
  }
}

const config = {
  env: {
    apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT!,
    prodApiEndpoint: process.env.NEXT_PUBLIC_PROD_API_ENDPOINT!,
    imagekit: {
      publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!,
      urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT!,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
    },
    databaseUrl: process.env.DATABASE_URL!,
    upstash: {
      redisUrl: process.env.UPSTASH_REDIS_URL!,
      redisToken: process.env.UPSTASH_REDIS_TOKEN!,
      qstashUrl: process.env.QSTASH_URL!,
      qstashToken: process.env.QSTASH_TOKEN!,
    },
    resendToken: process.env.RESEND_TOKEN!,
    cronSecret: process.env.CRON_SECRET!,
  },
};

export default config;
