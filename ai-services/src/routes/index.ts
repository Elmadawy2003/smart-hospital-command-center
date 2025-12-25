import express from 'express';
import riskPredictionRoutes from './riskPrediction';
import diagnosisAssistanceRoutes from './diagnosisAssistance';
import resourceOptimizationRoutes from './resourceOptimization';
import patientInsightsRoutes from './patientInsights';
import appointmentOptimizationRoutes from './appointmentOptimization';
import inventoryPredictionRoutes from './inventoryPrediction';
import { authMiddleware, validateApiKey, rateLimitMiddleware } from '../middleware/auth';
import { requestLogger } from '../middleware/logging';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();

// Apply global middleware
router.use(requestLogger);
router.use(validateApiKey);
router.use(rateLimitMiddleware);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      riskPrediction: 'active',
      diagnosisAssistance: 'active',
      resourceOptimization: 'active',
      patientInsights: 'active',
      appointmentOptimization: 'active',
      inventoryPrediction: 'active'
    }
  });
});

// API routes
router.use('/risk-prediction', authMiddleware, riskPredictionRoutes);
router.use('/diagnosis-assistance', authMiddleware, diagnosisAssistanceRoutes);
router.use('/resource-optimization', authMiddleware, resourceOptimizationRoutes);
router.use('/patient-insights', authMiddleware, patientInsightsRoutes);
router.use('/appointment-optimization', authMiddleware, appointmentOptimizationRoutes);
router.use('/inventory-prediction', authMiddleware, inventoryPredictionRoutes);

// Error handling
router.use(errorHandler);

export default router;