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

const nextConfig: NextConfig = {
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
