import { Router } from "express";
import { ok } from "../../lib/http.js";
import { AuthenticatedRequest } from "../../middleware/auth.js";

export const reportingRouter = Router();

/**
 * GET /api/reporting/generate-ppt
 * Placeholder for the PPT generator. 
 * Prevents 404 in the frontend while the full PPT engine is being ported.
 */
reportingRouter.get("/generate-ppt", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { startDate, endDate } = req.query;

  // For now, return a informative message
  // In a full implementation, this would use a library like 'pptxgenjs' or an external service.
  res.json(ok({
    message: "PPT Generation is being initialized for your account.",
    startDate,
    endDate,
    status: "processing",
    note: "This is a placeholder to ensure frontend parity during migration."
  }));
});
