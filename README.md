# Hauptsoch Drausst – Vienna skatespots

A community overview of Vienna's skatespots, seeded with the 186 spots and parks from the
[Vienna Spotmap](https://viennaskatespots.wordpress.com/).

- Browse spots as a list or on a map: search, filter (street spots / parks / skateable / bust), sort by rating or newest
- Each spot has a photo, its community rating (1–10), a **bust flag** (community votes: bust vs. skateable) and notes
- Logged-in users can add spots (with photo upload), rate, vote on bust status and leave notes

## Stack

- React + Vite, Leaflet (CARTO dark tiles / OpenStreetMap)
- Supabase: Postgres + Row Level Security, Auth (email + password), Storage (`spot-photos` bucket)
- Netlify hosting (`netlify.toml`)

## Database

| table        | what                                                    |
|--------------|---------------------------------------------------------|
| `spots`      | name, description, kind (`spot`/`park`), lat/lng, photo |
| `ratings`    | one 1–10 score per user per spot                        |
| `bust_votes` | one bust / skateable vote per user per spot             |
| `notes`      | free-text notes                                         |
| `profiles`   | username, created on sign-up                            |

`spot_overview` is a view with average rating, vote counts and note count per spot.
A spot shows as **BUST** when more people voted bust than skateable.

Everyone can read; only logged-in users can write, and only their own rows.

## Develop

```bash
npm install
npm run dev
```

The Supabase URL and publishable key are in `src/supabase.js` (safe to ship to the browser).
Override with `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` if needed.
