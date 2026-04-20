import cron from 'node-cron';
import { supabase } from './lib/supabase-client.js';
// @ts-ignore
import { runReportingJob } from './engine/reporting-orchestrator.js';

export function initCronJobs() {
  console.log('[Cron] Initializing scheduled jobs...');

  // Run on the 1st of every month at 00:00
  cron.schedule('0 0 1 * *', async () => {
    console.log('[Cron] Triggering monthly GenSpark reports...');
    try {
      // 1. Fetch channels with automated reporting enabled
      const { data: channels, error } = await supabase
        .from('channels')
        .select('*')
        .eq('auto_reporting', true);

      if (error) throw error;
      if (!channels || channels.length === 0) {
        console.log('[Cron] No channels with auto-reporting enabled.');
        return;
      }

      console.log(`[Cron] Found ${channels.length} channels for auto-reporting.`);

      for (const channel of channels) {
        try {
          // Calculate monthly range (previous month)
          const now = new Date();
          const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
          const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);

          const startDate = firstOfPrevMonth.toISOString().split('T')[0];
          const endDate = lastOfPrevMonth.toISOString().split('T')[0];

          console.log(`[Cron] Starting report for Channel: ${channel.channel_name} (${startDate} to ${endDate})`);

          const jobId = `auto-${channel.id.slice(0, 4)}-${Date.now()}`;
          
          await runReportingJob({
            channelId: channel.channel_external_id,
            oauthToken: channel.oauth_tokens_json,
            startDate,
            endDate,
            reportType: channel.reporting_type || 'WEEKLY',
            jobId,
            emitLog: (msg: string, type: string) => {
              console.log(`[AutoReport:${jobId}] [${type}] ${msg}`);
            }
          }).then(async (result: any) => {
             // Save to reports table
             await supabase.from('reports').insert({
               channel_id: channel.id,
               report_type: channel.reporting_type || 'WEEKLY',
               period_start: startDate,
               period_end: endDate,
               status: 'done',
               presentation_url: result.shareLink,
               csv_folder: `csv-${jobId}`
             });
          });

        } catch (innerErr: any) {
          console.error(`[Cron] Failed for channel ${channel.id}:`, innerErr.message);
        }
      }

      console.log('[Cron] Monthly reports completed.');
    } catch (error) {
      console.error('[Cron] Monthly reports failed:', error);
    }
  });
}
