const path = require("path");
const fs = require("fs");
const { extractAnalyticsAPI } = require("./yt-api-extractor");
const { processAnalytics } = require("./data-processor");
const { generateInsights } = require("./insight-engine");
const { buildPrompt } = require("./prompt-builder");
const { saveToCSV } = require("./csv-builder");
const { spawn } = require("child_process");

/**
 * Main Orchestrator for the Reporting Pipeline
 */
async function runReportingJob({ channelId, oauthToken, startDate, endDate, reportType, jobId, emitLog }) {
  try {
    emitLog(`🎬 Starting ${reportType} report for ${startDate} to ${endDate}`, "system");

    // ── Step 1: Extract API Data ───────────────────────────
    emitLog("📊 Step 1: Extracting data from YouTube Analytics API...", "system");
    const ranges = {
      current: { start: startDate, end: endDate },
      // Mocking previous and yoy for now or calculating based on startDate
      previous: { start: startDate, end: endDate }, 
      yoy: { start: startDate, end: endDate }
    };

    const analyticsData = await extractAnalyticsAPI({ 
      channelId, 
      oauthToken, 
      ranges 
    });
    emitLog("✅ YouTube data successfully extracted", "success");

    // ── Step 2: Save CSVs ──────────────────────────────────
    const csvDir = path.join(__dirname, "../../outputs", `csv-${jobId}`);
    saveToCSV(analyticsData, csvDir);
    emitLog(`📁 CSV data saved to outputs/csv-${jobId}`, "info");

    // ── Step 3: Process & Insights ────────────────────────
    emitLog("🧮 Step 3: Processing metrics...", "system");
    const processedData = processAnalytics(analyticsData, ranges);
    const insights = generateInsights(processedData);
    emitLog(`✅ Processed. Generated ${insights.length} insights`, "success");

    // ── Step 4: Build GenSpark Prompt ─────────────────────
    emitLog("📝 Step 4: Building GenSpark AI prompt...", "system");
    const prompt = buildPrompt(analyticsData, processedData, insights, { 
       reportType, ranges, startDate, endDate 
    });

    const promptPath = path.join(__dirname, "../../outputs", `prompt-${jobId}.txt`);
    fs.mkdirSync(path.dirname(promptPath), { recursive: true });
    fs.writeFileSync(promptPath, prompt);

    // ── Step 5: GenSpark Automation (Headless) ────────────
    emitLog("🤖 Step 5: Launching GenSpark AI automation (Headless)...", "system");
    
    return new Promise((resolve, reject) => {
      const gsProcess = spawn("node", [
        path.join(__dirname, "genspark-automation.js"),
        JSON.stringify({ prompt, jobId })
      ]);

      gsProcess.stdout.on("data", (data) => {
        const line = data.toString();
        if (line.includes("[GenSpark]")) {
           emitLog(line.replace("[GenSpark]", "✨"), "info");
        }
        if (line.includes("RESULT:")) {
           const result = JSON.parse(line.split("RESULT:")[1]);
           resolve(result);
        }
      });

      gsProcess.stderr.on("data", (data) => {
        emitLog(`⚠️ ${data.toString()}`, "error");
      });

      gsProcess.on("close", (code) => {
        if (code !== 0) reject(new Error(`GenSpark automation failed with code ${code}`));
      });
    });

  } catch (err) {
    emitLog(`❌ Pipeline failed: ${err.message}`, "error");
    throw err;
  }
}

module.exports = { runReportingJob };
