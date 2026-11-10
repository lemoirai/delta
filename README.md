# Delta Aesthetics website

Booking site for an electrolysis practice. Built with Astro 7, React, Tailwind CSS 4 and PocketBase.

## Run locally

```sh
docker compose up -d --wait
docker compose exec -T -e PB_URL=http://pocketbase:8090 web npm run stack:setup
```

- Site: http://127.0.0.1:4321
- PocketBase admin: http://127.0.0.1:8090/\_/
- Mailpit (captured email): http://127.0.0.1:8025

Reset to a clean database with `docker compose down -v`, then run both commands again.

Don't run `npm run dev` on the host; everything runs in the containers.

## Checks

```sh
docker compose exec -T web npm run lint
docker compose exec -T web npm test
docker compose exec -T web npm run format:check
```

## Contributing

Read [AGENTS.md](./AGENTS.md) first.
