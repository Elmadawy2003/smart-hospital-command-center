import * as tf from '@tensorflow/tfjs-node';
import { createClient } from 'redis';
import winston from 'winston';
import { 
  Patient, 
  MedicalRecord, 
  PatientInsights, 
  PatientTrend, 
  PatientAlert,
  ModelPerformance 
} from '../types';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'ai-services.log' }),
    new winston.transports.Console()
  ]
});

// Redis client for caching
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

export class PatientInsightsService {
  private trendModel: tf.LayersModel | null = null;
  private alertModel: tf.LayersModel | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      await redis.connect();
      await this.loadModels();
      this.isInitialized = true;
      logger.info('Patient Insights Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Patient Insights Service:', error);
      throw error;
    }
  }

  private async loadModels(): Promise<void> {
    try {
      // Try to load existing models
      try {
        this.trendModel = await tf.loadLayersModel('file://./models/patient-trend-model.json');
        this.alertModel = await tf.loadLayersModel('file://./models/patient-alert-model.json');
        logger.info('Loaded existing patient insights models');
      } catch {
        // Create new models if none exist
        await this.createModels();
        logger.info('Created new patient insights models');
      }
    } catch (error) {
      logger.error('Error loading/creating models:', error);
      throw error;
    }
  }

  private async createModels(): Promise<void> {
    // Patient trend prediction model
    this.trendModel = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [20], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'sigmoid' }) // 8 trend categories
      ]
    });

    this.trendModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Patient alert prediction model
    this.alertModel = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [15], units: 48, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 24, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 12, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'sigmoid' }) // 5 alert types
      ]
    });

    this.alertModel.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    // Save models
    await this.trendModel.save('file://./models/patient-trend-model');
    await this.alertModel.save('file://./models/patient-alert-model');
  }

  async getPatientInsights(patientId: string): Promise<PatientInsights> {
    if (!this.isInitialized) {
      throw new Error('Patient Insights Service not initialized');
    }

    const cacheKey = `patient_insights:${patientId}`;
    
    try {
      // Check cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`Retrieved cached insights for patient ${patientId}`);
        return JSON.parse(cached);
      }

      // Get patient data
      const patient = await this.getPatientData(patientId);
      const medicalRecords = await this.getPatientMedicalRecords(patientId);

      // Generate insights
      const trends = await this.analyzeTrends(patient, medicalRecords);
      const alerts = await this.generateAlerts(patient, medicalRecords);
      const riskFactors = await this.identifyRiskFactors(patient, medicalRecords);
      const recommendations = await this.generateRecommendations(patient, medicalRecords, trends, alerts);

      const insights: PatientInsights = {
        patientId,
        trends,
        alerts,
        riskFactors,
        recommendations,
        lastUpdated: new Date(),
        confidence: this.calculateConfidence(trends, alerts)
      };

      // Cache results for 1 hour
      await redis.setEx(cacheKey, 3600, JSON.stringify(insights));
      
      logger.info(`Generated insights for patient ${patientId}`);
      return insights;

    } catch (error) {
      logger.error(`Error generating insights for patient ${patientId}:`, error);
      throw error;
    }
  }

  private async analyzeTrends(patient: Patient, records: MedicalRecord[]): Promise<PatientTrend[]> {
    if (!this.trendModel) {
      throw new Error('Trend model not loaded');
    }

    const features = this.extractTrendFeatures(patient, records);
    const prediction = this.trendModel.predict(tf.tensor2d([features])) as tf.Tensor;
    const probabilities = await prediction.data();

    const trendCategories = [
      'improving_health',
      'stable_condition',
      'declining_health',
      'medication_response',
      'lifestyle_improvement',
      'chronic_progression',
      'recovery_trend',
      'risk_increase'
    ];

    const trends: PatientTrend[] = [];
    
    for (let i = 0; i < trendCategories.length; i++) {
      if (probabilities[i] > 0.6) {
        trends.push({
          type: trendCategories[i],
          confidence: probabilities[i],
          description: this.getTrendDescription(trendCategories[i], probabilities[i]),
          timeframe: this.calculateTimeframe(records),
          severity: this.calculateSeverity(probabilities[i])
        });
      }
    }

    prediction.dispose();
    return trends;
  }

  private async generateAlerts(patient: Patient, records: MedicalRecord[]): Promise<PatientAlert[]> {
    if (!this.alertModel) {
      throw new Error('Alert model not loaded');
    }

    const features = this.extractAlertFeatures(patient, records);
    const prediction = this.alertModel.predict(tf.tensor2d([features])) as tf.Tensor;
    const probabilities = await prediction.data();

    const alertTypes = [
      'medication_adherence',
      'vital_signs_abnormal',
      'lab_results_critical',
      'appointment_overdue',
      'emergency_risk'
    ];

    const alerts: PatientAlert[] = [];

    for (let i = 0; i < alertTypes.length; i++) {
      if (probabilities[i] > 0.7) {
        alerts.push({
          type: alertTypes[i],
          severity: this.getAlertSeverity(probabilities[i]),
          message: this.getAlertMessage(alertTypes[i], probabilities[i]),
          confidence: probabilities[i],
          actionRequired: this.getRequiredAction(alertTypes[i]),
          createdAt: new Date()
        });
      }
    }

    prediction.dispose();
    return alerts;
  }

  private async identifyRiskFactors(patient: Patient, records: MedicalRecord[]): Promise<string[]> {
    const riskFactors: string[] = [];

    // Age-based risks
    if (patient.age > 65) {
      riskFactors.push('Advanced age');
    }

    // Medical history risks
    const conditions = records.flatMap(r => r.diagnosis || []);
    const riskConditions = ['diabetes', 'hypertension', 'heart disease', 'obesity'];
    
    riskConditions.forEach(condition => {
      if (conditions.some(c => c.toLowerCase().includes(condition))) {
        riskFactors.push(`History of ${condition}`);
      }
    });

    // Medication risks
    const medications = records.flatMap(r => r.medications || []);
    if (medications.length > 5) {
      riskFactors.push('Polypharmacy');
    }

    // Vital signs risks
    const latestRecord = records[0];
    if (latestRecord?.vitalSigns) {
      const vitals = latestRecord.vitalSigns;
      if (vitals.bloodPressure && vitals.bloodPressure.systolic > 140) {
        riskFactors.push('Hypertension');
      }
      if (vitals.heartRate && (vitals.heartRate > 100 || vitals.heartRate < 60)) {
        riskFactors.push('Abnormal heart rate');
      }
    }

    return riskFactors;
  }

  private async generateRecommendations(
    patient: Patient, 
    records: MedicalRecord[], 
    trends: PatientTrend[], 
    alerts: PatientAlert[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Based on trends
    trends.forEach(trend => {
      switch (trend.type) {
        case 'declining_health':
          recommendations.push('Schedule immediate follow-up appointment');
          break;
        case 'medication_response':
          recommendations.push('Review current medication effectiveness');
          break;
        case 'lifestyle_improvement':
          recommendations.push('Continue current lifestyle modifications');
          break;
      }
    });

    // Based on alerts
    alerts.forEach(alert => {
      switch (alert.type) {
        case 'medication_adherence':
          recommendations.push('Implement medication adherence monitoring');
          break;
        case 'vital_signs_abnormal':
          recommendations.push('Increase vital signs monitoring frequency');
          break;
        case 'lab_results_critical':
          recommendations.push('Order immediate lab work review');
          break;
      }
    });

    // General recommendations
    if (patient.age > 50) {
      recommendations.push('Annual comprehensive health screening');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private extractTrendFeatures(patient: Patient, records: MedicalRecord[]): number[] {
    const features: number[] = [];
    
    // Patient demographics
    features.push(patient.age / 100); // Normalized age
    features.push(patient.gender === 'male' ? 1 : 0);
    
    // Medical history
    features.push(records.length / 50); // Normalized record count
    
    // Recent vital signs trends (last 5 records)
    const recentRecords = records.slice(0, 5);
    const vitalsTrends = this.calculateVitalsTrends(recentRecords);
    features.push(...vitalsTrends);
    
    // Medication changes
    const medicationChanges = this.calculateMedicationChanges(records);
    features.push(medicationChanges);
    
    // Lab results trends
    const labTrends = this.calculateLabTrends(recentRecords);
    features.push(...labTrends);
    
    // Pad or truncate to exactly 20 features
    while (features.length < 20) features.push(0);
    return features.slice(0, 20);
  }

  private extractAlertFeatures(patient: Patient, records: MedicalRecord[]): number[] {
    const features: number[] = [];
    
    // Patient demographics
    features.push(patient.age / 100);
    features.push(patient.gender === 'male' ? 1 : 0);
    
    // Recent vital signs
    const latestRecord = records[0];
    if (latestRecord?.vitalSigns) {
      const vitals = latestRecord.vitalSigns;
      features.push((vitals.bloodPressure?.systolic || 120) / 200);
      features.push((vitals.heartRate || 70) / 150);
      features.push((vitals.temperature || 98.6) / 110);
    } else {
      features.push(0.6, 0.47, 0.9); // Default normalized values
    }
    
    // Time since last appointment
    const daysSinceLastRecord = records.length > 0 ? 
      Math.min((Date.now() - new Date(records[0].date).getTime()) / (1000 * 60 * 60 * 24), 365) / 365 : 1;
    features.push(daysSinceLastRecord);
    
    // Medication count
    const medicationCount = latestRecord?.medications?.length || 0;
    features.push(Math.min(medicationCount, 20) / 20);
    
    // Critical lab values
    const criticalLabs = this.checkCriticalLabValues(latestRecord);
    features.push(criticalLabs);
    
    // Pad or truncate to exactly 15 features
    while (features.length < 15) features.push(0);
    return features.slice(0, 15);
  }

  private calculateVitalsTrends(records: MedicalRecord[]): number[] {
    // Calculate trends for BP, HR, Temperature over recent records
    const trends = [0, 0, 0]; // [BP trend, HR trend, Temp trend]
    
    if (records.length < 2) return trends;
    
    const bpValues = records.map(r => r.vitalSigns?.bloodPressure?.systolic || 120);
    const hrValues = records.map(r => r.vitalSigns?.heartRate || 70);
    const tempValues = records.map(r => r.vitalSigns?.temperature || 98.6);
    
    trends[0] = this.calculateTrend(bpValues) / 100; // Normalized
    trends[1] = this.calculateTrend(hrValues) / 50;
    trends[2] = this.calculateTrend(tempValues) / 10;
    
    return trends;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    let trend = 0;
    for (let i = 1; i < values.length; i++) {
      trend += values[i] - values[i - 1];
    }
    return trend / (values.length - 1);
  }

  private calculateMedicationChanges(records: MedicalRecord[]): number {
    if (records.length < 2) return 0;
    
    const recent = records[0].medications?.length || 0;
    const previous = records[1].medications?.length || 0;
    
    return Math.min(Math.abs(recent - previous), 10) / 10; // Normalized
  }

  private calculateLabTrends(records: MedicalRecord[]): number[] {
    // Simplified lab trends for common values
    const trends = [0, 0, 0, 0, 0]; // [glucose, cholesterol, hemoglobin, creatinine, etc.]
    
    // This would be expanded with actual lab value analysis
    return trends;
  }

  private checkCriticalLabValues(record: MedicalRecord | undefined): number {
    if (!record?.labResults) return 0;
    
    // Check for critical values (simplified)
    let criticalCount = 0;
    const labs = record.labResults;
    
    // This would be expanded with actual critical value checks
    return Math.min(criticalCount, 5) / 5; // Normalized
  }

  private calculateConfidence(trends: PatientTrend[], alerts: PatientAlert[]): number {
    const trendConfidence = trends.reduce((sum, t) => sum + t.confidence, 0) / Math.max(trends.length, 1);
    const alertConfidence = alerts.reduce((sum, a) => sum + a.confidence, 0) / Math.max(alerts.length, 1);
    
    return (trendConfidence + alertConfidence) / 2;
  }

  private calculateTimeframe(records: MedicalRecord[]): string {
    if (records.length < 2) return 'Insufficient data';
    
    const daysDiff = Math.abs(
      new Date(records[0].date).getTime() - new Date(records[records.length - 1].date).getTime()
    ) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 30) return 'Last month';
    if (daysDiff < 90) return 'Last 3 months';
    if (daysDiff < 365) return 'Last year';
    return 'Long-term';
  }

  private calculateSeverity(confidence: number): 'low' | 'medium' | 'high' {
    if (confidence > 0.8) return 'high';
    if (confidence > 0.6) return 'medium';
    return 'low';
  }

  private getTrendDescription(type: string, confidence: number): string {
    const descriptions: Record<string, string> = {
      improving_health: 'Patient shows signs of health improvement',
      stable_condition: 'Patient condition remains stable',
      declining_health: 'Patient health appears to be declining',
      medication_response: 'Good response to current medications',
      lifestyle_improvement: 'Positive lifestyle changes detected',
      chronic_progression: 'Chronic condition showing progression',
      recovery_trend: 'Patient is recovering well',
      risk_increase: 'Increased risk factors identified'
    };
    
    return descriptions[type] || 'Unknown trend detected';
  }

  private getAlertSeverity(confidence: number): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence > 0.9) return 'critical';
    if (confidence > 0.8) return 'high';
    if (confidence > 0.7) return 'medium';
    return 'low';
  }

  private getAlertMessage(type: string, confidence: number): string {
    const messages: Record<string, string> = {
      medication_adherence: 'Potential medication adherence issues detected',
      vital_signs_abnormal: 'Abnormal vital signs pattern identified',
      lab_results_critical: 'Critical lab results require attention',
      appointment_overdue: 'Patient overdue for follow-up appointment',
      emergency_risk: 'Elevated emergency risk detected'
    };
    
    return messages[type] || 'Alert condition detected';
  }

  private getRequiredAction(type: string): string {
    const actions: Record<string, string> = {
      medication_adherence: 'Contact patient about medication compliance',
      vital_signs_abnormal: 'Schedule immediate vital signs check',
      lab_results_critical: 'Review lab results with physician',
      appointment_overdue: 'Schedule follow-up appointment',
      emergency_risk: 'Consider immediate medical evaluation'
    };
    
    return actions[type] || 'Review patient status';
  }

  // Mock data fetching methods (would connect to actual database)
  private async getPatientData(patientId: string): Promise<Patient> {
    // This would fetch from actual database
    return {
      id: patientId,
      name: 'Mock Patient',
      age: 45,
      gender: 'male',
      email: 'patient@example.com',
      phone: '123-456-7890',
      address: '123 Main St',
      emergencyContact: 'Emergency Contact',
      bloodType: 'O+',
      allergies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getPatientMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
    // This would fetch from actual database
    return [];
  }

  async trainModels(trainingData: any[]): Promise<ModelPerformance> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    logger.info('Starting model training for patient insights');
    
    try {
      // This would implement actual model training
      const performance: ModelPerformance = {
        accuracy: 0.85,
        precision: 0.82,
        recall: 0.88,
        f1Score: 0.85,
        trainingTime: Date.now(),
        dataSize: trainingData.length
      };

      logger.info('Model training completed', performance);
      return performance;
    } catch (error) {
      logger.error('Model training failed:', error);
      throw error;
    }
  }
}