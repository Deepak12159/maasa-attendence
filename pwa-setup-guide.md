# Making Any Website Installable — PWA Setup Guide

This is the exact configuration used in TruthVerse, generalized so you can
drop it into **any** existing website and make it installable (Add to
Home Screen / desktop install prompt) with offline support.

## The 3 hard requirements

A site becomes installable only when **all three** are true:

1. Served over **HTTPS** (or `localhost` for testing) — no exceptions.
2. A valid **`manifest.json`** linked from every page.
3. A registered **service worker** with at least a `fetch` event handler.

Miss any one of these and the browser will not offer an install prompt,
no matter how correct the other two are.

---

## 1. File structure to add

Drop these into the **root** of your site (or wherever `index.html`
lives — paths below assume same-folder):

```
your-site/
├── index.html          ← add a few tags to <head> (see below)
├── manifest.json        ← new file
├── sw.js                 ← new file
└── icons/
    ├── icon-192.png       ← new
    ├── icon-512.png       ← new
    ├── icon-512-maskable.png  ← new
    ├── apple-touch-icon.png   ← new (180×180, no transparency)
    └── favicon.png            ← new
```

---

## 2. `manifest.json`

Copy this and fill in the placeholders:

```json
{
  "name": "Your App Full Name",
  "short_name": "ShortName",
  "description": "One sentence describing what this does.",
  "id": "/",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "orientation": "portrait-primary",
  "background_color": "#0d0906",
  "theme_color": "#0d0906",
  "lang": "en",
  "dir": "ltr",
  "categories": ["your", "categories", "here"],
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**Notes:**
- `background_color` / `theme_color` should match your site's actual
  background so the splash screen doesn't flash white.
- Keep the **`any`** and **`maskable`** icons as *separate* entries. Don't
  combine `"purpose": "any maskable"` on one icon — Android will
  crop a non-padded icon badly if you do.
- `start_url` and `scope` should be relative (`./`), not absolute, unless
  your PWA lives at a subpath and you know you need otherwise.

### Icon sizing rules
| File | Size | Purpose | Notes |
|---|---|---|---|
| `icon-192.png` | 192×192 | `any` | content fills the frame |
| `icon-512.png` | 512×512 | `any` | content fills the frame |
| `icon-512-maskable.png` | 512×512 | `maskable` | **important content inside the center 80%** — background fills edge-to-edge, no transparency |
| `apple-touch-icon.png` | 180×180 | — | opaque background, no transparency (iOS ignores alpha) |
| `favicon.png` | 32×32 or 64×64 | — | browser tab icon |

If you don't have a maskable variant yet, duplicating `icon-512.png` will
still pass basic install checks — but on Android adaptive icons it may get
cropped oddly, so a real padded version is worth doing before launch.

---

## 3. `<head>` tags to add

Add these to **every page** you want installable (usually just `index.html`
for a single-page app):

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<!-- PWA -->
<link rel="manifest" href="./manifest.json">
<meta name="theme-color" content="#0d0906">
<meta name="background-color" content="#0d0906">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ShortName">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<link rel="icon" type="image/png" href="./icons/favicon.png">
```

Match `theme-color` / `background-color` to the values in your manifest.

---

## 4. `sw.js` — the service worker

This uses a deliberate, non-lazy strategy: **network-first for HTML**
(so users always get your latest deploy, with an offline fallback), and
**cache-first for static assets** (icons, manifest — they rarely change).

```javascript
const CACHE_NAME = "yourapp-v1"; // bump this string on every deploy that changes cached files
const APP_SHELL = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png"
  // add your CSS/JS bundle files here if they're separate from index.html
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests — let everything else
  // (APIs, analytics, cross-origin fonts) go straight to the network.
  if (req.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  const isNavigation = req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
```

**Why network-first for HTML?** Caching your app-shell HTML with
cache-first is the single most common PWA bug — users get stuck on a
stale version forever because the service worker keeps serving the old
cached HTML even after you've deployed fixes. Network-first with a
cache fallback gives you the best of both: fresh content when online,
still-functional when offline.

---

## 5. Register the service worker

Add this near the end of your main script (defensive — fails silently
if unsupported, e.g. `file://` paths or very old browsers):

```javascript
if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // offline support unavailable, site still works fully online
    });
  });
}
```

---

## 6. Update checklist for a new deploy

Whenever you change any file listed in `APP_SHELL`:

1. Bump `CACHE_NAME` in `sw.js` (e.g. `v1` → `v2`).
2. That's it — the `activate` handler above automatically deletes the old
   cache and `skipWaiting()`/`clients.claim()` make the new version take
   over without requiring users to fully close the app first.

---

## 7. How to verify it actually works

1. Serve the site over HTTPS (or `http://localhost` for local testing —
   `file://` will **not** work for the service worker).
2. Open Chrome DevTools → **Application** tab:
   - **Manifest** section should show your icons/name with no errors.
   - **Service Workers** section should show it as "activated and running".
3. Run a **Lighthouse** audit (DevTools → Lighthouse → check "Progressive
   Web App" category) — it will flag anything missing.
4. On desktop Chrome/Edge, look for an install icon (⊕) in the address
   bar. On Android Chrome, look for "Add to Home Screen" in the menu. On
   iOS Safari, it's Share → "Add to Home Screen" (iOS doesn't show an
   automatic install prompt like Android/desktop do).
5. Turn on Airplane Mode and reload — the cached shell should still load.

---

## Common pitfalls

- **Relative vs. absolute paths**: if your site lives at
  `example.com/app/` rather than the domain root, every path above
  (`./manifest.json`, `./sw.js`, icon `src` values, `start_url`, `scope`)
  needs to resolve correctly from that subpath. Using `./` relative
  paths throughout (as shown above) handles this automatically.
- **Forgetting HTTPS in production**: works fine on `localhost` without
  it, fails silently (no install prompt, service worker won't register)
  the moment it's live on plain HTTP.
- **Service worker scope**: a service worker registered at `/sw.js` can
  control the whole origin; one registered at `/app/sw.js` can only
  control paths under `/app/`. Keep `sw.js` at the same level as
  `index.html`.
- **Stale service worker during development**: browsers cache the
  service worker file itself aggressively. During development, check
  "Update on reload" in DevTools → Application → Service Workers.
