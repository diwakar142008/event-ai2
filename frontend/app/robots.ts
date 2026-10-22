import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/events",
          "/recommendations",
          "/settings",
          "/sign-in",
          "/sign-up",
          "/forgot-password",
          "/reset-password",
          "/api/",
        ],
      },
    ],
  };
}
