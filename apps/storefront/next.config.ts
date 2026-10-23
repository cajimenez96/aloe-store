import type { NextConfig } from "next";

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
    // localhost. Solo se permite cuando el host de imágenes es local
    // (sp-01-medusa.md, punto 16): con un dominio real no se activa.
    dangerouslyAllowLocalIP: isLocalImagesHost,
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
