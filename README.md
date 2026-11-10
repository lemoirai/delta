# Delta Aesthetics

Booking site for Delta Aesthetics LLC, an electrolysis practice in Washington State.

## Stack

- [Astro 7](https://docs.astro.build) with [React islands](https://docs.astro.build/en/guides/framework-components/)
- [Tailwind CSS v4](https://tailwindcss.com)
- [PocketBase](https://pocketbase.io) — authentication, calendar, and data, hosted on a separate VM
- Deployed as a static site to GitHub Pages via GitHub Actions

## Layout

`src/pages/index.astro` is a single self-contained page. The booking widget, client portal, and
staff portal are React components loaded as islands. No layout system or routing is used.

## Development and testing

Testing uses a Docker compose stack (Node 24). The site hard-codes the production API endpoint, so
don't submit forms, sign in, or send OTP codes from the local site — that writes to production.
Visual and layout checks are fine. See [AGENTS.md](./AGENTS.md) for details.

```sh
docker compose up -d --wait      # Astro dev server -> http://localhost:4321
docker compose logs -f web
docker compose exec -T web npx astro build --outDir /app/.astro/dist-check   # build check
docker compose down
```

## Scripts

| Script           | Description                            |
| ---------------- | -------------------------------------- |
| `npm run dev`    | Start the Astro dev server             |
| `npm run build`  | Static build                           |
| `npm test`       | Run the `node --test` suite            |
| `npm run lint`   | ESLint (react, hooks, jsx-a11y, astro) |
| `npm run format` | Prettier                               |

## License

© Delta Aesthetics LLC.
