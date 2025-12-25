import express from 'express';
import Joi from 'joi';
import { ResourceOptimizationService } from '../services/resourceOptimization';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, requirePermission, aiServiceRateLimit } from '../middleware/auth';
import { aiServiceLogger } from '../middleware/logging';

const router = express.Router();
const resourceService = new ResourceOptimizationService();

// Apply service-specific middleware
router.use(aiServiceLogger('ResourceOptimization'));
router.use(aiServiceRateLimit);

// Validation schemas
const staffingOptimizationSchema = Joi.object({
  departmentId: Joi.string().optional(),
  shiftType: Joi.string().valid('day', 'night', 'all').default('all'),
  forecastDays: Joi.number().min(1).max(30).default(7),
  includeSkillMix: Joi.boolean().default(true),
  optimizationGoals: Joi.array().items(
    Joi.string().valid('cost', 'quality', 'coverage', 'satisfaction')
  ).default(['cost', 'quality'])
});

const bedManagementSchema = Joi.object({
  departmentId: Joi.string().optional(),
  bedType: Joi.string().valid('icu', 'general', 'emergency', 'surgical', 'all').default('all'),
  forecastHours: Joi.number().min(1).max(168).default(24),
  includeDischarges: Joi.boolean().default(true),
  includeTransfers: Joi.boolean().default(true)
});

const equipmentOptimizationSchema = Joi.object({
  equipmentType: Joi.string().optional(),
  departmentId: Joi.string().optional(),
  utilizationThreshold: Joi.number().min(0).max(1).default(0.8),
  maintenanceWindow: Joi.number().min(1).max(30).default(7),
  includePortable: Joi.boolean().default(true)
});

const demandPredictionSchema = Joi.object({
  serviceType: Joi.string().valid('appointment', 'emergency', 'surgery', 'lab', 'imaging').required(),
  departmentId: Joi.string().optional(),
  forecastDays: Joi.number().min(1).max(90).default(30),
  granularity: Joi.string().valid('hourly', 'daily', 'weekly').default('daily'),
  includeSeasonality: Joi.boolean().default(true)
});

// Routes

/**
 * @route POST /resource-optimization/staffing/optimize
 * @desc Get staffing optimization recommendations
 * @access Private (requires 'manage_staffing' permission)
 */
