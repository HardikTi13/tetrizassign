import cron from 'node-cron';
import axios from 'axios';
import prisma from './db';

/**
 * Runs a health check on all registered URLs.
 * Handles timeouts, redirects, network failures and captures status code + response time.
 */
export async function runHealthChecks() {
  console.log(`[Cron] Starting health check cycle at ${new Date().toISOString()}`);
  
  try {
    const urls = await prisma.url.findMany();
    
    if (urls.length === 0) {
      console.log('[Cron] No URLs registered for monitoring.');
      return;
    }
    
    const checkPromises = urls.map(async (urlObj) => {
      const startTime = Date.now();
      let statusCode: number | null = null;
      let isUp = false;
      let responseTime = 0;
      
      try {
        // Send a GET request to the URL.
        // We set validateStatus to return true for all status codes so that 4xx/5xx responses 
        // are resolved instead of rejected, allowing us to inspect the status code.
        const response = await axios.get(urlObj.url, {
          timeout: 10000, // 10-second timeout
          validateStatus: () => true,
          headers: {
            'User-Agent': 'UptimeMonitorMVP/1.0',
            'Accept': '*/*'
          }
        });
        
        responseTime = Date.now() - startTime;
        statusCode = response.status;
        
        // HTTP 2xx and 3xx are considered UP
        if (response.status >= 200 && response.status < 400) {
          isUp = true;
        } else {
          isUp = false;
        }
      } catch (error: any) {
        responseTime = Date.now() - startTime;
        isUp = false;
        
        if (error.response) {
          // Response was received with a status code that fell out of range (if validateStatus failed somehow)
          const status = error.response.status;
          statusCode = status;
          if (status >= 200 && status < 400) {
            isUp = true;
          }
        } else if (error.request) {
          // Request was made but no response was received (network error or timeout)
          statusCode = null;
        } else {
          // Something else happened setting up the request
          statusCode = null;
        }
        
        // Cap the responseTime if it somehow exceeded significantly
        if (responseTime > 10000) {
          responseTime = 10000;
        }
      }
      
      // Save check results in the database
      try {
        await prisma.healthCheck.create({
          data: {
            urlId: urlObj.id,
            statusCode,
            responseTime,
            isUp,
            checkedAt: new Date()
          }
        });
      } catch (dbError) {
        console.error(`[Cron] Database write error for URL ${urlObj.url}:`, dbError);
      }
    });
    
    // Use settled to make sure one check failing or hanging does not block other checks
    await Promise.allSettled(checkPromises);
    console.log(`[Cron] Health check cycle completed.`);
  } catch (error) {
    console.error('[Cron] Critical error in health check cycle:', error);
  }
}

/**
 * Starts the background health check cron task.
 */
export function startCronJob() {
  console.log('[Cron] Initializing node-cron scheduler (1 minute interval)...');
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await runHealthChecks();
    } catch (err) {
      console.error('[Cron] Unhandled exception in cron schedule loop:', err);
    }
  });
  
  // Run an initial check 5 seconds after startup to populate data for demo purposes
  setTimeout(async () => {
    console.log('[Cron] Running initial startup check cycle...');
    try {
      await runHealthChecks();
    } catch (err) {
      console.error('[Cron] Startup health checks failed:', err);
    }
  }, 5000);
}
