# Agent instructions: Delta Aesthetics site

Booking site for a small electrolysis practice in Washington State. Astro 7 + React islands + Tailwind v4, deployed as a static site to GitHub Pages. Backend is PocketBase (separate VM). **This repo is public**: don't put secrets, internal paths or open security issues in tracked files.

## Read first

The planning docs are in `ops/`. That folder is gitignored here and has its own private git repo. Read them before changing code:

1. `ops/REFACTOR.md`, **"Status: where we left off"** at the top: current progress and the next step. Update it before you finish a session.
2. `ops/REFACTOR.md` §2–§6: compliance requirements (Washington My Health My Data Act and others), known defects, the Docker test design and the execution order.
3. `ops/HANDOFF.md`: product design (pricing, credit, data model, roadmap).
4. `ops/LEGAL_NOTES.md`: running attorney and accountant questions. When code depends on a legal assumption, note it there (Open table) rather than deciding it silently.

Commit changes to `ops/` in its own repo: `git -C ops add -A && git -C ops commit -m "..."`.

If `ops/` is missing (fresh clone), ask the owner for the private ops repo. Don't recreate it from memory.

## Development and testing: Docker only

Don't run `npm run dev`, `astro dev` or `npm install` on the host to test. Use the compose stack:

```sh
docker compose up -d --wait      # Astro dev server -> http://localhost:4321
docker compose logs -f web
docker compose exec -T web npx astro build --outDir /app/.astro/dist-check   # build check
docker compose down              # add -v to reset volumes
```

- The container uses Node 24 / npm 11 to match the host, and runs `npm ci`. **If `package-lock.json` shows up as modified after a container run, stop and investigate.** Don't commit lockfile churn.
- For browser testing (Playwright MCP or Claude in Chrome), use `http://localhost:4321` only.
- `compose.ai.yaml` is the owner's optional local LLM (`--profile ai`). It isn't part of the site; leave it alone.

### Current limitation (until REFACTOR step 2 lands)

The stack has no local PocketBase yet. The components still hard-code `https://api.delta-aesthetics.com`. **Don't submit any form, sign in or send OTP codes from the local site**, because that writes to production. Visual and layout checks are fine. Step 2 adds PocketBase, Mailpit (catches OTP email) and seed data. After that, all functional testing runs against the local stack.

## Rules

- Never call or modify production (`api.delta-aesthetics.com`, the VM, Cloudflare, Brevo) unless the owner asks for that specific action.
- Production data (database copies, backups) may exist on the owner's machine, but only outside this repo folder. Never put it in git (this repo or `ops/`), and never load it into a dev container: compose mounts the whole repo. Dev and test data is synthetic (`*@example.test`).
- There are three PocketBase flavors: **cloud** (public booking, short-lived data), **studio** (staff, full records, the source of truth) and **dev** (this compose stack, either flavor, synthetic data). Details are in `ops/REFACTOR.md` §9.
- Treat all client data as consumer health data: collect the minimum, use preferred names, keep email and calendar text generic, and don't log PII.
- No superuser (`_superusers` / `pb.admins`) auth in site code. Staff are `users` with a `role`.
- Pushes to `main` deploy to production via GitHub Actions. Work on branches and don't push or merge unless asked.
- Comments explain _why_, not _what_. No narration comments ("1. Do X", "Optional: …") and no claims about versions or compatibility you haven't verified.

## Astro docs

Full documentation: https://docs.astro.build. Relevant guides: [routing](https://docs.astro.build/en/guides/routing/), [components](https://docs.astro.build/en/basics/astro-components/), [framework components](https://docs.astro.build/en/guides/framework-components/), [styling](https://docs.astro.build/en/guides/styling/).
