/**
 * GenSpark AI Slides Automation — SHARE LINK (free tier)
 *
 * Flow:
 *  1. Navigate to https://www.genspark.ai/ai_slides?tab=explore
 *  2. Find the prompt input, enter analytics data
 *  3. Click Generate
 *  4. Wait dynamically for generation to complete
 *  5. Click Share → set "Anyone with link" → copy the link
 *  6. Return the link (stored in app, no PPTX download needed)
 */

const { chromium } = require("playwright");
const path = require("path");
const fs   = require("fs");

const params = JSON.parse(process.argv[2] || "{}");
const { prompt, jobId } = params;

const SESSION_DIR = path.join(__dirname, "../.genspark-session");
const OUTPUT_DIR  = path.join(__dirname, "../outputs");
const TARGET_URL  = "https://www.genspark.ai/ai_slides?tab=explore";

function log(msg) { process.stdout.write(`[GenSpark] ${msg}\n`); }

async function pollUntil(page, fn, { timeout = 240_000, interval = 4000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const r = await fn(page).catch(() => false);
    if (r) return r;
    log(`  ⏳ Waiting... (${Math.round((deadline - Date.now()) / 1000)}s left)`);
    await page.waitForTimeout(interval);
  }
  throw new Error(`Timed out after ${timeout / 1000}s`);
}

