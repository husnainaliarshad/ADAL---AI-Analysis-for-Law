# ADAL Frontend

React + Vite frontend for ADAL.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment template:

```bash
cp env.example .env
```

3. Start dev server:

```bash
npm run dev
```

## Environment Variables

- `VITE_API_URL` (canonical): backend API URL including `/api`.
- `VITE_API_BASE_URL` (deprecated fallback): used only if `VITE_API_URL` is missing.
- `VITE_ENABLE_DEV_ROUTES`: must be exactly `true` to expose `/__dev__/...` preview routes.
- `VITE_ENABLE_NOTIFICATIONS_API`: enables calls to `/notifications`; fallback mode is used otherwise.
- `VITE_DEBUG`: enables extra debug logs.

## Testing

```bash
npm run test:run
```

## Encoding Check

Verify no UTF-16 files remain in `src`:

```bash
find src -type f -print0 | xargs -0 file -bi | grep -i "utf-16"
```
