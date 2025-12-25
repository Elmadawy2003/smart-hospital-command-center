import * as tf from '@tensorflow/tfjs-node';
import { logger } from '@/utils/logger';
import { redisClient } from '@/utils/redis';
import { 
  Patient, 
  MedicalRecord, 
  DiagnosisAssistance, 
  DiagnosisSuggestion, 
  VitalSigns, 
  LabResult 
} from '@/types';

interface SymptomMapping {
  symptom: string;
  weight: number;
  relatedDiagnoses: string[];
}

interface DiagnosisDatabase {
  [key: string]: {
    commonSymptoms: string[];
    rareSymptoms: string[];
    requiredTests: string[];
    differentialDiagnoses: string[];
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
    prevalence: number;
  };
}

export class DiagnosisAssistanceService {
  private diagnosisModel: tf.LayersModel | null = null;
  private symptomEmbeddings: Map<string, number[]> = new Map();
  private diagnosisDatabase: DiagnosisDatabase = {};
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      await this.loadDiagnosisDatabase();
      await this.initializeSymptomEmbeddings();
      await this.loadOrCreateModel();
      this.isInitialized = true;
      logger.info('Diagnosis assistance service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize diagnosis assistance service:', error);
      throw error;
    }
  }

  private async loadDiagnosisDatabase(): Promise<void> {
    // Load comprehensive diagnosis database
    this.diagnosisDatabase = {
      'hypertension': {
        commonSymptoms: ['headache', 'dizziness', 'chest pain', 'shortness of breath'],
        rareSymptoms: ['nosebleeds', 'vision changes'],
        requiredTests: ['blood pressure', 'ecg', 'blood work'],
        differentialDiagnoses: ['white coat hypertension', 'secondary hypertension'],
        urgencyLevel: 'MEDIUM',
        prevalence: 0.45
      },
      'diabetes mellitus type 2': {
        commonSymptoms: ['increased thirst', 'frequent urination', 'fatigue', 'blurred vision'],
        rareSymptoms: ['slow healing wounds', 'tingling in hands/feet'],
        requiredTests: ['fasting glucose', 'hba1c', 'glucose tolerance test'],
        differentialDiagnoses: ['type 1 diabetes', 'gestational diabetes', 'prediabetes'],
        urgencyLevel: 'MEDIUM',
        prevalence: 0.11
      },
      'pneumonia': {
        commonSymptoms: ['cough', 'fever', 'shortness of breath', 'chest pain'],
        rareSymptoms: ['confusion', 'nausea', 'vomiting'],
        requiredTests: ['chest x-ray', 'blood work', 'sputum culture'],
        differentialDiagnoses: ['bronchitis', 'tuberculosis', 'lung cancer'],
        urgencyLevel: 'HIGH',
        prevalence: 0.05
      },
      'myocardial infarction': {
        commonSymptoms: ['chest pain', 'shortness of breath', 'nausea', 'sweating'],
        rareSymptoms: ['jaw pain', 'arm pain', 'back pain'],
        requiredTests: ['ecg', 'troponin', 'chest x-ray', 'echocardiogram'],
        differentialDiagnoses: ['angina', 'aortic dissection', 'pulmonary embolism'],
        urgencyLevel: 'EMERGENCY',
        prevalence: 0.02
      },
      'stroke': {
        commonSymptoms: ['sudden weakness', 'speech difficulty', 'vision loss', 'severe headache'],
        rareSymptoms: ['dizziness', 'loss of coordination'],
        requiredTests: ['ct scan', 'mri', 'carotid ultrasound'],
        differentialDiagnoses: ['tia', 'migraine', 'seizure'],
        urgencyLevel: 'EMERGENCY',
        prevalence: 0.008
      },
      'appendicitis': {
        commonSymptoms: ['abdominal pain', 'nausea', 'vomiting', 'fever'],
        rareSymptoms: ['loss of appetite', 'constipation'],
        requiredTests: ['ct scan', 'blood work', 'ultrasound'],
        differentialDiagnoses: ['gastroenteritis', 'kidney stones', 'ovarian cyst'],
        urgencyLevel: 'HIGH',
        prevalence: 0.007
      },
      'migraine': {
        commonSymptoms: ['severe headache', 'nausea', 'light sensitivity', 'sound sensitivity'],
        rareSymptoms: ['visual aura', 'tingling'],
        requiredTests: ['neurological exam', 'mri (if indicated)'],
        differentialDiagnoses: ['tension headache', 'cluster headache', 'brain tumor'],
        urgencyLevel: 'LOW',
        prevalence: 0.12
      },
      'gastroenteritis': {
        commonSymptoms: ['diarrhea', 'vomiting', 'abdominal pain', 'fever'],
        rareSymptoms: ['dehydration', 'blood in stool'],
        requiredTests: ['stool culture', 'blood work (if severe)'],
        differentialDiagnoses: ['food poisoning', 'ibd', 'appendicitis'],
        urgencyLevel: 'LOW',
        prevalence: 0.08
      },
      'urinary tract infection': {
        commonSymptoms: ['burning urination', 'frequent urination', 'pelvic pain', 'cloudy urine'],
        rareSymptoms: ['back pain', 'fever', 'blood in urine'],
        requiredTests: ['urinalysis', 'urine culture'],
        differentialDiagnoses: ['kidney stones', 'prostatitis', 'sexually transmitted infection'],
        urgencyLevel: 'MEDIUM',
        prevalence: 0.06
      },
      'asthma': {
        commonSymptoms: ['wheezing', 'shortness of breath', 'chest tightness', 'cough'],
        rareSymptoms: ['difficulty speaking', 'blue lips'],
        requiredTests: ['spirometry', 'peak flow', 'chest x-ray'],
        differentialDiagnoses: ['copd', 'pneumonia', 'heart failure'],
        urgencyLevel: 'MEDIUM',
        prevalence: 0.08
      }
    };
  }

  private async initializeSymptomEmbeddings(): Promise<void> {
    // Create simple symptom embeddings (in real implementation, use pre-trained embeddings)
    const symptoms = [
      'headache', 'dizziness', 'chest pain', 'shortness of breath', 'nosebleeds',
      'vision changes', 'increased thirst', 'frequent urination', 'fatigue',
      'blurred vision', 'slow healing wounds', 'tingling', 'cough', 'fever',
      'nausea', 'vomiting', 'confusion', 'sweating', 'jaw pain', 'arm pain',
      'back pain', 'sudden weakness', 'speech difficulty', 'vision loss',
      'severe headache', 'loss of coordination', 'abdominal pain', 'loss of appetite',
      'constipation', 'light sensitivity', 'sound sensitivity', 'visual aura',
      'diarrhea', 'dehydration', 'blood in stool', 'burning urination',
      'pelvic pain', 'cloudy urine', 'blood in urine', 'wheezing',
      'chest tightness', 'difficulty speaking', 'blue lips'
    ];

    symptoms.forEach((symptom, index) => {
      // Create simple embedding (in real implementation, use word2vec or similar)
      const embedding = new Array(50).fill(0).map(() => Math.random() - 0.5);
      embedding[index % 50] = 1; // Add some structure
      this.symptomEmbeddings.set(symptom, embedding);
    });
  }

  private async loadOrCreateModel(): Promise<void> {
    try {
      this.diagnosisModel = await this.loadModel('diagnosis');
    } catch (error) {
      logger.warn('Could not load existing diagnosis model, creating new one');
      this.diagnosisModel = this.createDiagnosisModel();
    }
  }

  private async loadModel(modelType: string): Promise<tf.LayersModel> {
    const modelPath = `file://./models/${modelType}_model/model.json`;
    return await tf.loadLayersModel(modelPath);
  }

  private createDiagnosisModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [100], // 50 for symptoms + 50 for vitals/labs
          units: 128,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: Object.keys(this.diagnosisDatabase).length,
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  public async provideDiagnosisAssistance(
    patient: Patient,
    symptoms: string[],
    vitalSigns: VitalSigns,
    labResults?: LabResult[]
  ): Promise<DiagnosisAssistance> {
    if (!this.isInitialized || !this.diagnosisModel) {
      throw new Error('Diagnosis assistance service not initialized');
    }

    const cacheKey = `diagnosis:${patient.id}:${JSON.stringify(symptoms)}`;
    
    // Check cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const features = this.extractDiagnosisFeatures(symptoms, vitalSigns, labResults);
      const predictions = await this.makeDiagnosisPrediction(features);
      
      const diagnosisAssistance: DiagnosisAssistance = {
        patientId: patient.id,
        symptoms,
        vitalSigns,
        labResults,
        suggestedDiagnoses: predictions.diagnoses,
        recommendedTests: this.getRecommendedTests(predictions.diagnoses),
        urgencyLevel: this.determineUrgencyLevel(predictions.diagnoses),
        confidence: predictions.confidence,
        timestamp: new Date()
      };

      // Cache the result
      await redisClient.setex(cacheKey, 1800, JSON.stringify(diagnosisAssistance));
      
      logger.info(`Diagnosis assistance provided for patient ${patient.id}`);
      return diagnosisAssistance;

    } catch (error) {
      logger.error(`Error providing diagnosis assistance for patient ${patient.id}:`, error);
      throw error;
    }
  }

  private extractDiagnosisFeatures(
    symptoms: string[],
    vitalSigns: VitalSigns,
    labResults?: LabResult[]
  ): number[] {
    const features: number[] = new Array(100).fill(0);
    
    // Symptom features (first 50 dimensions)
    symptoms.forEach(symptom => {
      const embedding = this.symptomEmbeddings.get(symptom.toLowerCase());
      if (embedding) {
        embedding.forEach((value, index) => {
          if (index < 50) {
            features[index] += value;
          }
        });
      }
    });

    // Normalize symptom features
    const symptomMagnitude = Math.sqrt(features.slice(0, 50).reduce((sum, val) => sum + val * val, 0));
    if (symptomMagnitude > 0) {
      for (let i = 0; i < 50; i++) {
        features[i] /= symptomMagnitude;
      }
    }

    // Vital signs features (next 25 dimensions)
    features[50] = this.normalizeVital(vitalSigns.temperature, 36, 42);
    features[51] = this.normalizeVital(vitalSigns.heartRate, 60, 100);
    features[52] = this.normalizeVital(vitalSigns.bloodPressureSystolic, 90, 140);
    features[53] = this.normalizeVital(vitalSigns.bloodPressureDiastolic, 60, 90);
    features[54] = this.normalizeVital(vitalSigns.respiratoryRate, 12, 20);
    features[55] = this.normalizeVital(vitalSigns.oxygenSaturation, 95, 100);
    features[56] = this.normalizeVital(vitalSigns.weight, 50, 100);
    features[57] = this.normalizeVital(vitalSigns.height, 150, 200);

    // Lab results features (remaining dimensions)
    if (labResults) {
      labResults.slice(0, 25).forEach((lab, index) => {
        const featureIndex = 75 + index;
        if (featureIndex < 100) {
          features[featureIndex] = this.normalizeLabValue(lab);
        }
      });
    }

    return features;
  }

  private normalizeVital(value: number | undefined, min: number, max: number): number {
    if (value === undefined) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  private normalizeLabValue(lab: LabResult): number {
    // Simplified lab value normalization
    if (lab.status === 'NORMAL') return 0.5;
    if (lab.status === 'ABNORMAL') return 0.8;
    if (lab.status === 'CRITICAL') return 1.0;
    return 0;
  }

  private async makeDiagnosisPrediction(features: number[]): Promise<{
    diagnoses: DiagnosisSuggestion[];
    confidence: number;
  }> {
    const inputTensor = tf.tensor2d([features]);
    const prediction = this.diagnosisModel!.predict(inputTensor) as tf.Tensor;
    const probabilities = await prediction.data();
    
    const diagnoses = Object.keys(this.diagnosisDatabase);
    const suggestions: DiagnosisSuggestion[] = [];

    // Get top 5 diagnoses
    const indexedProbs = Array.from(probabilities)
      .map((prob, index) => ({ prob, index }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 5);

    indexedProbs.forEach(({ prob, index }) => {
      const diagnosis = diagnoses[index];
      if (diagnosis && prob > 0.1) { // Only include if probability > 10%
        const diagnosisInfo = this.diagnosisDatabase[diagnosis];
        suggestions.push({
          diagnosis,
          probability: prob,
          supportingFactors: this.getSupportingFactors(diagnosis, features),
          differentialDiagnoses: diagnosisInfo.differentialDiagnoses,
          recommendedActions: this.getRecommendedActions(diagnosis, prob)
        });
      }
    });

    const confidence = Math.max(...indexedProbs.map(p => p.prob));

    inputTensor.dispose();
    prediction.dispose();

    return { diagnoses: suggestions, confidence };
  }

  private getSupportingFactors(diagnosis: string, features: number[]): string[] {
    const diagnosisInfo = this.diagnosisDatabase[diagnosis];
    const factors: string[] = [];

    // Check for common symptoms
    diagnosisInfo.commonSymptoms.forEach(symptom => {
      if (this.symptomEmbeddings.has(symptom)) {
        factors.push(`Presence of ${symptom}`);
      }
    });

    // Check vital signs
    if (features[50] > 0.7) factors.push('Elevated temperature');
    if (features[51] > 0.8) factors.push('Elevated heart rate');
    if (features[52] > 0.8) factors.push('Elevated blood pressure');

    return factors.slice(0, 5); // Limit to top 5 factors
  }

  private getRecommendedActions(diagnosis: string, probability: number): string[] {
    const diagnosisInfo = this.diagnosisDatabase[diagnosis];
    const actions: string[] = [];

    if (diagnosisInfo.urgencyLevel === 'EMERGENCY') {
      actions.push('Immediate emergency intervention required');
      actions.push('Activate emergency protocols');
    } else if (diagnosisInfo.urgencyLevel === 'HIGH') {
      actions.push('Urgent medical attention required');
      actions.push('Consider hospital admission');
    } else if (diagnosisInfo.urgencyLevel === 'MEDIUM') {
      actions.push('Schedule follow-up within 24-48 hours');
      actions.push('Monitor symptoms closely');
    } else {
      actions.push('Routine follow-up recommended');
      actions.push('Conservative management appropriate');
    }

    if (probability > 0.8) {
      actions.push('High confidence diagnosis - proceed with treatment');
    } else if (probability > 0.5) {
      actions.push('Moderate confidence - consider additional testing');
    } else {
      actions.push('Low confidence - extensive differential diagnosis needed');
    }

    return actions;
  }

  private getRecommendedTests(diagnoses: DiagnosisSuggestion[]): string[] {
    const allTests = new Set<string>();
    
    diagnoses.forEach(diagnosis => {
      const diagnosisInfo = this.diagnosisDatabase[diagnosis.diagnosis];
      if (diagnosisInfo) {
        diagnosisInfo.requiredTests.forEach(test => allTests.add(test));
      }
    });

    return Array.from(allTests).slice(0, 10); // Limit to 10 tests
  }

  private determineUrgencyLevel(diagnoses: DiagnosisSuggestion[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY' {
    let maxUrgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY' = 'LOW';
    
    diagnoses.forEach(diagnosis => {
      const diagnosisInfo = this.diagnosisDatabase[diagnosis.diagnosis];
      if (diagnosisInfo) {
        const urgencyLevels = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];
        const currentLevel = urgencyLevels.indexOf(diagnosisInfo.urgencyLevel);
        const maxLevel = urgencyLevels.indexOf(maxUrgency);
        
        if (currentLevel > maxLevel) {
          maxUrgency = diagnosisInfo.urgencyLevel;
        }
      }
    });

    return maxUrgency;
  }

  public async getDifferentialDiagnosis(
    primaryDiagnosis: string,
    symptoms: string[]
  ): Promise<string[]> {
    const diagnosisInfo = this.diagnosisDatabase[primaryDiagnosis.toLowerCase()];
    if (!diagnosisInfo) {
      return [];
    }

    // Filter differential diagnoses based on symptom overlap
    const differentials = diagnosisInfo.differentialDiagnoses.filter(diff => {
      const diffInfo = this.diagnosisDatabase[diff.toLowerCase()];
      if (!diffInfo) return false;

      // Check for symptom overlap
      const overlap = symptoms.filter(symptom => 
        diffInfo.commonSymptoms.includes(symptom.toLowerCase()) ||
        diffInfo.rareSymptoms.includes(symptom.toLowerCase())
      );

      return overlap.length > 0;
    });

    return differentials;
  }

  public async getSymptomAnalysis(symptoms: string[]): Promise<{
    commonDiagnoses: string[];
    urgentSymptoms: string[];
    recommendedSpecialty: string;
  }> {
    const diagnosisMatches: { [key: string]: number } = {};
    const urgentSymptoms: string[] = [];

    // Analyze each symptom
    symptoms.forEach(symptom => {
      Object.entries(this.diagnosisDatabase).forEach(([diagnosis, info]) => {
        if (info.commonSymptoms.includes(symptom.toLowerCase())) {
          diagnosisMatches[diagnosis] = (diagnosisMatches[diagnosis] || 0) + 2;
        } else if (info.rareSymptoms.includes(symptom.toLowerCase())) {
          diagnosisMatches[diagnosis] = (diagnosisMatches[diagnosis] || 0) + 1;
        }

        // Check for urgent symptoms
        if (info.urgencyLevel === 'EMERGENCY' && 
            info.commonSymptoms.includes(symptom.toLowerCase())) {
          urgentSymptoms.push(symptom);
        }
      });
    });

    // Get top diagnoses
    const commonDiagnoses = Object.entries(diagnosisMatches)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([diagnosis]) => diagnosis);

    // Recommend specialty based on top diagnosis
    const recommendedSpecialty = this.getRecommendedSpecialty(commonDiagnoses[0]);

    return {
      commonDiagnoses,
      urgentSymptoms: [...new Set(urgentSymptoms)],
      recommendedSpecialty
    };
  }

  private getRecommendedSpecialty(diagnosis: string): string {
    const specialtyMap: { [key: string]: string } = {
      'hypertension': 'Cardiology',
      'diabetes mellitus type 2': 'Endocrinology',
      'pneumonia': 'Pulmonology',
      'myocardial infarction': 'Cardiology',
      'stroke': 'Neurology',
      'appendicitis': 'General Surgery',
      'migraine': 'Neurology',
      'gastroenteritis': 'Gastroenterology',
      'urinary tract infection': 'Urology',
      'asthma': 'Pulmonology'
    };

    return specialtyMap[diagnosis] || 'Internal Medicine';
  }

  public async saveModel(): Promise<void> {
    if (!this.diagnosisModel) {
      throw new Error('No model to save');
    }

    try {
      const modelPath = `file://./models/diagnosis_model`;
      await this.diagnosisModel.save(modelPath);
      logger.info('Diagnosis model saved successfully');
    } catch (error) {
      logger.error('Failed to save diagnosis model:', error);
      throw error;
    }
  }

  public getModelInfo(): any {
    return {
      diagnosisModel: {
        initialized: !!this.diagnosisModel,
        inputShape: this.diagnosisModel?.inputs[0].shape,
        outputShape: this.diagnosisModel?.outputs[0].shape,
        diagnosesCount: Object.keys(this.diagnosisDatabase).length,
        symptomsCount: this.symptomEmbeddings.size
      }
    };
  }
}