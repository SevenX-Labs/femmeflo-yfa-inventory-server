import { rateLimit } from "express-rate-limit";

const DISABLE_RATE_LIMIT = () => true;

/**
 * Global API Rate Limiter (disabled per user requirement: no request throttling)
 */
export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: DISABLE_RATE_LIMIT,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
});

/**
 * Auth Limiter (disabled for operational continuity; route-level auth limiter remains on login endpoints)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: DISABLE_RATE_LIMIT,
  message: {
    success: false,
    message: "Too many authentication attempts. Try again later",
  },
});

/**
 * File Upload Rate Limiter (disabled per user requirement)
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: DISABLE_RATE_LIMIT,
  message: {
    success: false,
    message: "Too many file upload requests. Please wait a few minutes before uploading again.",
  },
});

/**
 * Report & Analytics Export Rate Limiter (disabled per user requirement)
 */
export const reportExportRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: DISABLE_RATE_LIMIT,
  message: {
    success: false,
    message: "Too many report export requests. Please wait a moment before exporting again.",
  },
});

/**
 * Write / Mutation Rate Limiter (disabled per user requirement)
 */
export const writeMutationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: DISABLE_RATE_LIMIT,
  message: {
    success: false,
    message: "High transaction volume detected. Please slow down your requests.",
  },
});
