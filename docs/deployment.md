# Deployment

## Providers
- GitHub for source control and CI
- Supabase for database/auth/storage
- Railway for app deployment

## Environments
- staging
- production

## Notes
- all required variables must exist in Railway
- CI should pass before production deployment

## Railway
- use `railway.toml` for build and start commands
- build command: `npm run build`
- start command: `node .next/standalone/server.js`
- production build uses `next build --webpack` to avoid stale client chunks after Railway redeploys
- production build removes stale `.next` artifacts before compiling, while preserving `.next/cache` for Nixpacks
- required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- for Next.js 16 in Railway/Nixpacks, keep Node 22 via `package.json` engines and set `NIXPACKS_NODE_VERSION=22`
- set `HOSTNAME=0.0.0.0` in Railway so the standalone server binds correctly inside the container
- copy `.next/static` and `public` into `.next/standalone` during build so CSS, JS and static assets resolve correctly in production
- after first successful deploy, generate a Railway public domain from the service settings or CLI
- verify the public URL responds with `200` before testing auth, checkout or downloads

## Next.js
- keep `output: "standalone"` in `next.config.mjs`
- keep CI aligned with local scripts and ESLint flat config
