# Agent instructions: Delta Aesthetics site

Booking site for a small electrolysis practice in Washington State. Astro 7 + React islands + Tailwind v4, deployed as a static site to GitHub Pages. Backend is PocketBase (separate VM). **This repo is public**: don't put secrets, internal paths or open security issues in tracked files.

## Read first

The planning docs are in `ops/`. That folder is gitignored here and has its own private git repo. Read them before changing code:

1. `ops/STATUS.md` and `ops/TODO.md`: current state, what's next, and what's waiting on the owner. Update both before you finish a session.
2. `ops/README.md`: map of everything else. Read the parts you need: `ops/design/` (architecture, Washington compliance), `ops/decisions.md` (owner decisions), `ops/agents/cloud-claude.md` (how sessions work), `ops/dev/helper-scripts.md`.
3. `ops/HANDOFF.md`: product design (pricing, credit, data model, roadmap).
4. `ops/questions/legal.md`: running attorney and accountant questions. When code depends on a legal assumption, note it there (Open table) rather than deciding it silently.

Code comments cite section numbers: `architecture §9.x` is `ops/design/architecture.md`, `HANDOFF §x` is `ops/HANDOFF.md`, "roadmap step N" is the roadmap in `ops/TODO.md`.

Commit changes to `ops/` in its own repo: `git -C ops add -A && git -C ops commit -m "..."`.

If `ops/` is missing (fresh clone), ask the owner for the private ops repo. Don't recreate it from memory.

## Development and testing: Docker only

**Never run `node`, `npm` or `npx` on the host**, not even a small dependency-free script: the host is the owner's personal PC, and npm's nested dependencies are a supply-chain risk (ADR-13). Edit files with your editing tools, git and plain shell; run anything Node-based (scripts, tests, builds, syntax checks) inside the compose stack:

```sh
docker compose up -d --wait      # Astro dev server -> http://127.0.0.1:4321
docker compose exec -T -e PB_URL=http://pocketbase:8090 web npm run stack:setup   # after a fresh volume
docker compose logs -f web
docker compose exec -T web npx astro build --outDir /app/.astro/dist-check   # build check
docker compose down              # add -v to reset volumes
```

- The container uses Node 24 / npm 11 to match the host, and runs `npm ci`. **If `package-lock.json` shows up as modified after a container run, stop and investigate.** Don't commit lockfile churn.
- For browser testing (Playwright MCP or Claude in Chrome), use `http://127.0.0.1:4321` only. `localhost` can resolve to a different server on the host's IPv6 loopback.
- In Git Bash, set `MSYS_NO_PATHCONV=1` before `docker compose exec` commands that pass container paths, or Git Bash rewrites `/app/...` into a Windows path.
- Line endings are LF everywhere (`.gitattributes`, `.editorconfig`). If `git status` shows files as modified with no real diff, run `git diff --ignore-cr-at-eol --stat`: empty output means line endings only; re-check out the file instead of investigating further.
- `compose.ai.yaml` is the owner's optional local LLM (`--profile ai`). It isn't part of the site; leave it alone.

### Local PocketBase

The stack runs its own PocketBase and Mailpit; the site talks to them through the dev server's `/api` proxy, and `src/lib/pb.js` refuses to start against production. Run `npm run stack:setup` (command above) once after `docker compose down -v` so email codes reach Mailpit (http://127.0.0.1:8025). There's no booking schema locally yet, so the booking form can't submit until the new schema lands.

## Rules

- Never call or modify production (`api.delta-aesthetics.com`, the VM, Cloudflare, Brevo) unless the owner asks for that specific action.
- Production data (database copies, backups) may exist on the owner's machine, but only outside this repo folder. Never put it in git (this repo or `ops/`), and never load it into a dev container: compose mounts the whole repo. Dev and test data is synthetic (`*@example.test`) by default; real accounts the owner adds by hand to test against existing users are allowed, and the dev scripts print a note when they see one.
- There are three PocketBase flavors: **cloud** (public booking, short-lived data), **studio** (staff, full records, the source of truth) and **dev** (this compose stack, either flavor, synthetic data). Details are in `ops/design/architecture.md` §9.0.
- Treat all client data as consumer health data: collect the minimum, use preferred names, keep email and calendar text generic, and don't log PII.
- No superuser (`_superusers` / `pb.admins`) auth in site code. Staff are `users` with a `role`.
- Pushes to `main` deploy to production via GitHub Actions. Work on branches and don't push or merge unless asked.
- Comments explain _why_, not _what_. No narration comments ("1. Do X", "Optional: …") and no claims about versions or compatibility you haven't verified.

## Astro docs

Full documentation: https://docs.astro.build. Relevant guides: [routing](https://docs.astro.build/en/guides/routing/), [components](https://docs.astro.build/en/basics/astro-components/), [framework components](https://docs.astro.build/en/guides/framework-components/), [styling](https://docs.astro.build/en/guides/styling/).
