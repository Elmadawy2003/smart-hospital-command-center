import express from 'express';
import Joi from 'joi';
import { AppointmentOptimizationService } from '../services/appointmentOptimization';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest, requirePermission, aiServiceRateLimit } from '../middleware/auth';
import { aiServiceLogger } from '../middleware/logging';

const router = express.Router();
const appointmentService = new AppointmentOptimizationService();

// Apply service-specific middleware
router.use(aiServiceLogger('AppointmentOptimization'));
router.use(aiServiceRateLimit);

// Validation schemas
const scheduleOptimizationSchema = Joi.object({
  departmentId: Joi.string().optional(),
  providerId: Joi.string().optional(),
  appointmentType: Joi.string().optional(),
  timeframe: Joi.string().valid('1d', '7d', '30d', '90d').default('7d'),
  optimizationGoals: Joi.array().items(
    Joi.string().valid('minimize_wait_time', 'maximize_utilization', 'balance_workload', 'patient_preference')
  ).default(['minimize_wait_time', 'maximize_utilization']),
  constraints: Joi.object({
    maxWaitTime: Joi.number().min(0).max(480).optional(), // minutes
    minUtilization: Joi.number().min(0).max(1).optional(),
    maxOverbooking: Joi.number().min(0).max(0.5).optional()
  }).optional()
});

const demandPredictionSchema = Joi.object({
  departmentId: Joi.string().optional(),
  appointmentType: Joi.string().optional(),
  forecastDays: Joi.number().min(1).max(90).default(30),
  granularity: Joi.string().valid('hourly', 'daily', 'weekly').default('daily'),
  includeSeasonality: Joi.boolean().default(true),
  includeExternalFactors: Joi.boolean().default(true)
});

const appointmentRequestSchema = Joi.object({
  patientId: Joi.string().required(),
  appointmentType: Joi.string().required(),
  departmentId: Joi.string().optional(),
  providerId: Joi.string().optional(),
  preferredDates: Joi.array().items(Joi.date()).optional(),
  preferredTimes: Joi.array().items(Joi.string()).optional(),
  urgency: Joi.string().valid('routine', 'urgent', 'emergency').default('routine'),
  duration: Joi.number().min(15).max(480).optional(), // minutes
  specialRequirements: Joi.array().items(Joi.string()).optional()
});

const rescheduleAnalysisSchema = Joi.object({
  timeframe: Joi.string().valid('1d', '7d', '30d').default('7d'),
  departmentId: Joi.string().optional(),
  includeReasons: Joi.boolean().default(true),
  includePatterns: Joi.boolean().default(true),
  includeRecommendations: Joi.boolean().default(true)
});

// Routes

/**
 * @route POST /appointment-optimization/schedule/optimize
 * @desc Optimize appointment scheduling
 * @access Private (requires 'manage_appointments' permission)
 */
