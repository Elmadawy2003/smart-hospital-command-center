import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import AIModelsService from '../services/aiModelsService';

const router = express.Router();
const aiModelsService = new AIModelsService();

// Apply authentication to all routes
router.use(authenticateToken);

// Drug Demand Forecasting
router.post('/drug-demand/predict', requireRole(['admin', 'pharmacist', 'inventory_manager']), async (req, res) => {
  try {
    const { drugData, forecastDays } = req.body;
    
    if (!drugData || !drugData.drugId) {
      return res.status(400).json({
        success: false,
        message: 'Drug data with drugId is required'
      });
    }
    
    const forecast = await aiModelsService.predictDrugDemand(drugData, forecastDays);
    
    res.json({
      success: true,
      data: forecast,
      message: 'Drug demand forecast generated successfully'
    });
  } catch (error) {
    console.error('Error predicting drug demand:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict drug demand'
    });
  }
});

router.post('/drug-demand/batch-predict', requireRole(['admin', 'pharmacist', 'inventory_manager']), async (req, res) => {
  try {
    const { drugDataList, forecastDays } = req.body;
    
    if (!Array.isArray(drugDataList) || drugDataList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of drug data is required'
      });
    }
    
    const forecasts = await aiModelsService.generateBatchForecasts(drugDataList);
    
    res.json({
      success: true,
      data: forecasts,
      message: `Generated ${forecasts.length} drug demand forecasts`
    });
  } catch (error) {
    console.error('Error generating batch forecasts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate batch forecasts'
    });
  }
});

// Claim Rejection Prediction
router.post('/claim-rejection/predict', requireRole(['admin', 'billing_manager', 'insurance_specialist']), async (req, res) => {
  try {
    const { claimData } = req.body;
    
    if (!claimData || !claimData.claimId) {
      return res.status(400).json({
        success: false,
        message: 'Claim data with claimId is required'
      });
    }
    
    const prediction = await aiModelsService.predictClaimRejection(claimData);
    
    res.json({
      success: true,
      data: prediction,
      message: 'Claim rejection prediction generated successfully'
    });
  } catch (error) {
    console.error('Error predicting claim rejection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to predict claim rejection'
    });
  }
});

router.post('/claim-rejection/batch-predict', requireRole(['admin', 'billing_manager', 'insurance_specialist']), async (req, res) => {
  try {
    const { claimDataList } = req.body;
    
    if (!Array.isArray(claimDataList) || claimDataList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of claim data is required'
      });
    }
    
    const predictions = await aiModelsService.generateBatchClaimPredictions(claimDataList);
    
    res.json({
      success: true,
      data: predictions,
      message: `Generated ${predictions.length} claim rejection predictions`
    });
  } catch (error) {
    console.error('Error generating batch predictions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate batch predictions'
    });
  }
});

// Model Training
router.post('/models/:modelName/train', requireRole(['admin', 'data_scientist']), async (req, res) => {
  try {
    const { modelName } = req.params;
    const { trainingData } = req.body;
    
    if (!trainingData || !trainingData.features || !trainingData.labels) {
      return res.status(400).json({
        success: false,
        message: 'Training data with features and labels is required'
      });
    }
    
    let metrics;
    
    switch (modelName) {
      case 'drug-demand-forecast':
        metrics = await aiModelsService.trainDrugDemandModel(trainingData);
        break;
      case 'claim-rejection-prediction':
        metrics = await aiModelsService.trainClaimRejectionModel(trainingData);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid model name'
        });
    }
    
    res.json({
      success: true,
      data: metrics,
      message: 'Model trained successfully'
    });
  } catch (error) {
    console.error('Error training model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to train model'
    });
  }
});

// Model Metrics and Information
router.get('/models', async (req, res) => {
  try {
    const models = await aiModelsService.getAvailableModels();
    
    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    console.error('Error fetching available models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available models'
    });
  }
});

router.get('/models/metrics', async (req, res) => {
  try {
    const { modelName } = req.query;
    const metrics = await aiModelsService.getModelMetrics(modelName as string);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching model metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch model metrics'
    });
  }
});

router.get('/models/:modelName/metrics', async (req, res) => {
  try {
    const { modelName } = req.params;
    const metrics = await aiModelsService.getModelMetrics(modelName);
    
    if (metrics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Model not found'
      });
    }
    
    res.json({
      success: true,
      data: metrics[0]
    });
  } catch (error) {
    console.error('Error fetching model metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch model metrics'
    });
  }
});

// Drug Demand Analysis Endpoints
router.get('/drug-demand/analysis', requireRole(['admin', 'pharmacist', 'inventory_manager']), async (req, res) => {
  try {
    // Mock analysis data - in real implementation, this would come from database
    const analysisData = {
      topDrugs: [
        { drugId: 'drug-001', name: 'Paracetamol', currentDemand: 150, predictedDemand: 180, trend: 'increasing' },
        { drugId: 'drug-002', name: 'Amoxicillin', currentDemand: 120, predictedDemand: 110, trend: 'decreasing' },
        { drugId: 'drug-003', name: 'Ibuprofen', currentDemand: 200, predictedDemand: 220, trend: 'increasing' },
        { drugId: 'drug-004', name: 'Aspirin', currentDemand: 80, predictedDemand: 85, trend: 'stable' },
        { drugId: 'drug-005', name: 'Metformin', currentDemand: 300, predictedDemand: 310, trend: 'stable' }
      ],
      riskCategories: {
        high: 5,
        medium: 12,
        low: 83
      },
      seasonalTrends: {
        'flu-season': { impact: 'high', affectedDrugs: 15 },
        'allergy-season': { impact: 'medium', affectedDrugs: 8 },
        'chronic-medications': { impact: 'stable', affectedDrugs: 45 }
      },
      forecastAccuracy: {
        last30Days: 87.5,
        last90Days: 85.2,
        last365Days: 83.8
      }
    };
    
    res.json({
      success: true,
      data: analysisData
    });
  } catch (error) {
    console.error('Error fetching drug demand analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drug demand analysis'
    });
  }
});

