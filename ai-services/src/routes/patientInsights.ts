import express from 'express';
import Joi from 'joi';
import { PatientInsightsService } from '../services/patientInsights';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, requirePermission, aiServiceRateLimit } from '../middleware/auth';
import { aiServiceLogger } from '../middleware/logging';

const router = express.Router();
const insightsService = new PatientInsightsService();

// Apply service-specific middleware
router.use(aiServiceLogger('PatientInsights'));
router.use(aiServiceRateLimit);

// Validation schemas
const patientAnalysisSchema = Joi.object({
  patientId: Joi.string().required(),
  analysisType: Joi.array().items(
    Joi.string().valid('trends', 'alerts', 'risk_factors', 'recommendations', 'outcomes')
  ).default(['trends', 'alerts']),
  timeframe: Joi.string().valid('7d', '30d', '90d', '180d', '1y', 'all').default('90d'),
  includeComparisons: Joi.boolean().default(true)
});

const cohortAnalysisSchema = Joi.object({
  cohortCriteria: Joi.object({
    ageRange: Joi.object({
      min: Joi.number().min(0).max(150),
      max: Joi.number().min(0).max(150)
    }).optional(),
    gender: Joi.string().valid('male', 'female', 'other', 'all').default('all'),
    conditions: Joi.array().items(Joi.string()).optional(),
    department: Joi.string().optional(),
    admissionType: Joi.string().valid('emergency', 'elective', 'transfer', 'all').default('all')
  }).required(),
  analysisMetrics: Joi.array().items(
    Joi.string().valid('outcomes', 'length_of_stay', 'readmission', 'mortality', 'cost', 'satisfaction')
  ).default(['outcomes', 'length_of_stay']),
  timeframe: Joi.string().valid('30d', '90d', '180d', '1y', '2y').default('1y')
});

const trendAnalysisSchema = Joi.object({
  patientIds: Joi.array().items(Joi.string()).max(50).optional(),
  departmentId: Joi.string().optional(),
  trendType: Joi.string().valid('vitals', 'lab_results', 'medications', 'symptoms', 'outcomes').required(),
  timeframe: Joi.string().valid('24h', '7d', '30d', '90d').default('30d'),
  granularity: Joi.string().valid('hourly', 'daily', 'weekly').default('daily')
});

const alertConfigSchema = Joi.object({
  patientId: Joi.string().optional(),
  departmentId: Joi.string().optional(),
  alertTypes: Joi.array().items(
    Joi.string().valid('critical_vitals', 'deterioration', 'medication_interaction', 'fall_risk', 'infection_risk')
  ).default(['critical_vitals', 'deterioration']),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical', 'all').default('all'),
  timeframe: Joi.string().valid('1h', '6h', '24h', '7d').default('24h')
});

// Routes

/**
 * @route POST /patient-insights/analyze
 * @desc Get comprehensive patient analysis
 * @access Private (requires 'view_patient_analytics' permission)
 */
