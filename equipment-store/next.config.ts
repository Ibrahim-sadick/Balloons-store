import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // The dev server answers 403 to its own /_next chunks whenever the request
  // carries a non-localhost Origin, so a phone opening http://10.98.199.6:3000
  // gets HTML it can never hydrate — the sign-in form then falls back to a plain
  // GET submit and the app looks broken on every device but this one. These are
  // the private ranges a shop Wi-Fi hands out. Development only: a production
  // build ignores this list.
  allowedDevOrigins: ["10.*.*.*", "172.*.*.*", "192.168.*.*"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
