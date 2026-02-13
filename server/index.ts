import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { logger } from "./logger";
import pinoHttp from "pino-http";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// HTTP request logging with Pino
app.use(pinoHttp({
  logger,
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn'
    } else if (res.statusCode >= 500 || err) {
      return 'error'
    } else if (res.statusCode >= 300 && res.statusCode < 400) {
      return 'silent'
    }
    return 'info'
  },
  customSuccessMessage: function (req, res) {
    if (req.url?.startsWith('/api')) {
      return `${req.method} ${req.url} completed`;
    }
    return 'request completed';
  },
  customErrorMessage: function (req, res, err) {
    return `${req.method} ${req.url} error: ${err.message}`;
  }
}));

(async () => {
  let server;
  
  try {
    // Test database connection early
    logger.info('Testing database connection...');
    await import('./db');
    logger.info('Database connection established');
    
    // Register routes and create server
    logger.info('Registering routes...');
    server = await registerRoutes(app);
    logger.info('Routes registered successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize server components');
    throw error;
  }

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error({
      error: err,
      url: req.url,
      method: req.method,
      status
    }, `Unhandled error: ${message}`);

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  try {
    if (app.get("env") === "development") {
      logger.info('Setting up Vite development server...');
      await setupVite(app, server);
      logger.info('Vite development server setup complete');
    } else {
      logger.info('Setting up static file serving for production...');
      serveStatic(app);
      logger.info('Static file serving setup complete');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to setup file serving');
    throw error;
  }

  // Use PORT environment variable with fallback to 5000
  // this serves both the API and the client.
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  
  try {
    logger.info({ port, host: "0.0.0.0" }, `Starting server on port ${port}...`);
    
    await new Promise<void>((resolve, reject) => {
      server.listen({
        port,
        host: "0.0.0.0",
        reusePort: true,
      }, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          logger.info({ port, host: "0.0.0.0" }, `Server started successfully on port ${port}`);
          resolve();
        }
      });
    });
  } catch (error) {
    logger.error({ error, port }, 'Failed to start server on port');
    throw error;
  }

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  });
})().catch((error) => {
  logger.error({ error }, 'Failed to start server');
  console.error('Server startup failed:', error);
  process.exit(1);
});
