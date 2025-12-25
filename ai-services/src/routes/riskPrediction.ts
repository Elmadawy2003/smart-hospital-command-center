import express from 'express';
import Joi from 'joi';
import { RiskPredictionService } from '../services/riskPrediction';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, requirePermission, aiServiceRateLimit } from '../middleware/auth';
import { aiServiceLogger } from '../middleware/logging';

const router = express.Router();
const riskPredictionService = new RiskPredictionService();

// Apply service-specific middleware
router.use(aiServiceLogger('RiskPrediction'));
router.use(aiServiceRateLimit);

// Validation schemas
const patientRiskSchema = Joi.object({
  patientId: Joi.string().required(),
  includeHistory: Joi.boolean().default(true),
  riskTypes: Joi.array().items(
    Joi.string().valid('readmission', 'mortality', 'deterioration')
  ).default(['readmission', 'mortality', 'deterioration'])
});

const bulkRiskSchema = Joi.object({
  patientIds: Joi.array().items(Joi.string()).min(1).max(100).required(),
  riskTypes: Joi.array().items(
    Joi.string().valid('readmission', 'mortality', 'deterioration')
  ).default(['readmission', 'mortality', 'deterioration'])
});

const departmentRiskSchema = Joi.object({
  departmentId: Joi.string().required(),
  timeframe: Joi.string().valid('24h', '7d', '30d').default('24h'),
  riskThreshold: Joi.number().min(0).max(1).default(0.7)
});

// Routes

/**
 * @route GET /risk-prediction/patient/:patientId
 * @desc Get comprehensive risk assessment for a specific patient
 * @access Private (requires 'view_patient_risk' permission)
 */
router.get('/patient/:patientId', 
  requirePermission('view_patient_risk'),
  asyncHandler(async (req, res) => {
    const { patientId } = req.params;
    const { includeHistory = true, riskTypes = ['readmission', 'mortality', 'deterioration'] } = req.query;

    const riskAssessment = await riskPredictionService.assessPatientRisk(
      patientId,
      includeHistory as boolean,
      riskTypes as string[]
    );

    res.json({
      success: true,
      data: riskAssessment,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /risk-prediction/patient
 * @desc Get risk assessment for a patient with custom parameters
 * @access Private (requires 'view_patient_risk' permission)
 */
router.post('/patient',
  requirePermission('view_patient_risk'),
  validateRequest(patientRiskSchema),
  asyncHandler(async (req, res) => {
    const { patientId, includeHistory, riskTypes } = req.body;

    const riskAssessment = await riskPredictionService.assessPatientRisk(
      patientId,
      includeHistory,
      riskTypes
    );

    res.json({
      success: true,
      data: riskAssessment,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /risk-prediction/bulk
 * @desc Get risk assessments for multiple patients
 * @access Private (requires 'view_patient_risk' permission)
 */
router.post('/bulk',
  requirePermission('view_patient_risk'),
  validateRequest(bulkRiskSchema),
  asyncHandler(async (req, res) => {
    const { patientIds, riskTypes } = req.body;

    const riskAssessments = await Promise.all(
      patientIds.map((patientId: string) =>
        riskPredictionService.assessPatientRisk(patientId, true, riskTypes)
      )
    );

    res.json({
      success: true,
      data: riskAssessments,
      count: riskAssessments.length,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /risk-prediction/department/:departmentId/high-risk
 * @desc Get high-risk patients in a specific department
 * @access Private (requires 'view_department_risk' permission)
 */
router.get('/department/:departmentId/high-risk',
  requirePermission('view_department_risk'),
  asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { timeframe = '24h', riskThreshold = 0.7 } = req.query;

    // This would be implemented in the service
    const highRiskPatients = await riskPredictionService.getHighRiskPatients(
      departmentId,
      timeframe as string,
      parseFloat(riskThreshold as string)
    );

    res.json({
      success: true,
      data: highRiskPatients,
      count: highRiskPatients.length,
      parameters: {
        departmentId,
        timeframe,
        riskThreshold: parseFloat(riskThreshold as string)
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /risk-prediction/department/analysis
 * @desc Get comprehensive risk analysis for a department
 * @access Private (requires 'view_department_risk' permission)
 */
router.post('/department/analysis',
  requirePermission('view_department_risk'),
  validateRequest(departmentRiskSchema),
  asyncHandler(async (req, res) => {
    const { departmentId, timeframe, riskThreshold } = req.body;

    const departmentAnalysis = await riskPredictionService.analyzeDepartmentRisk(
      departmentId,
      timeframe,
      riskThreshold
    );

    res.json({
      success: true,
      data: departmentAnalysis,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /risk-prediction/trends
 * @desc Get hospital-wide risk trends
 * @access Private (requires 'view_hospital_analytics' permission)
 */
router.get('/trends',
  requirePermission('view_hospital_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      timeframe = '30d',
      granularity = 'daily',
      riskType = 'all'
    } = req.query;

    const trends = await riskPredictionService.getRiskTrends(
      timeframe as string,
      granularity as string,
      riskType as string
    );

    res.json({
      success: true,
      data: trends,
      parameters: {
        timeframe,
        granularity,
        riskType
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /risk-prediction/alerts
 * @desc Get active risk alerts
 * @access Private (requires 'view_risk_alerts' permission)
 */
router.get('/alerts',
  requirePermission('view_risk_alerts'),
  asyncHandler(async (req, res) => {
    const { 
      severity = 'all',
      department,
      limit = 50
    } = req.query;

    const alerts = await riskPredictionService.getActiveAlerts(
      severity as string,
      department as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      parameters: {
        severity,
        department,
        limit: parseInt(limit as string)
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /risk-prediction/model/retrain
 * @desc Trigger model retraining
 * @access Private (requires 'manage_ai_models' permission)
 */
router.post('/model/retrain',
  requirePermission('manage_ai_models'),
  asyncHandler(async (req, res) => {
    const { modelType = 'all', useLatestData = true } = req.body;

    const retrainingResult = await riskPredictionService.retrainModels(
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
 * @route GET /risk-prediction/model/performance
 * @desc Get model performance metrics
 * @access Private (requires 'view_ai_models' permission)
 */
router.get('/model/performance',
  requirePermission('view_ai_models'),
  asyncHandler(async (req, res) => {
    const performance = await riskPredictionService.getModelPerformance();

    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;