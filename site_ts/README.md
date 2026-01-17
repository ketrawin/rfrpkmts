TypeScript POC for Pokemmo (minimal)

Setup

1. From project root, install dependencies:

```bash
cd site_ts
npm install
```

2. Start dev server:

```bash
npm run dev
```

Notes

- This is a minimal proof-of-concept scaffold using Vite + TypeScript.
- Copy assets from `site/resources` or adapt paths in `index.html`.
- To add socket.io support: `npm install socket.io-client` (already listed in dependencies).
- We'll port `RegisterScreen` here as a starting point; further UI/engine pieces need to be implemented.
