import PocketBase from 'pocketbase';

const PRODUCTION_URL = 'https://api.delta-aesthetics.com';
const configured = import.meta.env.PUBLIC_PB_URL;

function resolveBaseUrl() {
  if (import.meta.env.DEV) {
    // Dev must hit the local PocketBase (docker compose sets PUBLIC_PB_URL="" and
    // proxies /api). Refuse to start against production by accident.
    if (configured === undefined || configured.includes('delta-aesthetics.com')) {
      throw new Error(
        'Dev server must use the local PocketBase. Start it with `docker compose up` (see AGENTS.md).',
      );
    }
    if (configured) return configured;
    return typeof window === 'undefined' ? 'http://localhost:4321' : window.location.origin;
  }
  return configured || PRODUCTION_URL;
}

/** The one PocketBase client for the whole site. */
export const pb = new PocketBase(resolveBaseUrl());
