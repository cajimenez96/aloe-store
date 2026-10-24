import type { NextConfig } from "next";
import { buildCsp } from "./src/lib/csp";

// Host de las imágenes de producto, por ejemplo "localhost:9000" (arquitectura.md, 17.2).
const imagesHost = process.env.NEXT_PUBLIC_IMAGES_HOST;
// Solo un host local (desarrollo o el build de producción probado en la máquina)
// necesita http y saltear la protección contra IP privadas. Un host real usa https.
const isLocalImagesHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(imagesHost ?? "");

function imagePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  if (!imagesHost) {
    return [];
  }
  const [hostname, port = ""] = imagesHost.split(":");
  return [
    {
      protocol: isLocalImagesHost ? "http" : "https",
      hostname,
      port,
      pathname: "/static/**",
    },
  ];
}

// Encabezados de seguridad (seguridad.md, SEC-60), con la política de contenido
// de HU-44. HSTS se agrega al desplegar con HTTPS.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildCsp({
      backendUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "",
      imagesHost: imagesHost ?? "",
      isDev: process.env.NODE_ENV === "development",
    }),
  },
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
    // localhost. Solo se permite cuando el host de imágenes es local
    // (sp-01-medusa.md, punto 16): con un dominio real no se activa.
    dangerouslyAllowLocalIP: isLocalImagesHost,
  },
  // El comprobante pesa hasta 5 MB y viaja por una Server Action (el valor por defecto es 1 MB).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
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
