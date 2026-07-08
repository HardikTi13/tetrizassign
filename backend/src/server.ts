import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './db';
import { startCronJob, runHealthChecks } from './cron';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());

/**
 * Helper to validate URL formatting.
 * Ensures the string is a valid absolute URL and uses http or https protocol.
 */
function isValidUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// ==========================================
// REST API Endpoints
// ==========================================

/**
 * POST /urls
 * Register a new URL for monitoring.
 */
app.post('/urls', async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required and must be a string.' });
    }

    const trimmedUrl = url.trim();

    if (!isValidUrl(trimmedUrl)) {
      return res.status(400).json({ error: 'Invalid URL. Please make sure to include http:// or https:// and a valid domain.' });
    }

    // Check for duplicates
    const existingUrl = await prisma.url.findUnique({
      where: { url: trimmedUrl }
    });

    if (existingUrl) {
      return res.status(400).json({ error: 'This URL is already being monitored.' });
    }

    // Create URL
    const newUrl = await prisma.url.create({
      data: { url: trimmedUrl }
    });

    console.log(`[API] URL registered: ${trimmedUrl}`);

    // Proactively run health checks on the new URL immediately
    // rather than waiting for next minute. This provides a fast interactive feedback loop!
    setTimeout(async () => {
      try {
        await runHealthChecks();
      } catch (err) {
        console.error('[API] Failed to run immediate check after URL addition:', err);
      }
    }, 1000);

    return res.status(201).json(newUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /urls
 * Retrieve all registered URLs along with their latest health check.
 */
app.get('/urls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const urls = await prisma.url.findMany({
      include: {
        healthChecks: {
          orderBy: { checkedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format output so the frontend gets a clean object
    const result = urls.map((urlObj) => {
      const latestCheck = urlObj.healthChecks.length > 0 ? urlObj.healthChecks[0] : null;
      return {
        id: urlObj.id,
        url: urlObj.url,
        createdAt: urlObj.createdAt,
        latestCheck
      };
    });

    return res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /urls/:id/history
 * Retrieve all health check logs for a specific URL ordered by newest first.
 */
app.get('/urls/:id/history', async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;

    // Check if the URL exists
    const urlObj = await prisma.url.findUnique({
      where: { id }
    });

    if (!urlObj) {
      return res.status(404).json({ error: 'URL not found.' });
    }

    const history = await prisma.healthCheck.findMany({
      where: { urlId: id },
      orderBy: { checkedAt: 'desc' }
    });

    return res.json(history);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /urls/:id
 * Remove a monitored URL.
 */
app.delete('/urls/:id', async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { id } = req.params;

    const urlObj = await prisma.url.findUnique({
      where: { id }
    });

    if (!urlObj) {
      return res.status(404).json({ error: 'URL not found.' });
    }

    await prisma.url.delete({
      where: { id }
    });

    console.log(`[API] URL deleted: ${urlObj.url}`);
    return res.json({ message: 'URL successfully removed from monitor.', deletedUrl: urlObj.url });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Error Handling Middleware
// ==========================================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error]:', err);
  return res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start Server and Cron
app.listen(port, () => {
  console.log(`[Server] Running on port ${port}`);
  startCronJob();
});
