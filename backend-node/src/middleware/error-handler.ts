import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { fail } from "../lib/http.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json(fail("Validation failed", "VALIDATION_ERROR"));
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  return res.status(500).json(fail(message, "INTERNAL_ERROR"));
}