// Claim Rejection Analysis Endpoints
router.get('/claim-rejection/analysis', requireRole(['admin', 'billing_manager', 'insurance_specialist']), async (req, res) => {
  try {
    // Mock analysis data - in real implementation, this would come from database
    const analysisData = {
      rejectionStats: {
        totalClaims: 1250,
        rejectedClaims: 125,
        rejectionRate: 10.0,
        averageClaimAmount: 2500,
        totalRejectedAmount: 312500
      },
      topRejectionReasons: [
        { reason: 'Insufficient documentation', count: 35, percentage: 28.0 },
        { reason: 'Pre-authorization required', count: 25, percentage: 20.0 },
        { reason: 'Service not covered', count: 20, percentage: 16.0 },
        { reason: 'Exceeds policy limits', count: 18, percentage: 14.4 },
        { reason: 'Provider not in network', count: 15, percentage: 12.0 }
      ],
      riskDistribution: {
        high: 15,
        medium: 35,
        low: 50
      },
      providerPerformance: [
        { providerId: 'prov-001', name: 'Dr. Smith', rejectionRate: 5.2, totalClaims: 150 },
        { providerId: 'prov-002', name: 'Dr. Johnson', rejectionRate: 8.7, totalClaims: 200 },
        { providerId: 'prov-003', name: 'Dr. Williams', rejectionRate: 12.5, totalClaims: 120 },
        { providerId: 'prov-004', name: 'Dr. Brown', rejectionRate: 15.8, totalClaims: 95 }
      ],
      predictionAccuracy: {
        last30Days: 92.3,
        last90Days: 91.8,
        last365Days: 90.5
      }
    };
    
    res.json({
      success: true,
      data: analysisData
    });
  } catch (error) {
    console.error('Error fetching claim rejection analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim rejection analysis'
    });
  }
});

// Model Performance Monitoring
router.get('/models/performance', requireRole(['admin', 'data_scientist']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Mock performance data - in real implementation, this would come from monitoring system
    const performanceData = {
      drugDemandModel: {
        accuracy: 87.5,
        precision: 84.2,
        recall: 89.1,
        f1Score: 86.6,
        predictionCount: 1250,
        averageResponseTime: 150, // milliseconds
        errorRate: 2.1
      },
      claimRejectionModel: {
        accuracy: 92.3,
        precision: 88.7,
        recall: 94.2,
        f1Score: 91.4,
        predictionCount: 850,
        averageResponseTime: 120, // milliseconds
        errorRate: 1.5
      },
      systemHealth: {
        cpuUsage: 45.2,
        memoryUsage: 67.8,
        diskUsage: 23.4,
        networkLatency: 25 // milliseconds
      }
    };
    
    res.json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    console.error('Error fetching model performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch model performance'
    });
  }
});

// Data Quality Assessment
router.post('/data-quality/assess', requireRole(['admin', 'data_scientist']), async (req, res) => {
  try {
    const { dataType, sampleData } = req.body;
    
    if (!dataType || !sampleData) {
      return res.status(400).json({
        success: false,
        message: 'Data type and sample data are required'
      });
    }
    
    // Mock data quality assessment
    const qualityAssessment = {
      dataType,
      sampleSize: Array.isArray(sampleData) ? sampleData.length : 1,
      qualityScore: 85.7,
      issues: [
        { type: 'missing_values', count: 5, severity: 'medium' },
        { type: 'outliers', count: 2, severity: 'low' },
        { type: 'inconsistent_format', count: 1, severity: 'high' }
      ],
      recommendations: [
        'Implement data validation rules for missing values',
        'Review outlier detection algorithms',
        'Standardize data format across all sources'
      ],
      completeness: 94.2,
      accuracy: 91.5,
      consistency: 88.9,
      timeliness: 96.1
    };
    
    res.json({
      success: true,
      data: qualityAssessment
    });
  } catch (error) {
    console.error('Error assessing data quality:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assess data quality'
    });
  }
});

// Model Comparison
router.get('/models/compare', requireRole(['admin', 'data_scientist']), async (req, res) => {
  try {
    const { models } = req.query;
    const modelList = typeof models === 'string' ? models.split(',') : [];
    
    if (modelList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one model name is required'
      });
    }
    
    const allMetrics = await aiModelsService.getModelMetrics();
    const comparisonData = allMetrics.filter(metric => 
      modelList.includes(metric.modelName.toLowerCase().replace(/\s+/g, '-'))
    );
    
    res.json({
      success: true,
      data: {
        models: comparisonData,
        comparison: {
          bestAccuracy: comparisonData.reduce((best, current) => 
            current.accuracy > best.accuracy ? current : best
          ),
          bestPrecision: comparisonData.reduce((best, current) => 
            current.precision > best.precision ? current : best
          ),
          bestRecall: comparisonData.reduce((best, current) => 
            current.recall > best.recall ? current : best
          )
        }
      }
    });
  } catch (error) {
    console.error('Error comparing models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare models'
    });
  }
});

// Health Check
router.get('/health', async (req, res) => {
  try {
    const models = await aiModelsService.getAvailableModels();
    const metrics = await aiModelsService.getModelMetrics();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        availableModels: models.length,
        totalMetrics: metrics.length,
        services: {
          drugDemandForecasting: 'operational',
          claimRejectionPrediction: 'operational',
          modelTraining: 'operational'
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in AI models health check:', error);
    res.status(500).json({
      success: false,
      message: 'AI models service health check failed'
    });
  }
});

export default router;