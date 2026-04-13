import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase-client.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Bypass authentication for the YouTube OAuth callback route
  if (req.path === "/auth/callback") {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("[Auth] Supabase getUser failed for token:", token.substring(0, 10) + "...", error?.message || "No user found");
      return res.status(401).json({ 
        error: "Invalid or expired session. Please log in again.",
        details: error?.message 
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Authentication failed." });
  }
};
