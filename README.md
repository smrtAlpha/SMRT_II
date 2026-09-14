# SMRT

**SMRT** is a browser-based, offline-first AI study companion. It works as a Progressive Web App (PWA) — install it once on Wi-Fi, and it keeps working as a fully capable AI assistant even with no internet connection at all.

Built for students, researchers, and remote workers dealing with expensive mobile data, patchy networks, or unreliable power. SMRT caches every conversation locally as you use it online, lets you pre-load entire textbooks/PDFs into a local knowledge base while on Wi-Fi, and can queue up research tasks to run automatically the next time you're connected.

## Core features

- **Hybrid chat** — online answers are cached automatically; offline questions fall back to local search, then to an on-device AI model.
- **PDF intake pipeline** — feed it a textbook on Wi-Fi, get a condensed "knowledge pack" you can query fully offline.
- **Fetch-It-Later queue** — leave a research request while offline; it runs automatically the moment you're back online.

## Tech stack

React + TypeScript + Vite, IndexedDB (Dexie) for local storage, WebLLM for on-device inference, Google Gemini API for cloud chat/research, Supabase for auth and backend functions.

## Status

🚧 Early development — not yet usable.