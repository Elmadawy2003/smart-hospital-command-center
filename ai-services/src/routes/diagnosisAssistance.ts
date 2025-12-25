import express from 'express';
import Joi from 'joi';
import { DiagnosisAssistanceService } from '../services/diagnosisAssistance';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, requirePermission, aiServiceRateLimit } from '../middleware/auth';
import { aiServiceLogger } from '../middleware/logging';

const router = express.Router();
const diagnosisService = new DiagnosisAssistanceService();

// Apply service-specific middleware
router.use(aiServiceLogger('DiagnosisAssistance'));
router.use(aiServiceRateLimit);

// Validation schemas
const diagnosisSuggestionSchema = Joi.object({
  patientId: Joi.string().required(),
  symptoms: Joi.array().items(Joi.string()).min(1).required(),
  vitalSigns: Joi.object({
    temperature: Joi.number().optional(),
    bloodPressure: Joi.object({
      systolic: Joi.number(),
      diastolic: Joi.number()
    }).optional(),
    heartRate: Joi.number().optional(),
    respiratoryRate: Joi.number().optional(),
    oxygenSaturation: Joi.number().optional()
  }).optional(),
  labResults: Joi.array().items(Joi.object({
    test: Joi.string().required(),
    value: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
    unit: Joi.string().optional(),
    referenceRange: Joi.string().optional()
  })).optional(),
  medicalHistory: Joi.array().items(Joi.string()).optional(),
  currentMedications: Joi.array().items(Joi.string()).optional()
});

const testRecommendationSchema = Joi.object({
  patientId: Joi.string().required(),
  symptoms: Joi.array().items(Joi.string()).min(1).required(),
  suspectedConditions: Joi.array().items(Joi.string()).optional(),
  urgencyLevel: Joi.string().valid('low', 'medium', 'high', 'critical').optional()
});

const differentialDiagnosisSchema = Joi.object({
  patientId: Joi.string().required(),
  chiefComplaint: Joi.string().required(),
  symptoms: Joi.array().items(Joi.string()).min(1).required(),
  duration: Joi.string().optional(),
  severity: Joi.string().valid('mild', 'moderate', 'severe').optional()
});

// Routes

/**
 * @route POST /diagnosis-assistance/suggest
 * @desc Get AI-powered diagnosis suggestions
 * @access Private (requires 'use_diagnosis_assistance' permission)
 */
router.post('/suggest',
  requirePermission('use_diagnosis_assistance'),
  validateRequest(diagnosisSuggestionSchema),
  asyncHandler(async (req, res) => {
    const diagnosisSuggestions = await diagnosisService.suggestDiagnosis(req.body);

    res.json({
      success: true,
      data: diagnosisSuggestions,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /diagnosis-assistance/tests/recommend
 * @desc Get recommended diagnostic tests
 * @access Private (requires 'use_diagnosis_assistance' permission)
 */
router.post('/tests/recommend',
  requirePermission('use_diagnosis_assistance'),
  validateRequest(testRecommendationSchema),
  asyncHandler(async (req, res) => {
    const testRecommendations = await diagnosisService.recommendTests(req.body);

    res.json({
      success: true,
      data: testRecommendations,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /diagnosis-assistance/urgency
 * @desc Determine urgency level for patient case
 * @access Private (requires 'use_diagnosis_assistance' permission)
 */
router.post('/urgency',
  requirePermission('use_diagnosis_assistance'),
  asyncHandler(async (req, res) => {
    const { patientId, symptoms, vitalSigns, medicalHistory } = req.body;

    const urgencyAssessment = await diagnosisService.determineUrgency({
      patientId,
      symptoms,
      vitalSigns,
      medicalHistory
    });

    res.json({
      success: true,
      data: urgencyAssessment,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /diagnosis-assistance/differential
 * @desc Generate differential diagnosis
 * @access Private (requires 'use_diagnosis_assistance' permission)
 */
router.post('/differential',
  requirePermission('use_diagnosis_assistance'),
  validateRequest(differentialDiagnosisSchema),
  asyncHandler(async (req, res) => {
    const differentialDiagnosis = await diagnosisService.generateDifferentialDiagnosis(req.body);

    res.json({
      success: true,
      data: differentialDiagnosis,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /diagnosis-assistance/symptoms/analyze/:symptom
 * @desc Analyze a specific symptom
 * @access Private (requires 'use_diagnosis_assistance' permission)
 */
router.get('/symptoms/analyze/:symptom',
  requirePermission('use_diagnosis_assistance'),
  asyncHandler(async (req, res) => {
    const { symptom } = req.params;
    const { patientAge, patientGender } = req.query;

    const symptomAnalysis = await diagnosisService.analyzeSymptom(
      symptom,
      {
        age: patientAge ? parseInt(patientAge as string) : undefined,
        gender: patientGender as string
      }
    );

    res.json({
      success: true,
      data: symptomAnalysis,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /diagnosis-assistance/conditions/:conditionId/info
 * @desc Get detailed information about a medical condition
 * @access Private (requires 'view_medical_info' permission)
 */
router.get('/conditions/:conditionId/info',
  requirePermission('view_medical_info'),
  asyncHandler(async (req, res) => {
    const { conditionId } = req.params;

    const conditionInfo = await diagnosisService.getConditionInfo(conditionId);

    res.json({
      success: true,
      data: conditionInfo,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /diagnosis-assistance/drug-interactions
 * @desc Check for drug interactions
 * @access Private (requires 'use_diagnosis_assistance' permission)
 */
router.post('/drug-interactions',
  requirePermission('use_diagnosis_assistance'),
  asyncHandler(async (req, res) => {
    const { medications, newMedication, patientConditions } = req.body;

    const interactionCheck = await diagnosisService.checkDrugInteractions({
      medications,
      newMedication,
      patientConditions
    });

    res.json({
      success: true,
      data: interactionCheck,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /diagnosis-assistance/statistics
 * @desc Get diagnosis assistance usage statistics
 * @access Private (requires 'view_ai_analytics' permission)
 */
router.get('/statistics',
  requirePermission('view_ai_analytics'),
  asyncHandler(async (req, res) => {
    const { timeframe = '30d', department } = req.query;

    const statistics = await diagnosisService.getUsageStatistics(
      timeframe as string,
      department as string
    );

    res.json({
      success: true,
      data: statistics,
      parameters: {
        timeframe,
        department
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /diagnosis-assistance/accuracy
 * @desc Get model accuracy metrics
 * @access Private (requires 'view_ai_models' permission)
 */
router.get('/accuracy',
  requirePermission('view_ai_models'),
  asyncHandler(async (req, res) => {
    const accuracyMetrics = await diagnosisService.getAccuracyMetrics();

    res.json({
      success: true,
      data: accuracyMetrics,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /diagnosis-assistance/feedback
 * @desc Submit feedback on diagnosis suggestions
 * @access Private (requires 'use_diagnosis_assistance' permission)
 */
router.post('/feedback',
  requirePermission('use_diagnosis_assistance'),
  asyncHandler(async (req, res) => {
    const { 
      suggestionId, 
      actualDiagnosis, 
      accuracy, 
      helpful, 
      comments 
    } = req.body;

    const feedbackResult = await diagnosisService.submitFeedback({
      suggestionId,
      actualDiagnosis,
      accuracy,
      helpful,
      comments
    });

    res.json({
      success: true,
      data: feedbackResult,
      message: 'Feedback submitted successfully',
      timestamp: new Date().toISOString()
    });
  })
);

export default router;