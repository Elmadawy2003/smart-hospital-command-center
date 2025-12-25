import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import { errorHandler } from '@/middleware/errorHandler';
import { notFoundHandler } from '@/middleware/notFoundHandler';
import { authMiddleware } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';

// Import routes
import authRoutes from '@/routes/auth';
import emrRoutes from '@/routes/emr';
import pharmacyRoutes from '@/routes/pharmacy';
import hrRoutes from '@/routes/hr';
import financeRoutes from '@/routes/finance';
import dashboardRoutes from '@/routes/dashboard';
import statisticsRoutes from '@/routes/statistics';
import securityRoutes from '@/routes/securityRoutes';
import pacsRoutes from '@/routes/pacsRoutes';
import ePrescriptionRoutes from '@/routes/ePrescriptionRoutes';
import insuranceRoutes from '@/routes/insuranceRoutes';
import aiModelsRoutes from '@/routes/aiModelsRoutes';
import supplyChainRoutes from '@/routes/supplyChainRoutes';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/emr', authMiddleware, emrRoutes);
app.use('/api/pharmacy', authMiddleware, pharmacyRoutes);
app.use('/api/hr', authMiddleware, hrRoutes);
app.use('/api/finance', authMiddleware, financeRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/statistics', authMiddleware, statisticsRoutes);
app.use('/api/security', authMiddleware, securityRoutes);
app.use('/api/pacs', authMiddleware, pacsRoutes);
app.use('/api/e-prescription', authMiddleware, ePrescriptionRoutes);
app.use('/api/insurance', authMiddleware, insuranceRoutes);
app.use('/api/ai-models', authMiddleware, aiModelsRoutes);
app.use('/api/supply-chain', authMiddleware, supplyChainRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-room', (room: string) => {
    socket.join(room);
    logger.info(`Client ${socket.id} joined room: ${room}`);
  });

  socket.on('leave-room', (room: string) => {
    socket.leave(room);
    logger.info(`Client ${socket.id} left room: ${room}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
async function startServer() {
  try {
    // Try to connect to database
    try {
      await connectDatabase();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.warn('Database connection failed, continuing without database');
    }

    // Try to connect to Redis
    try {
      await connectRedis();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.warn('Redis connection failed, continuing without Redis');
    }

    // Start server
    server.listen(PORT, () => {
      logger.info(`🏥 Hospital ERP Backend Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io };