import type { Request, Response, NextFunction } from "express";

/**
 * Lightweight, production-safe network performance instrumentation middleware.
 * Tracks:
 * - HTTP method and path
 * - Response status code
 * - Total request duration in milliseconds (using high-resolution process.hrtime)
 * - Raw response payload size in bytes
 * - Slow requests (> 300ms or > 100 KB) flagged via structured stderr/warn
 *
 * Security: Avoids logging query strings or headers containing tokens/credentials.
 */
export function networkPerformanceLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startHrTime = process.hrtime.bigint();
  let totalBytes = 0;

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  // Track raw response bytes streamed/chunked
  res.write = ((chunk: any, ...args: any[]): boolean => {
    if (chunk) {
      totalBytes += Buffer.isBuffer(chunk)
        ? chunk.length
        : typeof chunk === "string"
        ? Buffer.byteLength(chunk)
        : 0;
    }
    return (originalWrite as any)(chunk, ...args);
  }) as any;

  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = ((statusCode: number, ...args: any[]): Response => {
    const endHrTime = process.hrtime.bigint();
    const durationMs = Number(endHrTime - startHrTime) / 1_000_000;
    res.setHeader("Server-Timing", `total;dur=${durationMs.toFixed(1)}`);
    return (originalWriteHead as any)(statusCode, ...args);
  }) as any;

  res.end = ((chunk: any, ...args: any[]): any => {
    if (chunk) {
      totalBytes += Buffer.isBuffer(chunk)
        ? chunk.length
        : typeof chunk === "string"
        ? Buffer.byteLength(chunk)
        : 0;
    }

    const endHrTime = process.hrtime.bigint();
    const durationMs = Number(endHrTime - startHrTime) / 1_000_000;

    // Flag slow responses (> 300ms) or heavy payloads (> 100 KB)
    if (durationMs > 300 || totalBytes > 102_400) {
      const sanitizedPath = (req.baseUrl || "") + (req.path || "");
      const payloadKb = (totalBytes / 1024).toFixed(1);
      const timeMs = durationMs.toFixed(1);
      const memoryUsageMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

      console.warn(
        `[PERF ALERT] ${req.method} ${sanitizedPath} - Status: ${res.statusCode} | Duration: ${timeMs}ms | Size: ${payloadKb}KB | Heap: ${memoryUsageMb}MB`
      );
    }

    return (originalEnd as any)(chunk, ...args);
  }) as any;

  next();
}
