/**
 * oauth.js — Google OAuth 2.0 lifecycle for YouTube Analytics
 *
 * Scopes requested:
 *   - youtube.readonly              (channel info, video data)
 *   - yt-analytics.readonly         (analytics data)
 *   - yt-analytics-monetary.readonly (revenue / monetization)
 */

require("dotenv").config();
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
];

const ENV_PATH = path.join(__dirname, "..", ".env");

// ─── Build OAuth2 client ─────────────────────────────────────
function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:9088/auth/callback";

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ─── Get consent URL ─────────────────────────────────────────
function getConsentUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // force refresh_token to be issued
  });
}

// ─── Exchange code → tokens, persist refresh_token ──────────
async function exchangeCode(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token received. Make sure you revoke previous access at " +
        "https://myaccount.google.com/permissions and try again."
    );
  }

  // Persist to .env
  persistRefreshToken(tokens.refresh_token);

  client.setCredentials(tokens);
  return client;
}

// ─── Write / update GOOGLE_REFRESH_TOKEN in .env ────────────
function persistRefreshToken(refreshToken) {
  let content = "";
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, "utf-8");
  }

  const key = "GOOGLE_REFRESH_TOKEN";
  const line = `${key}=${refreshToken}`;

  if (new RegExp(`^${key}=`, "m").test(content)) {
    content = content.replace(new RegExp(`^${key}=.*$`, "m"), line);
  } else {
    content = content.trimEnd() + "\n" + line + "\n";
  }

  fs.writeFileSync(ENV_PATH, content, "utf-8");
  process.env.GOOGLE_REFRESH_TOKEN = refreshToken;
  console.log("[OAuth] ✅ Refresh token saved to .env");
}

// ─── Get a ready-to-use authenticated client ─────────────────
function getAuthClient() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) return null;

  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

// ─── Check if already authorized ─────────────────────────────
function isAuthorized() {
  return !!process.env.GOOGLE_REFRESH_TOKEN;
}

module.exports = { getConsentUrl, exchangeCode, getAuthClient, isAuthorized };
