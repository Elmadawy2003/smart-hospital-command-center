import { v4 as uuidv4 } from 'uuid';

// Interfaces for AI Models
interface DrugDemandData {
  drugId: string;
  drugName: string;
  historicalUsage: number[];
  seasonalFactors: number[];
  patientDemographics: {
    ageGroups: { [key: string]: number };
    conditions: { [key: string]: number };
  };
  externalFactors: {
    epidemicOutbreaks: boolean;
    seasonalIllness: boolean;
    stockShortages: boolean;
  };
  currentStock: number;
  leadTime: number;
  cost: number;
}

interface DrugDemandForecast {
  drugId: string;
  drugName: string;
  forecastPeriod: string;
  predictedDemand: number;
  confidence: number;
  recommendedOrderQuantity: number;
  reorderPoint: number;
  factors: {
    historical: number;
    seasonal: number;
    demographic: number;
    external: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  generatedAt: Date;
}

interface ClaimData {
  claimId: string;
  patientId: string;
  providerId: string;
  insuranceId: string;
  claimAmount: number;
  serviceType: string;
  diagnosis: string[];
  procedures: string[];
  dateOfService: Date;
  submissionDate: Date;
  patientHistory: {
    previousClaims: number;
    averageClaimAmount: number;
    chronicConditions: string[];
  };
  providerHistory: {
    rejectionRate: number;
    averageClaimAmount: number;
    specialties: string[];
  };
  insurancePolicy: {
    coverageType: string;
    deductible: number;
    copayAmount: number;
    maxCoverage: number;
  };
}

interface ClaimRejectionPrediction {
  claimId: string;
  rejectionProbability: number;
  confidence: number;
  riskFactors: {
    factor: string;
    weight: number;
    description: string;
  }[];
  recommendations: string[];
  suggestedActions: {
    action: string;
    priority: 'high' | 'medium' | 'low';
    description: string;
  }[];
  predictedRejectionReasons: string[];
  generatedAt: Date;
}

interface AIModelMetrics {
  modelName: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  lastTrainingDate: Date;
  trainingDataSize: number;
  version: string;
}

interface ModelTrainingData {
  features: number[][];
  labels: number[];
  metadata: {
    featureNames: string[];
    dataSource: string;
    collectionPeriod: {
      start: Date;
      end: Date;
    };
  };
}

class AIModelsService {
  private drugDemandModel: any;
  private claimRejectionModel: any;
  private modelMetrics: Map<string, AIModelMetrics>;

  constructor() {
    this.modelMetrics = new Map();
    this.initializeModels();
  }

