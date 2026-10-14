import { rateLimit } from "express-rate-limit";
import type { Request, Response } from "express";

/**
 * Global API Rate Limiter
 * Protects all /api/v1 endpoints against DDoS, scrapers, and denial of service.
 * Excludes health and readiness check probes.
 */
export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === "test" ? 10000 : 300, // 300 requests per 15 min in prod
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req: Request) => {
    // Never throttle health and readiness monitoring probes
    const path = req.path || req.originalUrl || "";
    return path.endsWith("/health") || path.endsWith("/ready") || path === "/";
  },
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
});

/**
 * Strict Rate Limiter for Authentication & Password Operations
 * Defends against brute-force password cracking and credential stuffing.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 attempts per 15 min
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Try again later",
  },
});

/**
 * File Upload Rate Limiter
 * Mitigates storage and memory flooding on customer storefront photo uploads.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: process.env.NODE_ENV === "test" ? 1000 : 40, // 40 uploads per 15 min
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many file upload requests. Please wait a few minutes before uploading again.",
  },
});

/**
 * Report & Analytics Export Rate Limiter
 * Protects memory-heavy CSV, XLSX, and JSON generation queries.
 */
export const reportExportRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: process.env.NODE_ENV === "test" ? 1000 : 30, // 30 heavy export requests per minute
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many report export requests. Please wait a moment before exporting again.",
  },
});

/**
 * Write / Mutation Rate Limiter
 * Applied to high-frequency state-changing operations (sales creation, approvals, stock movements).
 */
export const writeMutationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: process.env.NODE_ENV === "test" ? 5000 : 120, // 120 mutations per minute
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "High transaction volume detected. Please slow down your requests.",
  },
});
