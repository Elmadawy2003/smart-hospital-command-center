import express from 'express';
import Joi from 'joi';
import { InventoryPredictionService } from '../services/inventoryPrediction';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, requirePermission, aiServiceRateLimit } from '../middleware/auth';
import { aiServiceLogger } from '../middleware/logging';

const router = express.Router();
const inventoryService = new InventoryPredictionService();

// Apply service-specific middleware
router.use(aiServiceLogger('InventoryPrediction'));
router.use(aiServiceRateLimit);

// Validation schemas
const optimizeInventorySchema = Joi.object({
  departmentId: Joi.string().optional(),
  includeExpiration: Joi.boolean().default(true),
  forecastDays: Joi.number().min(1).max(90).default(30),
  optimizationGoals: Joi.array().items(
    Joi.string().valid('cost', 'availability', 'waste_reduction', 'space_utilization')
  ).default(['cost', 'availability'])
});

const demandForecastSchema = Joi.object({
  itemIds: Joi.array().items(Joi.string()).min(1).max(50).required(),
  forecastDays: Joi.number().min(1).max(90).default(30),
  includeSeasonality: Joi.boolean().default(true),
  confidenceLevel: Joi.number().min(0.5).max(0.99).default(0.95)
});

const restockRecommendationSchema = Joi.object({
  departmentId: Joi.string().optional(),
  urgencyLevel: Joi.string().valid('all', 'critical', 'high', 'medium').default('all'),
  maxRecommendations: Joi.number().min(1).max(100).default(20),
  includeAlternatives: Joi.boolean().default(true)
});

const supplierAnalysisSchema = Joi.object({
  supplierId: Joi.string().optional(),
  timeframe: Joi.string().valid('30d', '90d', '180d', '1y').default('90d'),
  metrics: Joi.array().items(
    Joi.string().valid('reliability', 'cost', 'quality', 'delivery_time')
  ).default(['reliability', 'cost', 'delivery_time'])
});

// Routes

/**
 * @route POST /inventory-prediction/optimize
 * @desc Get comprehensive inventory optimization recommendations
 * @access Private (requires 'manage_inventory' permission)
 */