router.post('/schedule/optimize',
  requirePermission('manage_appointments'),
  validateRequest(scheduleOptimizationSchema),
  asyncHandler(async (req, res) => {
    const { 
      departmentId, 
      providerId, 
      appointmentType, 
      timeframe, 
      optimizationGoals, 
      constraints 
    } = req.body;

    const optimization = await appointmentService.optimizeSchedule(
      departmentId,
      providerId,
      appointmentType,
      timeframe,
      optimizationGoals,
      constraints
    );

    res.json({
      success: true,
      data: optimization,
      parameters: {
        departmentId,
        providerId,
        appointmentType,
        timeframe,
        optimizationGoals,
        constraints
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /appointment-optimization/provider/:providerId/schedule
 * @desc Get optimized schedule for specific provider
 * @access Private (requires 'view_provider_schedule' permission)
 */
router.get('/provider/:providerId/schedule',
  requirePermission('view_provider_schedule'),
  asyncHandler(async (req, res) => {
    const { providerId } = req.params;
    const { 
      timeframe = '7d',
      includeOptimizations = true,
      includeMetrics = true
    } = req.query;

    const schedule = await appointmentService.getProviderScheduleOptimization(
      providerId,
      timeframe as string,
      includeOptimizations === 'true',
      includeMetrics === 'true'
    );

    res.json({
      success: true,
      data: schedule,
      provider: providerId,
      parameters: {
        timeframe,
        includeOptimizations,
        includeMetrics
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /appointment-optimization/demand/predict
 * @desc Predict appointment demand
 * @access Private (requires 'view_analytics' permission)
 */
router.post('/demand/predict',
  requirePermission('view_analytics'),
  validateRequest(demandPredictionSchema),
  asyncHandler(async (req, res) => {
    const { 
      departmentId, 
      appointmentType, 
      forecastDays, 
      granularity, 
      includeSeasonality, 
      includeExternalFactors 
    } = req.body;

    const demandPrediction = await appointmentService.predictDemand(
      departmentId,
      appointmentType,
      forecastDays,
      granularity,
      includeSeasonality,
      includeExternalFactors
    );

    res.json({
      success: true,
      data: demandPrediction,
      parameters: {
        departmentId,
        appointmentType,
        forecastDays,
        granularity,
        includeSeasonality,
        includeExternalFactors
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /appointment-optimization/suggest
 * @desc Get appointment suggestions for patient request
 * @access Private (requires 'schedule_appointments' permission)
 */
router.post('/suggest',
  requirePermission('schedule_appointments'),
  validateRequest(appointmentRequestSchema),
  asyncHandler(async (req, res) => {
    const appointmentRequest = req.body;

    const suggestions = await appointmentService.suggestAppointments(appointmentRequest);

    res.json({
      success: true,
      data: suggestions,
      count: suggestions.length,
      request: appointmentRequest,
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /appointment-optimization/availability
 * @desc Get real-time availability with optimization
 * @access Private (requires 'view_availability' permission)
 */
router.get('/availability',
  requirePermission('view_availability'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      providerId,
      appointmentType,
      date,
      duration = 30
    } = req.query;

    const availability = await appointmentService.getOptimizedAvailability(
      departmentId as string,
      providerId as string,
      appointmentType as string,
      date as string,
      parseInt(duration as string)
    );

    res.json({
      success: true,
      data: availability,
      parameters: {
        departmentId,
        providerId,
        appointmentType,
        date,
        duration: parseInt(duration as string)
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /appointment-optimization/wait-times
 * @desc Get wait time predictions and analysis
 * @access Private (requires 'view_analytics' permission)
 */
router.get('/wait-times',
  requirePermission('view_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      appointmentType,
      timeframe = '7d',
      includeRealTime = true
    } = req.query;

    const waitTimes = await appointmentService.analyzeWaitTimes(
      departmentId as string,
      appointmentType as string,
      timeframe as string,
      includeRealTime === 'true'
    );

    res.json({
      success: true,
      data: waitTimes,
      parameters: {
        departmentId,
        appointmentType,
        timeframe,
        includeRealTime
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /appointment-optimization/utilization
 * @desc Get provider and resource utilization analysis
 * @access Private (requires 'view_utilization' permission)
 */
router.get('/utilization',
  requirePermission('view_utilization'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      providerId,
      timeframe = '30d',
      includeOptimizations = true
    } = req.query;

    const utilization = await appointmentService.analyzeUtilization(
      departmentId as string,
      providerId as string,
      timeframe as string,
      includeOptimizations === 'true'
    );

    res.json({
      success: true,
      data: utilization,
      parameters: {
        departmentId,
        providerId,
        timeframe,
        includeOptimizations
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /appointment-optimization/reschedule/analyze
 * @desc Analyze rescheduling patterns and optimize
 * @access Private (requires 'view_analytics' permission)
 */
router.post('/reschedule/analyze',
  requirePermission('view_analytics'),
  validateRequest(rescheduleAnalysisSchema),
  asyncHandler(async (req, res) => {
    const { timeframe, departmentId, includeReasons, includePatterns, includeRecommendations } = req.body;

    const rescheduleAnalysis = await appointmentService.analyzeRescheduling(
      timeframe,
      departmentId,
      includeReasons,
      includePatterns,
      includeRecommendations
    );

    res.json({
      success: true,
      data: rescheduleAnalysis,
      parameters: {
        timeframe,
        departmentId,
        includeReasons,
        includePatterns,
        includeRecommendations
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /appointment-optimization/no-shows/predict
 * @desc Predict no-show probability for appointments
 * @access Private (requires 'view_analytics' permission)
 */
router.get('/no-shows/predict',
  requirePermission('view_analytics'),
  asyncHandler(async (req, res) => {
    const { 
      appointmentIds,
      departmentId,
      timeframe = '7d',
      includeFactors = true
    } = req.query;

    const noShowPredictions = await appointmentService.predictNoShows(
      appointmentIds ? (appointmentIds as string).split(',') : undefined,
      departmentId as string,
      timeframe as string,
      includeFactors === 'true'
    );

    res.json({
      success: true,
      data: noShowPredictions,
      count: noShowPredictions.length,
      parameters: {
        appointmentIds,
        departmentId,
        timeframe,
        includeFactors
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /appointment-optimization/capacity/planning
 * @desc Get capacity planning recommendations
 * @access Private (requires 'manage_capacity' permission)
 */
router.get('/capacity/planning',
  requirePermission('manage_capacity'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      planningHorizon = '90d',
      includeStaffing = true,
      includeResources = true
    } = req.query;

    const capacityPlanning = await appointmentService.planCapacity(
      departmentId as string,
      planningHorizon as string,
      includeStaffing === 'true',
      includeResources === 'true'
    );

    res.json({
      success: true,
      data: capacityPlanning,
      parameters: {
        departmentId,
        planningHorizon,
        includeStaffing,
        includeResources
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route GET /appointment-optimization/patient/satisfaction
 * @desc Analyze patient satisfaction related to appointments
 * @access Private (requires 'view_patient_satisfaction' permission)
 */
router.get('/patient/satisfaction',
  requirePermission('view_patient_satisfaction'),
  asyncHandler(async (req, res) => {
    const { 
      departmentId,
      timeframe = '90d',
      includeFactors = true,
      includeRecommendations = true
    } = req.query;

    const satisfactionAnalysis = await appointmentService.analyzePatientSatisfaction(
      departmentId as string,
      timeframe as string,
      includeFactors === 'true',
      includeRecommendations === 'true'
    );

    res.json({
      success: true,
      data: satisfactionAnalysis,
      parameters: {
        departmentId,
        timeframe,
        includeFactors,
        includeRecommendations
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /appointment-optimization/bulk/reschedule
 * @desc Optimize bulk rescheduling scenarios
 * @access Private (requires 'manage_appointments' permission)
 */
router.post('/bulk/reschedule',
  requirePermission('manage_appointments'),
  asyncHandler(async (req, res) => {
    const { 
      appointmentIds,
      reason,
      constraints,
      optimizationGoals = ['minimize_disruption', 'patient_preference']
    } = req.body;

    const bulkReschedule = await appointmentService.optimizeBulkReschedule(
      appointmentIds,
      reason,
      constraints,
      optimizationGoals
    );

    res.json({
      success: true,
      data: bulkReschedule,
      affectedAppointments: appointmentIds.length,
      parameters: {
        reason,
        constraints,
        optimizationGoals
      },
      timestamp: new Date().toISOString()
    });
  })
);

/**
 * @route POST /appointment-optimization/model/retrain
 * @desc Trigger model retraining
 * @access Private (requires 'manage_ai_models' permission)
 */
router.post('/model/retrain',
  requirePermission('manage_ai_models'),
  asyncHandler(async (req, res) => {
    const { modelType = 'all', useLatestData = true } = req.body;

    const retrainingResult = await appointmentService.trainModels(
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
 * @route GET /appointment-optimization/model/performance
 * @desc Get model performance metrics
 * @access Private (requires 'view_ai_models' permission)
 */
router.get('/model/performance',
  requirePermission('view_ai_models'),
  asyncHandler(async (req, res) => {
    const performance = await appointmentService.getModelPerformance();

    res.json({
      success: true,
      data: performance,
      timestamp: new Date().toISOString()
    });
  })
);

export default router;