router.post('/analyze',
  requirePermission('view_patient_analytics'),
  validateRequest(patientAnalysisSchema),
  asyncHandler(async (req, res) => {
    const { patientId, analysisType, timeframe, includeComparisons } = req.body;

    const analysis = await insightsService.analyzePatient(
      patientId,
      analysisType,
      timeframe,
      includeComparisons
    );

    res.json({
      success: true,
      data: analysis,
      patient: patientId,
      parameters: {
        analysisType,
        timeframe,
        includeComparisons
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /patient-insights/patient/:patientId/trends
 * @desc Get patient trends analysis
 * @access Private (requires 'view_patient_data' permission)
 */
router.get('/patient/:patientId/trends',
  requirePermission('view_patient_data'),
  asyncHandler(async (req, res) => {
    const { patientId } = req.params;
    const { 
      timeframe = '90d',
      trendType = 'vitals',
      includeAlerts = true
    } = req.query;

    const trends = await insightsService.getPatientTrends(
      patientId,
      timeframe as string,
      trendType as string,
      includeAlerts === 'true'
    );

    res.json({
      success: true,
      data: trends,
      patient: patientId,
      parameters: {
        timeframe,
        trendType,
        includeAlerts
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /patient-insights/patient/:patientId/alerts
 * @desc Get patient-specific alerts
 * @access Private (requires 'view_patient_data' permission)
 */
router.get('/patient/:patientId/alerts',
  requirePermission('view_patient_data'),
  asyncHandler(async (req, res) => {
    const { patientId } = req.params;
    const { 
      severity = 'all',
      timeframe = '24h',
      includeResolved = false
    } = req.query;

    const alerts = await insightsService.getPatientAlerts(
      patientId,
      severity as string,
      timeframe as string,
      includeResolved === 'true'
    );

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      patient: patientId,
      parameters: {
        severity,
        timeframe,
        includeResolved
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /patient-insights/cohort/analyze
 * @desc Analyze patient cohorts
 * @access Private (requires 'view_population_analytics' permission)
 */
router.post('/cohort/analyze',
  requirePermission('view_population_analytics'),
  validateRequest(cohortAnalysisSchema),
  asyncHandler(async (req, res) => {
    const { cohortCriteria, analysisMetrics, timeframe } = req.body;

    const cohortAnalysis = await insightsService.analyzeCohort(
      cohortCriteria,
      analysisMetrics,
      timeframe
    );

    res.json({
      success: true,
      data: cohortAnalysis,
      parameters: {
        cohortCriteria,
        analysisMetrics,
        timeframe
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /patient-insights/trends/analyze
 * @desc Analyze trends across multiple patients or departments
 * @access Private (requires 'view_analytics' permission)
 */
router.post('/trends/analyze',
  requirePermission('view_analytics'),
  validateRequest(trendAnalysisSchema),
  asyncHandler(async (req, res) => {
    const { patientIds, departmentId, trendType, timeframe, granularity } = req.body;

    const trendAnalysis = await insightsService.analyzeTrends(
      patientIds,
      departmentId,
      trendType,
      timeframe,
      granularity
    );

    res.json({
      success: true,
      data: trendAnalysis,
      parameters: {
        patientIds,
        departmentId,
        trendType,
        timeframe,
        granularity
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /patient-insights/alerts/configure
 * @desc Configure and get alerts based on criteria
 * @access Private (requires 'manage_alerts' permission)
 */
router.post('/alerts/configure',
  requirePermission('manage_alerts'),
  validateRequest(alertConfigSchema),
  asyncHandler(async (req, res) => {
    const { patientId, departmentId, alertTypes, severity, timeframe } = req.body;

    const alerts = await insightsService.configureAlerts(
      patientId,
      departmentId,
      alertTypes,
      severity,
      timeframe
    );

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      parameters: {
        patientId,
        departmentId,
        alertTypes,
        severity,
        timeframe
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /patient-insights/alerts/active
 * @desc Get all active alerts
 * @access Private (requires 'view_alerts' permission)
 */
router.get('/alerts/active',
  requirePermission('view_alerts'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      severity = 'all',
      limit = 50,
      offset = 0
    } = req.query;

    const activeAlerts = await insightsService.getActiveAlerts(
      departmentId as string,
      severity as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: activeAlerts,
      count: activeAlerts.length,
      parameters: {
        departmentId,
        severity,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /patient-insights/risk-factors
 * @desc Get risk factor analysis
 * @access Private (requires 'view_risk_analytics' permission)
 */
router.get('/risk-factors',
  requirePermission('view_risk_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      patientId,
      departmentId,
      riskType = 'all',
      timeframe = '90d'
    } = req.query;

    const riskFactors = await insightsService.analyzeRiskFactors(
      patientId as string,
      departmentId as string,
      riskType as string,
      timeframe as string
    );

    res.json({
      success: true,
      data: riskFactors,
      parameters: {
        patientId,
        departmentId,
        riskType,
        timeframe
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /patient-insights/outcomes/predict
 * @desc Predict patient outcomes
 * @access Private (requires 'view_predictive_analytics' permission)
 */
router.get('/outcomes/predict',
  requirePermission('view_predictive_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      patientId,
      outcomeType = 'all',
      timeHorizon = '30d',
      includeConfidence = true
    } = req.query;

    const outcomePredictions = await insightsService.predictOutcomes(
      patientId as string,
      outcomeType as string,
      timeHorizon as string,
      includeConfidence === 'true'
    );

    res.json({
      success: true,
      data: outcomePredictions,
      parameters: {
        patientId,
        outcomeType,
        timeHorizon,
        includeConfidence
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /patient-insights/recommendations
 * @desc Get AI-powered recommendations for patient care
 * @access Private (requires 'view_recommendations' permission)
 */
router.get('/recommendations',
  requirePermission('view_recommendations'),
  asyncHandler(async (req, res) => {
    const { 
      patientId,
      recommendationType = 'all',
      priority = 'all',
      limit = 10
    } = req.query;

    const recommendations = await insightsService.getRecommendations(
      patientId as string,
      recommendationType as string,
      priority as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: recommendations,
      count: recommendations.length,
      parameters: {
        patientId,
        recommendationType,
        priority,
        limit: parseInt(limit as string)
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /patient-insights/population/health
 * @desc Get population health insights
 * @access Private (requires 'view_population_health' permission)
 */
router.get('/population/health',
  requirePermission('view_population_health'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      timeframe = '90d',
      includeComparisons = true,
      metrics = 'all'
    } = req.query;

    const populationHealth = await insightsService.getPopulationHealth(
      departmentId as string,
      timeframe as string,
      includeComparisons === 'true',
      metrics as string
    );

    res.json({
      success: true,
      data: populationHealth,
      parameters: {
        departmentId,
        timeframe,
        includeComparisons,
        metrics
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /patient-insights/quality/metrics
 * @desc Get quality of care metrics
 * @access Private (requires 'view_quality_metrics' permission)
 */
router.get('/quality/metrics',
  requirePermission('view_quality_metrics'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      timeframe = '90d',
      metricType = 'all',
      includeBenchmarks = true
    } = req.query;

    const qualityMetrics = await insightsService.getQualityMetrics(
      departmentId as string,
      timeframe as string,
      metricType as string,
      includeBenchmarks === 'true'
    );

    res.json({
      success: true,
      data: qualityMetrics,
      parameters: {
        departmentId,
        timeframe,
        metricType,
        includeBenchmarks
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /patient-insights/model/retrain
 * @desc Trigger model retraining
 * @access Private (requires 'manage_ai_models' permission)
 */
router.post('/model/retrain',
  requirePermission('manage_ai_models'),
  asyncHandler(async (req, res) => {
    const { modelType = 'all', useLatestData = true } = req.body;

    const retrainingResult = await insightsService.trainModels(
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
 * @route GET /patient-insights/model/performance
 * @desc Get model performance metrics
 * @access Private (requires 'view_ai_models' permission)
 */
router.get('/model/performance',
  requirePermission('view_ai_models'),
  asyncHandler(async (req, res) => {
    const performance = await insightsService.getModelPerformance();

    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;