router.post('/optimize',
  requirePermission('manage_inventory'),
  validateRequest(optimizeInventorySchema),
  asyncHandler(async (req, res) => {
    const { departmentId } = req.body;

    const optimization = await inventoryService.optimizeInventory(departmentId);

    res.json({
      success: true,
      data: optimization,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /inventory-prediction/department/:departmentId/optimize
 * @desc Get inventory optimization for specific department
 * @access Private (requires 'manage_inventory' permission)
 */
router.get('/department/:departmentId/optimize',
  requirePermission('manage_inventory'),
  asyncHandler(async (req, res) => {
    const { departmentId } = req.params;

    const optimization = await inventoryService.optimizeInventory(departmentId);

    res.json({
      success: true,
      data: optimization,
      department: departmentId,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /inventory-prediction/demand/forecast
 * @desc Get demand forecasts for specific items
 * @access Private (requires 'view_inventory_analytics' permission)
 */
router.post('/demand/forecast',
  requirePermission('view_inventory_analytics'),
  validateRequest(demandForecastSchema),
  asyncHandler(async (req, res) => {
    const { itemIds, forecastDays, includeSeasonality, confidenceLevel } = req.body;

    // This would be implemented in the service
    const forecasts = await inventoryService.generateDemandForecasts(
      itemIds,
      forecastDays,
      includeSeasonality,
      confidenceLevel
    );

    res.json({
      success: true,
      data: forecasts,
      parameters: {
        itemIds,
        forecastDays,
        includeSeasonality,
        confidenceLevel
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /inventory-prediction/restock/recommendations
 * @desc Get restock recommendations
 * @access Private (requires 'manage_inventory' permission)
 */
router.post('/restock/recommendations',
  requirePermission('manage_inventory'),
  validateRequest(restockRecommendationSchema),
  asyncHandler(async (req, res) => {
    const { departmentId, urgencyLevel, maxRecommendations, includeAlternatives } = req.body;

    const recommendations = await inventoryService.getRestockRecommendations(
      departmentId,
      urgencyLevel,
      maxRecommendations,
      includeAlternatives
    );

    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
      parameters: {
        departmentId,
        urgencyLevel,
        maxRecommendations,
        includeAlternatives
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /inventory-prediction/expiration/alerts
 * @desc Get expiration alerts for inventory items
 * @access Private (requires 'view_inventory' permission)
 */
router.get('/expiration/alerts',
  requirePermission('view_inventory'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      daysAhead = 30,
      severity = 'all'
    } = req.query;

    const expirationAlerts = await inventoryService.getExpirationAlerts(
      departmentId as string,
      parseInt(daysAhead as string),
      severity as string
    );

    res.json({
      success: true,
      data: expirationAlerts,
      count: expirationAlerts.length,
      parameters: {
        departmentId,
        daysAhead: parseInt(daysAhead as string),
        severity
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /inventory-prediction/cost/optimization
 * @desc Get cost optimization insights
 * @access Private (requires 'view_financial_analytics' permission)
 */
router.get('/cost/optimization',
  requirePermission('view_financial_analytics'),
  asyncHandler(async (req, res) => {
    const { departmentId, timeframe = '90d' } = req.query;

    const costOptimization = await inventoryService.getCostOptimization(
      departmentId as string,
      timeframe as string
    );

    res.json({
      success: true,
      data: costOptimization,
      parameters: {
        departmentId,
        timeframe
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /inventory-prediction/supplier/analysis
 * @desc Get supplier performance analysis
 * @access Private (requires 'view_supplier_analytics' permission)
 */
router.post('/supplier/analysis',
  requirePermission('view_supplier_analytics'),
  validateRequest(supplierAnalysisSchema),
  asyncHandler(async (req, res) => {
    const { supplierId, timeframe, metrics } = req.body;

    const supplierAnalysis = await inventoryService.analyzeSupplierPerformance(
      supplierId,
      timeframe,
      metrics
    );

    res.json({
      success: true,
      data: supplierAnalysis,
      parameters: {
        supplierId,
        timeframe,
        metrics
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /inventory-prediction/trends
 * @desc Get inventory consumption trends
 * @access Private (requires 'view_inventory_analytics' permission)
 */
router.get('/trends',
  requirePermission('view_inventory_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      timeframe = '90d',
      granularity = 'daily',
      category,
      departmentId
    } = req.query;

    const trends = await inventoryService.getConsumptionTrends(
      timeframe as string,
      granularity as string,
      category as string,
      departmentId as string
    );

    res.json({
      success: true,
      data: trends,
      parameters: {
        timeframe,
        granularity,
        category,
        departmentId
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /inventory-prediction/wastage/analysis
 * @desc Get wastage analysis and reduction recommendations
 * @access Private (requires 'view_inventory_analytics' permission)
 */
router.get('/wastage/analysis',
  requirePermission('view_inventory_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      timeframe = '90d',
      departmentId,
      includeRecommendations = true
    } = req.query;

    const wastageAnalysis = await inventoryService.analyzeWastage(
      timeframe as string,
      departmentId as string,
      includeRecommendations === 'true'
    );

    res.json({
      success: true,
      data: wastageAnalysis,
      parameters: {
        timeframe,
        departmentId,
        includeRecommendations
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /inventory-prediction/abc/analysis
 * @desc Get ABC analysis for inventory classification
 * @access Private (requires 'view_inventory_analytics' permission)
 */
router.get('/abc/analysis',
  requirePermission('view_inventory_analytics'),
  asyncHandler(async (req, res) => {
    const { departmentId, timeframe = '1y' } = req.query;

    const abcAnalysis = await inventoryService.performABCAnalysis(
      departmentId as string,
      timeframe as string
    );

    res.json({
      success: true,
      data: abcAnalysis,
      parameters: {
        departmentId,
        timeframe
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /inventory-prediction/model/retrain
 * @desc Trigger model retraining
 * @access Private (requires 'manage_ai_models' permission)
 */
router.post('/model/retrain',
  requirePermission('manage_ai_models'),
  asyncHandler(async (req, res) => {
    const { modelType = 'all', useLatestData = true } = req.body;

    const retrainingResult = await inventoryService.trainModels(
      modelType,
      useLatestData
    );

    res.json({
      success: true,
      data: retrainingResult,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /inventory-prediction/model/performance
 * @desc Get model performance metrics
 * @access Private (requires 'view_ai_models' permission)
 */
router.get('/model/performance',
  requirePermission('view_ai_models'),
  asyncHandler(async (req, res) => {
    const performance = await inventoryService.getModelPerformance();

    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;