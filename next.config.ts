import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

// Next's env loader expands `$name` references inside .env values, which
// corrupts scrypt hashes (`scrypt$16384$8$1$…`). Load the raw value here and
// put it back; deployment environments set the variable directly and are
// unaffected because .env.local is not committed.
const local = loadEnv({ path: ['.env.local', '.env'], quiet: true }).parsed;
if (local?.TEACHER_PASSWORD_HASH) {
  process.env.TEACHER_PASSWORD_HASH = local.TEACHER_PASSWORD_HASH;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