  private initializeModels(): void {
    // Initialize drug demand forecasting model
    this.drugDemandModel = {
      weights: {
        historical: 0.4,
        seasonal: 0.25,
        demographic: 0.2,
        external: 0.15
      },
      seasonalPatterns: {
        'flu-season': [1.5, 1.8, 1.2, 0.8, 0.6, 0.5, 0.5, 0.6, 0.8, 1.2, 1.5, 1.8],
        'allergy-season': [0.8, 0.9, 1.5, 1.8, 1.6, 1.2, 1.0, 0.9, 1.1, 1.3, 1.0, 0.8],
        'chronic-medications': [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
      }
    };

    // Initialize claim rejection prediction model
    this.claimRejectionModel = {
      riskFactors: {
        highClaimAmount: { threshold: 10000, weight: 0.3 },
        frequentClaims: { threshold: 5, weight: 0.2 },
        providerRejectionRate: { threshold: 0.15, weight: 0.25 },
        unusualProcedures: { weight: 0.15 },
        policyLimits: { weight: 0.1 }
      },
      rejectionReasons: [
        'Exceeds policy limits',
        'Pre-authorization required',
        'Service not covered',
        'Duplicate claim',
        'Insufficient documentation',
        'Provider not in network',
        'Experimental treatment',
        'Cosmetic procedure'
      ]
    };

    // Initialize model metrics
    this.modelMetrics.set('drug-demand-forecast', {
      modelName: 'Drug Demand Forecasting',
      accuracy: 0.87,
      precision: 0.84,
      recall: 0.89,
      f1Score: 0.86,
      lastTrainingDate: new Date(),
      trainingDataSize: 50000,
      version: '1.2.0'
    });

    this.modelMetrics.set('claim-rejection-prediction', {
      modelName: 'Claim Rejection Prediction',
      accuracy: 0.92,
      precision: 0.88,
      recall: 0.94,
      f1Score: 0.91,
      lastTrainingDate: new Date(),
      trainingDataSize: 75000,
      version: '1.1.0'
    });
  }

  // Drug Demand Forecasting
  async predictDrugDemand(drugData: DrugDemandData, forecastDays: number = 30): Promise<DrugDemandForecast> {
    try {
      // Calculate historical trend
      const historicalAverage = drugData.historicalUsage.reduce((sum, usage) => sum + usage, 0) / drugData.historicalUsage.length;
      const trend = this.calculateTrend(drugData.historicalUsage);
      
      // Apply seasonal factors
      const currentMonth = new Date().getMonth();
      const seasonalFactor = drugData.seasonalFactors[currentMonth] || 1.0;
      
      // Calculate demographic impact
      const demographicFactor = this.calculateDemographicImpact(drugData.patientDemographics);
      
      // Apply external factors
      const externalFactor = this.calculateExternalFactors(drugData.externalFactors);
      
      // Combine all factors using model weights
      const weights = this.drugDemandModel.weights;
      const predictedDemand = Math.round(
        historicalAverage * 
        (1 + trend * weights.historical) *
        (seasonalFactor * weights.seasonal) *
        (demographicFactor * weights.demographic) *
        (externalFactor * weights.external) *
        (forecastDays / 30)
      );

      // Calculate confidence based on data quality
      const confidence = this.calculateForecastConfidence(drugData);
      
      // Determine risk level
      const riskLevel = this.assessStockRisk(drugData.currentStock, predictedDemand, drugData.leadTime);
      
      // Generate recommendations
      const recommendations = this.generateDemandRecommendations(drugData, predictedDemand, riskLevel);
      
      // Calculate reorder point
      const reorderPoint = Math.round(predictedDemand * (drugData.leadTime / 30) * 1.2); // 20% safety stock
      
      return {
        drugId: drugData.drugId,
        drugName: drugData.drugName,
        forecastPeriod: `${forecastDays} days`,
        predictedDemand,
        confidence,
        recommendedOrderQuantity: Math.max(predictedDemand - drugData.currentStock, 0),
        reorderPoint,
        factors: {
          historical: trend,
          seasonal: seasonalFactor,
          demographic: demographicFactor,
          external: externalFactor
        },
        riskLevel,
        recommendations,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error predicting drug demand:', error);
      throw new Error('Failed to predict drug demand');
    }
  }

  // Claim Rejection Prediction
  async predictClaimRejection(claimData: ClaimData): Promise<ClaimRejectionPrediction> {
    try {
      const riskFactors: { factor: string; weight: number; description: string }[] = [];
      let totalRisk = 0;

      // Analyze claim amount
      if (claimData.claimAmount > this.claimRejectionModel.riskFactors.highClaimAmount.threshold) {
        const factor = {
          factor: 'High Claim Amount',
          weight: this.claimRejectionModel.riskFactors.highClaimAmount.weight,
          description: `Claim amount $${claimData.claimAmount} exceeds typical threshold`
        };
        riskFactors.push(factor);
        totalRisk += factor.weight;
      }

      // Analyze patient history
      if (claimData.patientHistory.previousClaims > this.claimRejectionModel.riskFactors.frequentClaims.threshold) {
        const factor = {
          factor: 'Frequent Claims',
          weight: this.claimRejectionModel.riskFactors.frequentClaims.weight,
          description: `Patient has ${claimData.patientHistory.previousClaims} previous claims`
        };
        riskFactors.push(factor);
        totalRisk += factor.weight;
      }

      // Analyze provider history
      if (claimData.providerHistory.rejectionRate > this.claimRejectionModel.riskFactors.providerRejectionRate.threshold) {
        const factor = {
          factor: 'Provider Rejection Rate',
          weight: this.claimRejectionModel.riskFactors.providerRejectionRate.weight,
          description: `Provider has ${(claimData.providerHistory.rejectionRate * 100).toFixed(1)}% rejection rate`
        };
        riskFactors.push(factor);
        totalRisk += factor.weight;
      }

      // Check policy limits
      if (claimData.claimAmount > claimData.insurancePolicy.maxCoverage) {
        const factor = {
          factor: 'Exceeds Policy Limits',
          weight: this.claimRejectionModel.riskFactors.policyLimits.weight,
          description: 'Claim amount exceeds maximum coverage'
        };
        riskFactors.push(factor);
        totalRisk += factor.weight;
      }

      // Calculate rejection probability
      const rejectionProbability = Math.min(totalRisk, 0.95);
      const confidence = this.calculatePredictionConfidence(riskFactors.length, claimData);

      // Generate recommendations
      const recommendations = this.generateClaimRecommendations(riskFactors, claimData);
      
      // Generate suggested actions
      const suggestedActions = this.generateSuggestedActions(riskFactors, rejectionProbability);
      
      // Predict specific rejection reasons
      const predictedRejectionReasons = this.predictRejectionReasons(riskFactors, claimData);

      return {
        claimId: claimData.claimId,
        rejectionProbability,
        confidence,
        riskFactors,
        recommendations,
        suggestedActions,
        predictedRejectionReasons,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error predicting claim rejection:', error);
      throw new Error('Failed to predict claim rejection');
    }
  }

  // Model Training and Management
  async trainDrugDemandModel(trainingData: ModelTrainingData): Promise<AIModelMetrics> {
    try {
      // Simulate model training process
      const startTime = Date.now();
      
      // Validate training data
      if (trainingData.features.length !== trainingData.labels.length) {
        throw new Error('Features and labels length mismatch');
      }

      // Simulate training process with progress
      await this.simulateTraining(5000); // 5 second training simulation

      // Calculate new metrics
      const newMetrics: AIModelMetrics = {
        modelName: 'Drug Demand Forecasting',
        accuracy: 0.87 + Math.random() * 0.05, // Simulate improvement
        precision: 0.84 + Math.random() * 0.05,
        recall: 0.89 + Math.random() * 0.05,
        f1Score: 0.86 + Math.random() * 0.05,
        lastTrainingDate: new Date(),
        trainingDataSize: trainingData.features.length,
        version: this.incrementVersion(this.modelMetrics.get('drug-demand-forecast')?.version || '1.0.0')
      };

      // Update model metrics
      this.modelMetrics.set('drug-demand-forecast', newMetrics);

      return newMetrics;
    } catch (error) {
      console.error('Error training drug demand model:', error);
      throw new Error('Failed to train drug demand model');
    }
  }

  async trainClaimRejectionModel(trainingData: ModelTrainingData): Promise<AIModelMetrics> {
    try {
      // Simulate model training process
      const startTime = Date.now();
      
      // Validate training data
      if (trainingData.features.length !== trainingData.labels.length) {
        throw new Error('Features and labels length mismatch');
      }

      // Simulate training process
      await this.simulateTraining(7000); // 7 second training simulation

      // Calculate new metrics
      const newMetrics: AIModelMetrics = {
        modelName: 'Claim Rejection Prediction',
        accuracy: 0.92 + Math.random() * 0.03,
        precision: 0.88 + Math.random() * 0.04,
        recall: 0.94 + Math.random() * 0.03,
        f1Score: 0.91 + Math.random() * 0.03,
        lastTrainingDate: new Date(),
        trainingDataSize: trainingData.features.length,
        version: this.incrementVersion(this.modelMetrics.get('claim-rejection-prediction')?.version || '1.0.0')
      };

      // Update model metrics
      this.modelMetrics.set('claim-rejection-prediction', newMetrics);

      return newMetrics;
    } catch (error) {
      console.error('Error training claim rejection model:', error);
      throw new Error('Failed to train claim rejection model');
    }
  }

  // Utility Methods
  private calculateTrend(historicalData: number[]): number {
    if (historicalData.length < 2) return 0;
    
    const n = historicalData.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = historicalData.reduce((sum, val) => sum + val, 0);
    const sumXY = historicalData.reduce((sum, val, index) => sum + (index * val), 0);
    const sumX2 = historicalData.reduce((sum, _, index) => sum + (index * index), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope / (sumY / n); // Normalize by average
  }

  private calculateDemographicImpact(demographics: DrugDemandData['patientDemographics']): number {
    // Simplified demographic impact calculation
    const ageFactors = {
      '0-18': 1.2,
      '19-35': 1.0,
      '36-55': 1.1,
      '56-75': 1.3,
      '75+': 1.5
    };

    let weightedFactor = 0;
    let totalPatients = 0;

    Object.entries(demographics.ageGroups).forEach(([ageGroup, count]) => {
      const factor = ageFactors[ageGroup as keyof typeof ageFactors] || 1.0;
      weightedFactor += factor * count;
      totalPatients += count;
    });

    return totalPatients > 0 ? weightedFactor / totalPatients : 1.0;
  }

  private calculateExternalFactors(factors: DrugDemandData['externalFactors']): number {
    let multiplier = 1.0;
    
    if (factors.epidemicOutbreaks) multiplier *= 1.5;
    if (factors.seasonalIllness) multiplier *= 1.3;
    if (factors.stockShortages) multiplier *= 1.2;
    
    return multiplier;
  }

  private calculateForecastConfidence(drugData: DrugDemandData): number {
    let confidence = 0.5; // Base confidence
    
    // More historical data increases confidence
    if (drugData.historicalUsage.length >= 12) confidence += 0.2;
    if (drugData.historicalUsage.length >= 24) confidence += 0.1;
    
    // Consistent usage patterns increase confidence
    const variance = this.calculateVariance(drugData.historicalUsage);
    const mean = drugData.historicalUsage.reduce((sum, val) => sum + val, 0) / drugData.historicalUsage.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;
    
    if (coefficientOfVariation < 0.3) confidence += 0.2;
    else if (coefficientOfVariation < 0.5) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }

  private calculateVariance(data: number[]): number {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length;
  }

  private assessStockRisk(currentStock: number, predictedDemand: number, leadTime: number): 'low' | 'medium' | 'high' {
    const daysOfStock = (currentStock / predictedDemand) * 30;
    
    if (daysOfStock < leadTime) return 'high';
    if (daysOfStock < leadTime * 1.5) return 'medium';
    return 'low';
  }

  private generateDemandRecommendations(drugData: DrugDemandData, predictedDemand: number, riskLevel: string): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'high') {
      recommendations.push('Immediate reorder required - stock critically low');
      recommendations.push('Consider expedited shipping to avoid stockout');
    } else if (riskLevel === 'medium') {
      recommendations.push('Schedule reorder within next week');
      recommendations.push('Monitor usage closely');
    }
    
    if (predictedDemand > drugData.currentStock * 2) {
      recommendations.push('Consider bulk ordering for cost savings');
    }
    
    if (drugData.externalFactors.epidemicOutbreaks) {
      recommendations.push('Increase safety stock due to epidemic conditions');
    }
    
    return recommendations;
  }

  private calculatePredictionConfidence(riskFactorCount: number, claimData: ClaimData): number {
    let confidence = 0.6; // Base confidence
    
    // More risk factors increase confidence in prediction
    confidence += riskFactorCount * 0.1;
    
    // Historical data availability increases confidence
    if (claimData.patientHistory.previousClaims > 0) confidence += 0.1;
    if (claimData.providerHistory.rejectionRate > 0) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }

  private generateClaimRecommendations(riskFactors: any[], claimData: ClaimData): string[] {
    const recommendations: string[] = [];
    
    riskFactors.forEach(factor => {
      switch (factor.factor) {
        case 'High Claim Amount':
          recommendations.push('Provide detailed documentation for high-value claim');
          recommendations.push('Consider pre-authorization if required');
          break;
        case 'Frequent Claims':
          recommendations.push('Review patient medical history for consistency');
          recommendations.push('Ensure all claims are medically necessary');
          break;
        case 'Provider Rejection Rate':
          recommendations.push('Review provider documentation standards');
          recommendations.push('Verify all required fields are completed');
          break;
        case 'Exceeds Policy Limits':
          recommendations.push('Check if patient has supplemental coverage');
          recommendations.push('Consider splitting claim if appropriate');
          break;
      }
    });
    
    return recommendations;
  }

  private generateSuggestedActions(riskFactors: any[], rejectionProbability: number): any[] {
    const actions: any[] = [];
    
    if (rejectionProbability > 0.7) {
      actions.push({
        action: 'Hold claim for review',
        priority: 'high' as const,
        description: 'High rejection probability - manual review recommended'
      });
    }
    
    if (rejectionProbability > 0.5) {
      actions.push({
        action: 'Verify documentation',
        priority: 'medium' as const,
        description: 'Ensure all required documentation is complete'
      });
    }
    
    actions.push({
      action: 'Monitor claim status',
      priority: 'low' as const,
      description: 'Track claim through processing pipeline'
    });
    
    return actions;
  }

  private predictRejectionReasons(riskFactors: any[], claimData: ClaimData): string[] {
    const reasons: string[] = [];
    
    riskFactors.forEach(factor => {
      switch (factor.factor) {
        case 'High Claim Amount':
          reasons.push('Exceeds usual and customary charges');
          break;
        case 'Frequent Claims':
          reasons.push('Duplicate or unnecessary services');
          break;
        case 'Provider Rejection Rate':
          reasons.push('Insufficient documentation');
          break;
        case 'Exceeds Policy Limits':
          reasons.push('Exceeds policy limits');
          break;
      }
    });
    
    return reasons;
  }

  private async simulateTraining(duration: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, duration);
    });
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2]) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  // Public API Methods
  async getModelMetrics(modelName?: string): Promise<AIModelMetrics[]> {
    if (modelName) {
      const metrics = this.modelMetrics.get(modelName);
      return metrics ? [metrics] : [];
    }
    return Array.from(this.modelMetrics.values());
  }

  async getAvailableModels(): Promise<string[]> {
    return Array.from(this.modelMetrics.keys());
  }

  async generateBatchForecasts(drugDataList: DrugDemandData[]): Promise<DrugDemandForecast[]> {
    const forecasts: DrugDemandForecast[] = [];
    
    for (const drugData of drugDataList) {
      try {
        const forecast = await this.predictDrugDemand(drugData);
        forecasts.push(forecast);
      } catch (error) {
        console.error(`Error forecasting for drug ${drugData.drugId}:`, error);
      }
    }
    
    return forecasts;
  }

  async generateBatchClaimPredictions(claimDataList: ClaimData[]): Promise<ClaimRejectionPrediction[]> {
    const predictions: ClaimRejectionPrediction[] = [];
    
    for (const claimData of claimDataList) {
      try {
        const prediction = await this.predictClaimRejection(claimData);
        predictions.push(prediction);
      } catch (error) {
        console.error(`Error predicting for claim ${claimData.claimId}:`, error);
      }
    }
    
    return predictions;
  }
}

export default AIModelsService;
export {
  DrugDemandData,
  DrugDemandForecast,
  ClaimData,
  ClaimRejectionPrediction,
  AIModelMetrics,
  ModelTrainingData
};