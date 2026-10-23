import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Route-specific conditional HTTP caching middleware.
 * Uses ETag (derived from md5 content digest) and Cache-Control headers.
 * Returns HTTP 304 Not Modified when client provides matching `If-None-Match`.
 *
 * Rules:
 * - Only applies to GET and HEAD requests.
 * - Does not override responses that explicitly set no-store or non-200 statuses.
 * - Adds standard Cache-Control directives: private (or public), max-age, stale-while-revalidate.
 */
export function conditionalHttpCache(options: {
  maxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
  isPublic?: boolean;
} = {}) {
  const {
    maxAgeSeconds = 60,
    staleWhileRevalidateSeconds = 300,
    isPublic = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Cache-Control", "no-store");
      return next();
    }

    const visibility = isPublic ? "public" : "private";
    res.setHeader(
      "Cache-Control",
      `${visibility}, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
    );

    const originalJson = res.json.bind(res);

    res.json = ((data: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const bodyStr = JSON.stringify(data);
        const hash = crypto.createHash("md5").update(bodyStr).digest("hex");
        const etag = `W/"${hash}"`;

        res.setHeader("ETag", etag);

        const clientEtag = req.headers["if-none-match"];
        if (clientEtag && (clientEtag === etag || clientEtag === `"${hash}"` || clientEtag === hash)) {
          return res.status(304).end();
        }

        return originalJson(data);
      }
      return originalJson(data);
    }) as any;

    next();
  };
}
