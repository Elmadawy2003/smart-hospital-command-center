import * as tf from '@tensorflow/tfjs-node';
import { Matrix } from 'ml-matrix';
import { logger } from '@/utils/logger';
import { redisClient } from '@/utils/redis';
import { 
  Patient, 
  MedicalRecord, 
  RiskPrediction, 
  RiskFactor, 
  VitalSigns 
} from '@/types';

export class RiskPredictionService {
  private readmissionModel: tf.LayersModel | null = null;
  private mortalityModel: tf.LayersModel | null = null;
  private deteriorationModel: tf.LayersModel | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeModels();
  }

  private async initializeModels(): Promise<void> {
    try {
      // Load pre-trained models or create new ones
      await this.loadOrCreateModels();
      this.isInitialized = true;
      logger.info('Risk prediction models initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize risk prediction models:', error);
      throw error;
    }
  }

  private async loadOrCreateModels(): Promise<void> {
    try {
      // Try to load existing models
      this.readmissionModel = await this.loadModel('readmission');
      this.mortalityModel = await this.loadModel('mortality');
      this.deteriorationModel = await this.loadModel('deterioration');
    } catch (error) {
      logger.warn('Could not load existing models, creating new ones');
      await this.createDefaultModels();
    }
  }

  private async loadModel(modelType: string): Promise<tf.LayersModel> {
    const modelPath = `file://./models/${modelType}_model/model.json`;
    return await tf.loadLayersModel(modelPath);
  }

  private async createDefaultModels(): Promise<void> {
    // Create default neural network models
    this.readmissionModel = this.createNeuralNetwork(20, 1); // 20 features, 1 output
    this.mortalityModel = this.createNeuralNetwork(25, 1);   // 25 features, 1 output
    this.deteriorationModel = this.createNeuralNetwork(15, 1); // 15 features, 1 output
  }

  private createNeuralNetwork(inputSize: number, outputSize: number): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [inputSize],
          units: 64,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: outputSize,
          activation: 'sigmoid'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy', 'precision', 'recall']
    });

    return model;
  }

  public async predictReadmissionRisk(
    patient: Patient, 
    medicalHistory: MedicalRecord[]
  ): Promise<RiskPrediction> {
    if (!this.isInitialized || !this.readmissionModel) {
      throw new Error('Readmission model not initialized');
    }

    const cacheKey = `readmission_risk:${patient.id}`;
    
    // Check cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const features = this.extractReadmissionFeatures(patient, medicalHistory);
      const prediction = await this.makePrediction(this.readmissionModel, features);
      
      const riskPrediction: RiskPrediction = {
        patientId: patient.id,
        riskType: 'READMISSION',
        riskScore: prediction.score,
        riskLevel: this.categorizeRisk(prediction.score),
        factors: prediction.factors,
        recommendations: this.generateReadmissionRecommendations(prediction.factors),
        confidence: prediction.confidence,
        timestamp: new Date(),
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // Valid for 24 hours
      };

      // Cache the result
      await redisClient.setex(cacheKey, 3600, JSON.stringify(riskPrediction));
      
      logger.info(`Readmission risk predicted for patient ${patient.id}: ${prediction.score}`);
      return riskPrediction;

    } catch (error) {
      logger.error(`Error predicting readmission risk for patient ${patient.id}:`, error);
      throw error;
    }
  }

  public async predictMortalityRisk(
    patient: Patient, 
    medicalHistory: MedicalRecord[]
  ): Promise<RiskPrediction> {
    if (!this.isInitialized || !this.mortalityModel) {
      throw new Error('Mortality model not initialized');
    }

    const cacheKey = `mortality_risk:${patient.id}`;
    
    // Check cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const features = this.extractMortalityFeatures(patient, medicalHistory);
      const prediction = await this.makePrediction(this.mortalityModel, features);
      
      const riskPrediction: RiskPrediction = {
        patientId: patient.id,
        riskType: 'MORTALITY',
        riskScore: prediction.score,
        riskLevel: this.categorizeRisk(prediction.score),
        factors: prediction.factors,
        recommendations: this.generateMortalityRecommendations(prediction.factors),
        confidence: prediction.confidence,
        timestamp: new Date(),
        validUntil: new Date(Date.now() + 12 * 60 * 60 * 1000) // Valid for 12 hours
      };

      // Cache the result
      await redisClient.setex(cacheKey, 1800, JSON.stringify(riskPrediction));
      
      logger.info(`Mortality risk predicted for patient ${patient.id}: ${prediction.score}`);
      return riskPrediction;

    } catch (error) {
      logger.error(`Error predicting mortality risk for patient ${patient.id}:`, error);
      throw error;
    }
  }

  public async predictDeteriorationRisk(
    patient: Patient, 
    currentVitals: VitalSigns,
    recentHistory: MedicalRecord[]
  ): Promise<RiskPrediction> {
    if (!this.isInitialized || !this.deteriorationModel) {
      throw new Error('Deterioration model not initialized');
    }

    const cacheKey = `deterioration_risk:${patient.id}:${Date.now()}`;

    try {
      const features = this.extractDeteriorationFeatures(patient, currentVitals, recentHistory);
      const prediction = await this.makePrediction(this.deteriorationModel, features);
      
      const riskPrediction: RiskPrediction = {
        patientId: patient.id,
        riskType: 'DETERIORATION',
        riskScore: prediction.score,
        riskLevel: this.categorizeRisk(prediction.score),
        factors: prediction.factors,
        recommendations: this.generateDeteriorationRecommendations(prediction.factors),
        confidence: prediction.confidence,
        timestamp: new Date(),
        validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) // Valid for 2 hours
      };

      // Cache the result for shorter time due to real-time nature
      await redisClient.setex(cacheKey, 900, JSON.stringify(riskPrediction));
      
      logger.info(`Deterioration risk predicted for patient ${patient.id}: ${prediction.score}`);
      return riskPrediction;

    } catch (error) {
      logger.error(`Error predicting deterioration risk for patient ${patient.id}:`, error);
      throw error;
    }
  }

  private async makePrediction(
    model: tf.LayersModel, 
    features: number[]
  ): Promise<{ score: number; confidence: number; factors: RiskFactor[] }> {
    const inputTensor = tf.tensor2d([features]);
    const prediction = model.predict(inputTensor) as tf.Tensor;
    const score = await prediction.data();
    
    // Calculate confidence based on prediction certainty
    const confidence = this.calculateConfidence(score[0]);
    
    // Extract feature importance (simplified approach)
    const factors = this.extractFeatureImportance(features);
    
    inputTensor.dispose();
    prediction.dispose();
    
    return {
      score: score[0],
      confidence,
      factors
    };
  }

  private extractReadmissionFeatures(patient: Patient, history: MedicalRecord[]): number[] {
    const features: number[] = [];
    
    // Patient demographics
    const age = this.calculateAge(patient.dateOfBirth);
    features.push(age / 100); // Normalized age
    features.push(patient.gender === 'MALE' ? 1 : 0);
    features.push(patient.chronicConditions?.length || 0);
    features.push(patient.allergies?.length || 0);
    
    // Medical history features
    features.push(history.length); // Number of visits
    features.push(this.getAverageStayDuration(history));
    features.push(this.getComorbidityScore(history));
    features.push(this.getMedicationComplexity(history));
    
    // Recent admission features
    const recentAdmissions = history.filter(record => 
      new Date(record.visitDate) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    );
    features.push(recentAdmissions.length);
    
    // Vital signs stability
    features.push(this.getVitalSignsStability(history));
    
    // Lab results trends
    features.push(this.getLabTrends(history));
    
    // Social factors (simplified)
    features.push(patient.insurance ? 1 : 0);
    features.push(patient.emergencyContact ? 1 : 0);
    
    // Pad or truncate to expected size (20 features)
    while (features.length < 20) {
      features.push(0);
    }
    
    return features.slice(0, 20);
  }

  private extractMortalityFeatures(patient: Patient, history: MedicalRecord[]): number[] {
    const features: number[] = [];
    
    // Start with readmission features
    const baseFeatures = this.extractReadmissionFeatures(patient, history);
    features.push(...baseFeatures);
    
    // Additional mortality-specific features
    features.push(this.getSeverityScore(history));
    features.push(this.getOrganFailureScore(history));
    features.push(this.getInfectionScore(history));
    features.push(this.getNutritionalStatus(history));
    features.push(this.getFunctionalStatus(history));
    
    // Pad or truncate to expected size (25 features)
    while (features.length < 25) {
      features.push(0);
    }
    
    return features.slice(0, 25);
  }

  private extractDeteriorationFeatures(
    patient: Patient, 
    vitals: VitalSigns, 
    history: MedicalRecord[]
  ): number[] {
    const features: number[] = [];
    
    // Current vital signs (normalized)
    features.push((vitals.temperature || 37) / 42);
    features.push((vitals.heartRate || 70) / 200);
    features.push((vitals.bloodPressureSystolic || 120) / 250);
    features.push((vitals.bloodPressureDiastolic || 80) / 150);
    features.push((vitals.respiratoryRate || 16) / 40);
    features.push((vitals.oxygenSaturation || 98) / 100);
    
    // Vital signs trends
    features.push(this.getVitalTrend(history, 'temperature'));
    features.push(this.getVitalTrend(history, 'heartRate'));
    features.push(this.getVitalTrend(history, 'bloodPressure'));
    
    // Patient factors
    const age = this.calculateAge(patient.dateOfBirth);
    features.push(age / 100);
    features.push(patient.chronicConditions?.length || 0);
    
    // Recent changes
    features.push(this.getRecentMedicationChanges(history));
    features.push(this.getRecentProcedures(history));
    features.push(this.getRecentLabAbnormalities(history));
    features.push(this.getInfectionRisk(history));
    
    // Pad or truncate to expected size (15 features)
    while (features.length < 15) {
      features.push(0);
    }
    
    return features.slice(0, 15);
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private categorizeRisk(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score < 0.25) return 'LOW';
    if (score < 0.5) return 'MEDIUM';
    if (score < 0.75) return 'HIGH';
    return 'CRITICAL';
  }

  private calculateConfidence(score: number): number {
    // Confidence is higher when prediction is closer to 0 or 1
    return Math.abs(score - 0.5) * 2;
  }

  private extractFeatureImportance(features: number[]): RiskFactor[] {
    // Simplified feature importance calculation
    const featureNames = [
      'Age', 'Gender', 'Chronic Conditions', 'Allergies', 'Visit History',
      'Stay Duration', 'Comorbidity Score', 'Medication Complexity',
      'Recent Admissions', 'Vital Stability', 'Lab Trends', 'Insurance',
      'Emergency Contact', 'Severity Score', 'Organ Function'
    ];

    return features.slice(0, 10).map((value, index) => ({
      factor: featureNames[index] || `Feature ${index + 1}`,
      impact: value > 0.5 ? value - 0.5 : -(0.5 - value),
      description: `${featureNames[index]} contributes ${value > 0.5 ? 'positively' : 'negatively'} to risk`
    }));
  }

  // Helper methods for feature extraction
  private getAverageStayDuration(history: MedicalRecord[]): number {
    // Simplified calculation
    return history.length > 0 ? Math.min(history.length * 2, 30) / 30 : 0;
  }

  private getComorbidityScore(history: MedicalRecord[]): number {
    const uniqueDiagnoses = new Set();
    history.forEach(record => {
      record.diagnosis.forEach(d => uniqueDiagnoses.add(d));
    });
    return Math.min(uniqueDiagnoses.size / 10, 1);
  }

  private getMedicationComplexity(history: MedicalRecord[]): number {
    const allMedications = history.flatMap(record => record.medications);
    return Math.min(allMedications.length / 20, 1);
  }

  private getVitalSignsStability(history: MedicalRecord[]): number {
    // Simplified stability calculation
    return Math.random() * 0.5 + 0.25; // Placeholder
  }

  private getLabTrends(history: MedicalRecord[]): number {
    // Simplified lab trends calculation
    return Math.random() * 0.5 + 0.25; // Placeholder
  }

  private getSeverityScore(history: MedicalRecord[]): number {
    // Simplified severity calculation based on diagnoses
    const severeDiagnoses = ['sepsis', 'heart failure', 'stroke', 'cancer'];
    const hasSevere = history.some(record => 
      record.diagnosis.some(d => 
        severeDiagnoses.some(severe => d.toLowerCase().includes(severe))
      )
    );
    return hasSevere ? 0.8 : 0.2;
  }

  private getOrganFailureScore(history: MedicalRecord[]): number {
    // Placeholder for organ failure assessment
    return Math.random() * 0.3;
  }

  private getInfectionScore(history: MedicalRecord[]): number {
    // Placeholder for infection risk assessment
    return Math.random() * 0.4;
  }

  private getNutritionalStatus(history: MedicalRecord[]): number {
    // Placeholder for nutritional assessment
    return Math.random() * 0.5 + 0.5;
  }

  private getFunctionalStatus(history: MedicalRecord[]): number {
    // Placeholder for functional status assessment
    return Math.random() * 0.5 + 0.5;
  }

  private getVitalTrend(history: MedicalRecord[], vitalType: string): number {
    // Simplified trend calculation
    return Math.random() * 0.4 + 0.3; // Placeholder
  }

  private getRecentMedicationChanges(history: MedicalRecord[]): number {
    // Placeholder for recent medication changes
    return Math.random() * 0.3;
  }

  private getRecentProcedures(history: MedicalRecord[]): number {
    // Placeholder for recent procedures
    return Math.random() * 0.2;
  }

  private getRecentLabAbnormalities(history: MedicalRecord[]): number {
    // Placeholder for recent lab abnormalities
    return Math.random() * 0.4;
  }

  private getInfectionRisk(history: MedicalRecord[]): number {
    // Placeholder for infection risk
    return Math.random() * 0.3;
  }

  private generateReadmissionRecommendations(factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];
    
    factors.forEach(factor => {
      if (factor.impact > 0.3) {
        switch (factor.factor.toLowerCase()) {
          case 'age':
            recommendations.push('Consider geriatric consultation for age-related care optimization');
            break;
          case 'chronic conditions':
            recommendations.push('Implement chronic disease management protocols');
            break;
          case 'medication complexity':
            recommendations.push('Review and simplify medication regimen if possible');
            break;
          case 'recent admissions':
            recommendations.push('Enhance discharge planning and follow-up care');
            break;
          default:
            recommendations.push(`Monitor and address ${factor.factor.toLowerCase()}`);
        }
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Continue standard care protocols');
    }

    return recommendations;
  }

  private generateMortalityRecommendations(factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];
    
    recommendations.push('Implement intensive monitoring protocols');
    recommendations.push('Consider ICU consultation if not already involved');
    recommendations.push('Review and optimize all therapeutic interventions');
    recommendations.push('Ensure family communication and advance directive discussions');
    
    return recommendations;
  }

  private generateDeteriorationRecommendations(factors: RiskFactor[]): string[] {
    const recommendations: string[] = [];
    
    recommendations.push('Increase vital signs monitoring frequency');
    recommendations.push('Consider early warning system activation');
    recommendations.push('Review current medications for potential adjustments');
    recommendations.push('Ensure rapid response team availability');
    
    return recommendations;
  }

  public async saveModel(modelType: string, model: tf.LayersModel): Promise<void> {
    try {
      const modelPath = `file://./models/${modelType}_model`;
      await model.save(modelPath);
      logger.info(`${modelType} model saved successfully`);
    } catch (error) {
      logger.error(`Failed to save ${modelType} model:`, error);
      throw error;
    }
  }

  public getModelInfo(): any {
    return {
      readmissionModel: {
        initialized: !!this.readmissionModel,
        inputShape: this.readmissionModel?.inputs[0].shape,
        outputShape: this.readmissionModel?.outputs[0].shape
      },
      mortalityModel: {
        initialized: !!this.mortalityModel,
        inputShape: this.mortalityModel?.inputs[0].shape,
        outputShape: this.mortalityModel?.outputs[0].shape
      },
      deteriorationModel: {
        initialized: !!this.deteriorationModel,
        inputShape: this.deteriorationModel?.inputs[0].shape,
        outputShape: this.deteriorationModel?.outputs[0].shape
      }
    };
  }
}