router.post('/staffing/optimize',
  requirePermission('manage_staffing'),
  validateRequest(staffingOptimizationSchema),
  asyncHandler(async (req, res) => {
    const { departmentId, shiftType, forecastDays, includeSkillMix, optimizationGoals } = req.body;

    const staffingOptimization = await resourceService.optimizeStaffing(
      departmentId,
      shiftType,
      forecastDays,
      includeSkillMix,
      optimizationGoals
    );

    res.json({
      success: true,
      data: staffingOptimization,
      parameters: {
        departmentId,
        shiftType,
        forecastDays,
        includeSkillMix,
        optimizationGoals
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /resource-optimization/staffing/department/:departmentId
 * @desc Get staffing optimization for specific department
 * @access Private (requires 'view_staffing' permission)
 */
router.get('/staffing/department/:departmentId',
  requirePermission('view_staffing'),
  asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { shiftType = 'all', forecastDays = 7 } = req.query;

    const staffingOptimization = await resourceService.optimizeStaffing(
      departmentId,
      shiftType as string,
      parseInt(forecastDays as string)
    );

    res.json({
      success: true,
      data: staffingOptimization,
      department: departmentId,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /resource-optimization/beds/optimize
 * @desc Get bed management optimization
 * @access Private (requires 'manage_beds' permission)
 */
router.post('/beds/optimize',
  requirePermission('manage_beds'),
  validateRequest(bedManagementSchema),
  asyncHandler(async (req, res) => {
    const { departmentId, bedType, forecastHours, includeDischarges, includeTransfers } = req.body;

    const bedOptimization = await resourceService.optimizeBedManagement(
      departmentId,
      bedType,
      forecastHours,
      includeDischarges,
      includeTransfers
    );

    res.json({
      success: true,
      data: bedOptimization,
      parameters: {
        departmentId,
        bedType,
        forecastHours,
        includeDischarges,
        includeTransfers
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /resource-optimization/beds/availability
 * @desc Get real-time bed availability and predictions
 * @access Private (requires 'view_beds' permission)
 */
router.get('/beds/availability',
  requirePermission('view_beds'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      bedType = 'all',
      forecastHours = 24
    } = req.query;

    const bedAvailability = await resourceService.getBedAvailabilityForecast(
      departmentId as string,
      bedType as string,
      parseInt(forecastHours as string)
    );

    res.json({
      success: true,
      data: bedAvailability,
      parameters: {
        departmentId,
        bedType,
        forecastHours: parseInt(forecastHours as string)
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /resource-optimization/equipment/optimize
 * @desc Get equipment utilization optimization
 * @access Private (requires 'manage_equipment' permission)
 */
router.post('/equipment/optimize',
  requirePermission('manage_equipment'),
  validateRequest(equipmentOptimizationSchema),
  asyncHandler(async (req, res) => {
    const { equipmentType, departmentId, utilizationThreshold, maintenanceWindow, includePortable } = req.body;

    const equipmentOptimization = await resourceService.optimizeEquipmentUtilization(
      equipmentType,
      departmentId,
      utilizationThreshold,
      maintenanceWindow,
      includePortable
    );

    res.json({
      success: true,
      data: equipmentOptimization,
      parameters: {
        equipmentType,
        departmentId,
        utilizationThreshold,
        maintenanceWindow,
        includePortable
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /resource-optimization/equipment/utilization
 * @desc Get equipment utilization analytics
 * @access Private (requires 'view_equipment' permission)
 */
router.get('/equipment/utilization',
  requirePermission('view_equipment'),
  asyncHandler(async (req, res) => {
    const { 
      equipmentType,
      departmentId,
      timeframe = '7d',
      includeDowntime = true
    } = req.query;

    const utilization = await resourceService.getEquipmentUtilization(
      equipmentType as string,
      departmentId as string,
      timeframe as string,
      includeDowntime === 'true'
    );

    res.json({
      success: true,
      data: utilization,
      parameters: {
        equipmentType,
        departmentId,
        timeframe,
        includeDowntime
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /resource-optimization/demand/predict
 * @desc Predict demand for various hospital services
 * @access Private (requires 'view_analytics' permission)
 */
router.post('/demand/predict',
  requirePermission('view_analytics'),
  validateRequest(demandPredictionSchema),
  asyncHandler(async (req, res) => {
    const { serviceType, departmentId, forecastDays, granularity, includeSeasonality } = req.body;

    const demandPrediction = await resourceService.predictDemand(
      serviceType,
      departmentId,
      forecastDays,
      granularity,
      includeSeasonality
    );

    res.json({
      success: true,
      data: demandPrediction,
      parameters: {
        serviceType,
        departmentId,
        forecastDays,
        granularity,
        includeSeasonality
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /resource-optimization/capacity/analysis
 * @desc Get capacity analysis across departments
 * @access Private (requires 'view_analytics' permission)
 */
router.get('/capacity/analysis',
  requirePermission('view_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      timeframe = '30d',
      includeProjections = true,
      departmentId
    } = req.query;

    const capacityAnalysis = await resourceService.analyzeCapacity(
      timeframe as string,
      includeProjections === 'true',
      departmentId as string
    );

    res.json({
      success: true,
      data: capacityAnalysis,
      parameters: {
        timeframe,
        includeProjections,
        departmentId
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /resource-optimization/bottlenecks
 * @desc Identify resource bottlenecks and constraints
 * @access Private (requires 'view_analytics' permission)
 */
router.get('/bottlenecks',
  requirePermission('view_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      severity = 'all',
      timeframe = '7d',
      includeRecommendations = true
    } = req.query;

    const bottlenecks = await resourceService.identifyBottlenecks(
      severity as string,
      timeframe as string,
      includeRecommendations === 'true'
    );

    res.json({
      success: true,
      data: bottlenecks,
      count: bottlenecks.length,
      parameters: {
        severity,
        timeframe,
        includeRecommendations
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /resource-optimization/efficiency/metrics
 * @desc Get resource efficiency metrics
 * @access Private (requires 'view_analytics' permission)
 */
router.get('/efficiency/metrics',
  requirePermission('view_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      timeframe = '30d',
      compareWithBenchmark = true
    } = req.query;

    const efficiencyMetrics = await resourceService.getEfficiencyMetrics(
      departmentId as string,
      timeframe as string,
      compareWithBenchmark === 'true'
    );

    res.json({
      success: true,
      data: efficiencyMetrics,
      parameters: {
        departmentId,
        timeframe,
        compareWithBenchmark
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /resource-optimization/cost/analysis
 * @desc Get resource cost analysis and optimization opportunities
 * @access Private (requires 'view_financial_analytics' permission)
 */
router.get('/cost/analysis',
  requirePermission('view_financial_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      timeframe = '90d',
      includeProjections = true,
      costCategory = 'all'
    } = req.query;

    const costAnalysis = await resourceService.analyzeCosts(
      departmentId as string,
      timeframe as string,
      includeProjections === 'true',
      costCategory as string
    );

    res.json({
      success: true,
      data: costAnalysis,
      parameters: {
        departmentId,
        timeframe,
        includeProjections,
        costCategory
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /resource-optimization/scenario/simulate
 * @desc Simulate resource allocation scenarios
 * @access Private (requires 'manage_resources' permission)
 */
router.post('/scenario/simulate',
  requirePermission('manage_resources'),
  asyncHandler(async (req, res) => {
    const { 
      scenarios,
      timeframe = '30d',
      includeMetrics = true
    } = req.body;

    const simulationResults = await resourceService.simulateScenarios(
      scenarios,
      timeframe,
      includeMetrics
    );

    res.json({
      success: true,
      data: simulationResults,
      scenarioCount: scenarios.length,
      parameters: {
        timeframe,
        includeMetrics
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /resource-optimization/model/retrain
 * @desc Trigger model retraining
 * @access Private (requires 'manage_ai_models' permission)
 */
router.post('/model/retrain',
  requirePermission('manage_ai_models'),
  asyncHandler(async (req, res) => {
    const { modelType = 'all', useLatestData = true } = req.body;

    const retrainingResult = await resourceService.trainModels(
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
 * @route GET /resource-optimization/model/performance
 * @desc Get model performance metrics
 * @access Private (requires 'view_ai_models' permission)
 */
router.get('/model/performance',
  requirePermission('view_ai_models'),
  asyncHandler(async (req, res) => {
    const performance = await resourceService.getModelPerformance();

    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;