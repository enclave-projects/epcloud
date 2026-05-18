# EP Cloud

Secure media hosting platform — upload images and videos, manage them in folders, and share via encrypted, signed links with expiry, password protection, and embed controls.

**Live:** [epcloud.enclaveprojects.dev](https://epcloud.enclaveprojects.dev)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 (SPA) |
| Build | Vite 7 + TypeScript 5.9 |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v4 |
| UI | shadcn/ui (Radix UI + Remix Icons) |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Auth | `@supabase/ssr` with PKCE flow |
| Uploads | TUS resumable protocol (`tus-js-client`) |
| Forms | React Hook Form + Zod |

## Getting Started

```bash
# Install dependencies
npm install

# Copy env template and fill in your Supabase credentials
cp .env.example .env

# Start dev server
npm run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # TypeScript check + Vite production build
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run format     # Prettier
npm run preview    # Preview production build locally
```

## Project Structure

```
src/
├── main.tsx              # Entry: ThemeProvider → BrowserRouter → App
├── App.tsx               # Route definitions
├── components/
│   ├── ui/               # shadcn/ui primitives
│   ├── dashboard/        # Feature components (file table, upload tray, share dialog)
│   ├── layout/           # Shell, Sidebar, Topbar, StorageMeter
│   ├── route-guards.tsx  # RequireAuth / RedirectIfAuthed
│   └── auth-upload-gate.tsx
├── pages/                # One file per route
├── hooks/                # useAuth, useUploads, useMedia, useStorageUsage
├── lib/                  # Core logic (auth, media, storage, uploader, shares)
└── types/                # Auto-generated Supabase types
```

## Features

- **Resumable uploads** — TUS protocol with 6 MB chunks, auto-retry, 3 concurrent slots
- **Folder organization** — nested folders with drag-and-drop
- **Image & video thumbnails** — images via Edge Function, videos extracted in-browser
- **Encrypted share links** — token hashed (SHA-256), supports expiry, max views, password, allowed origins
- **Embeddable viewer** — `/e/:token` route for iframe embedding on third-party sites
- **Trash & restore** — soft delete with permanent purge option
- **Rate limiting** — per-user sliding window on uploads, login, signup, and share creation
- **Brute-force protection** — automatic lockout after repeated failed sign-ins
- **Auth audit log** — hashed emails, no PII stored

## Edge Functions

| Function | Purpose |
|---|---|
| `generate-thumbnail` | Server-side image thumbnail generation |
| `send-email` | Auth hook — branded transactional emails via Resend |

See [`supabase/functions/send-email/README.md`](supabase/functions/send-email/README.md) for deployment details.

## Adding UI Components

```bash
npx shadcn@latest add button
```

Components are placed in `src/components/ui/`.

## License

Private — all rights reserved.