/* ── Main ────────────────────────────────────────────────── */
(async () => {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR,  { recursive: true });

  log("Launching browser in headless mode...");
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-sandbox",
      "--start-maximized"
    ],
    viewport: null, // Resolves the weird gap issue
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    acceptDownloads: true,
    downloadsPath: OUTPUT_DIR,
    permissions: ["clipboard-read", "clipboard-write"],  
  });

  const page = browser.pages()[0] || (await browser.newPage());
  await page.bringToFront();

  // ── Step 1: Navigate to AI Slides ─────────────────────────
  log(`Navigating to: ${TARGET_URL}`);
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.bringToFront();

  log(`Page URL: ${page.url()}`);

  // ── Step 2: Login check ────────────────────────────────────
  const currentUrl = await page.evaluate(() => window.location.href);
  if (currentUrl.includes("/login") || currentUrl.includes("/signin") ||
      currentUrl.includes("accounts.google")) {
    log("⚠️  Not logged in — please use 'Login to GenSpark' button in dashboard first.");
    log("Waiting up to 2 minutes for login...");
    try {
      await page.waitForURL(
        u => !u.href.includes("/login") && !u.href.includes("/signin"),
        { timeout: 120_000 }
      );
      await page.waitForTimeout(3000);
      await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(3000);
    } catch (_) {
      log("❌ Login timeout. Aborting.");
      await browser.close();
      process.exit(1);
    }
  } else {
    log("✅ Session active.");
  }

  // ── Step 3: Debug — log all visible inputs ─────────────────
  const inputInfo = await page.evaluate(() => {
    return [...document.querySelectorAll("input, textarea, [contenteditable='true'], [role='textbox']")]
      .filter(el => {
        const s = window.getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && el.offsetHeight > 0;
      })
      .map(el => ({
        tag: el.tagName,
        type: el.type || "",
        placeholder: el.placeholder || "",
        ariaLabel: el.getAttribute("aria-label") || "",
        id: el.id || "",
        cls: (el.className || "").slice(0, 60),
      }));
  });
  log(`Visible inputs: ${JSON.stringify(inputInfo)}`);

  // ── Step 4: Find the prompt input ─────────────────
  // Use a selector string, NOT an elementHandle — handles go stale when page re-renders
  const inputSelectors = [
    'textarea[placeholder*="topic" i]',
    'textarea[placeholder*="creat" i]',
    'textarea[placeholder*="slide" i]',
    'textarea[placeholder*="present" i]',
    'textarea[placeholder*="generat" i]',
    'textarea[placeholder*="describ" i]',
    'input[placeholder*="topic" i]',
    'input[placeholder*="creat" i]',
    'input[placeholder*="slide" i]',
    '[role="textbox"]',
    'textarea',
    'input[type="text"]:not([type="search"])',
  ];

  let foundSelector = null;
  for (const sel of inputSelectors) {
    try {
      const el = await page.$(sel);
      if (el && await el.isVisible()) { foundSelector = sel; log(`✅ Input selector: ${sel}`); break; }
    } catch (_) {}
  }

  if (!foundSelector) {
    const ss = path.join(OUTPUT_DIR, `debug-${Date.now()}.png`);
    await page.screenshot({ path: ss, fullPage: true });
    log(`📸 Debug screenshot: ${ss}`);
    throw new Error(`No prompt input found. Visible inputs: ${JSON.stringify(inputInfo)}`);
  }

  // ── Step 5: Paste the prompt via clipboard (avoids stale DOM) ──
  log(`Pasting prompt via clipboard (${prompt.length} chars)...`);

  // Write the prompt text to the system clipboard via page context
  await page.evaluate((text) => {
    // Override clipboard write permissions if needed
    return navigator.clipboard.writeText(text).catch(() => {
      // Fallback: use a hidden textarea trick
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
  }, prompt);

  await page.waitForTimeout(300);

  // Click the input to focus it (re-query each time — never hold a stale ref)
  await page.click(foundSelector);
  await page.waitForTimeout(300);

  // Select all existing content and delete
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(200);

  // Paste
  await page.keyboard.press("Control+v");
  await page.waitForTimeout(1000); // wait for paste to settle

  // Verify content was pasted
  const pastedLength = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? (el.value || el.innerText || "").length : 0;
  }, foundSelector);

  if (pastedLength < 10) {
    // Clipboard paste failed — fall back to direct value injection
    log(`⚠️  Clipboard paste got ${pastedLength} chars, using direct injection...`);
    await page.evaluate((args) => {
      const el = document.querySelector(args.sel);
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      )?.set || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(el, args.text);
      el.dispatchEvent(new Event("input",  { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, { sel: foundSelector, text: prompt });
    await page.waitForTimeout(500);
  } else {
    log(`✅ Pasted successfully (${pastedLength} chars in input)`);
  }

  // ── Step 6: Click Generate ─────────────────────────────────
  log("Clicking Generate...");
  const genResult = await page.evaluate(() => {
    const keywords = ["generate", "create", "make", "go", "start", "build"];
    const btns = [...document.querySelectorAll("button, [role='button']")];
    // Priority: button near the input
    const gen = btns.find(b => {
      if (b.disabled) return false;
      const t = (b.innerText || b.textContent || b.getAttribute("aria-label") || "").toLowerCase().trim();
      return keywords.some(k => t.includes(k));
    });
    if (gen) { gen.click(); return gen.innerText?.trim() || "generate"; }

    // Submit button
    const sub = document.querySelector("button[type='submit']:not([disabled])");
    if (sub) { sub.click(); return "submit"; }

    // Arrow/send icon button near textarea
    const area = document.querySelector("textarea, input[type='text']");
    if (area) {
      const parent = area.closest("form, [class*='input'], [class*='search']");
      if (parent) {
        const btn = parent.querySelector("button:not([disabled])");
        if (btn) { btn.click(); return `parent-btn:${btn.className}` }
      }
    }
    return null;
  });

  if (genResult) {
    log(`✅ Triggered: "${genResult}"`);
  } else {
    log("No button found, pressing Enter on focused input");
    // Re-click the input first so Enter goes to the right place
    await page.click(foundSelector).catch(() => {});
    await page.keyboard.press("Enter");
  }

  // ── Step 7: Wait for generation ────────────────────────────
  log("⏳ Waiting for slides to generate (this takes 1–3 minutes)...");
  await page.waitForTimeout(8000); // initial buffer

  const isGenDone = async (pg) => {
    return pg.evaluate(() => {
      const btns = [...document.querySelectorAll("button, [role='button'], a")];
      // When slides finish generating, a highly specific "View & Export" button appears.
      const exportVisible = btns.some(b => 
        (b.innerText || "").includes("View & Export") || 
        (b.textContent || "").includes("View & Export")
      );
      if (exportVisible) return true;

      const body = document.body.innerText.toLowerCase();
      // Signals that generation is fully complete in the chat interface
      const signals = [
        "your presentation is ready", "slides are generated", "export functionality is available"
      ];
      if (signals.some(s => body.includes(s))) return true;

      // Slide thumbnails rendered
      if (document.querySelector(
        "[class*='slide-thumb'], [class*='slideThumb'], [class*='slide-preview'], " +
        "[class*='slide-card'], [class*='thumbnail']"
      )) return true;

      return false;
    }).catch(() => false);
  };

  await pollUntil(page, isGenDone, { timeout: 300_000, interval: 5000 });
  log("✅ Slides generated!");
  await page.bringToFront();
  await page.waitForTimeout(3000);

  // ── Step 8: Get the shareable link ─────────────────────────
  log("Getting shareable link...");

  // First try: the current page URL might already be the shareable link
  // (GenSpark sometimes changes the URL to the presentation URL after generation)
  let shareLink = await page.evaluate(() => window.location.href);
  log(`Current URL after generation: ${shareLink}`);

  // If it's still the explore page, we need to use the Share button
  if (shareLink.includes("tab=explore") || shareLink === TARGET_URL) {
    log("Trying Share button...");

    // Click Share button
    const shareClicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button, [role='button'], a")];
      const shareBtn = btns.find(b =>
        /share/i.test(b.innerText || b.getAttribute("aria-label") || b.textContent || "")
      );
      if (shareBtn) { shareBtn.click(); return true; }
      return false;
    });

    if (shareClicked) {
      log("✅ Share button clicked");
      await page.waitForTimeout(2000);

      // Look for "Anyone with link" option and click it
      await page.evaluate(() => {
        const options = [...document.querySelectorAll("[role='option'], [role='menuitem'], button, label")];
        const anyoneOpt = options.find(el =>
          /anyone|public|link/i.test(el.innerText || el.textContent || "")
        );
        if (anyoneOpt) anyoneOpt.click();
      });
      await page.waitForTimeout(1500);

      // Click "Copy link" button if present
      const copyClicked = await page.evaluate(() => {
        const btns = [...document.querySelectorAll("button, [role='button']")];
        const copyBtn = btns.find(b =>
          /copy/i.test(b.innerText || b.getAttribute("aria-label") || "")
        );
        if (copyBtn) { copyBtn.click(); return true; }
        return false;
      });
      if (copyClicked) log("✅ Copy link clicked");

      // Extract the presentation link from the dialog
      await page.waitForTimeout(3000);
      const linkFromDialog = await page.evaluate(() => {
        const inputs = [...document.querySelectorAll("input[type='text'], input[readonly]")];
        
        // Target the Presentation link specifically! (ends with gensparkspace.com)
        for (const inp of inputs) {
          const v = inp.value || "";
          if (v.includes("gensparkspace.com")) return v;
        }

        // Fallback checks
        for (const inp of inputs) {
          const v = inp.value || "";
          if (v.startsWith("http") && v.includes("genspark.ai")) return v;
        }

        // Displayed links
        const links = [...document.querySelectorAll("a[href]")];
        for (const a of links) {
          if (a.href.includes("gensparkspace.com")) return a.href;
        }
        return null;
      });

      if (linkFromDialog) {
        shareLink = linkFromDialog;
        log(`✅ Share link from dialog: ${shareLink}`);
      } else {
        log("⚠️ Presentation link not found in modal, trying current URL...");
      }
    }

    if (!shareLink || shareLink === TARGET_URL || !shareLink.includes('http')) {
      shareLink = await page.evaluate(() => window.location.href);
      log(`Using current URL as share link: ${shareLink}`);
    }
  }

  // Save the share link to a file for persistence
  const linkFile = path.join(OUTPUT_DIR, `link-${(jobId || Date.now()).toString().slice(0, 8)}.txt`);
  fs.writeFileSync(linkFile, shareLink, "utf-8");
  log(`✅ Link saved: ${linkFile}`);
  log(`🔗 Share link: ${shareLink}`);

  // Take a screenshot of the final state
  const ssPath = path.join(OUTPUT_DIR, `slides-${(jobId || Date.now()).toString().slice(0, 8)}.png`);
  await page.screenshot({ path: ssPath, fullPage: false });
  log(`📸 Screenshot: ${ssPath}`);

  await browser.close();

  // Return object with both the link and screenshot
  process.stdout.write(`RESULT:${JSON.stringify({ shareLink, ssPath, linkFile })}\n`);

})().catch(err => {
  process.stderr.write(`ERROR: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
