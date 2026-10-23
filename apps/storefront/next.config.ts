import type { NextConfig } from "next";

// Host de las imágenes de producto, por ejemplo "localhost:9000" (arquitectura.md, 17.2).
const imagesHost = process.env.NEXT_PUBLIC_IMAGES_HOST;
const isDevelopment = process.env.NODE_ENV !== "production";

function imagePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  if (!imagesHost) {
    return [];
  }
  const [hostname, port = ""] = imagesHost.split(":");
  return [
    {
      protocol: isDevelopment ? "http" : "https",
      hostname,
      port,
      pathname: "/static/**",
    },
  ];
}

// Encabezados de seguridad básicos (seguridad.md, SEC-60). La política de
// seguridad de contenido (CSP) completa se termina en HU-44 y HSTS al desplegar.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    remotePatterns: imagePatterns(),
    // Next.js rechaza optimizar imágenes que resuelven a una IP privada, como
    // localhost. Solo se permite en desarrollo (sp-01-medusa.md, punto 16).
    dangerouslyAllowLocalIP: isDevelopment,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
