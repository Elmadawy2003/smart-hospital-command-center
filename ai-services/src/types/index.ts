// Patient-related types
export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
  };
}

// Medical Record types
export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  visitDate: Date;
  chiefComplaint: string;
  diagnosis: string[];
  symptoms: string[];
  vitalSigns: VitalSigns;
  medications: Medication[];
  labResults?: LabResult[];
  imagingResults?: ImagingResult[];
  notes?: string;
}

export interface VitalSigns {
  temperature?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  sideEffects?: string[];
  interactions?: string[];
}

export interface LabResult {
  id: string;
  testName: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  status: 'NORMAL' | 'ABNORMAL' | 'CRITICAL';
  testDate: Date;
}

export interface ImagingResult {
  id: string;
  type: string;
  findings: string;
  impression: string;
  date: Date;
  radiologist?: string;
}

// Prediction types
export interface RiskPrediction {
  patientId: string;
  riskType: 'READMISSION' | 'MORTALITY' | 'COMPLICATION' | 'DETERIORATION';
  riskScore: number; // 0-1 probability
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  recommendations: string[];
  confidence: number;
  timestamp: Date;
  validUntil: Date;
}

export interface RiskFactor {
  factor: string;
  impact: number; // -1 to 1, negative reduces risk, positive increases
  description: string;
}

export interface DiagnosisAssistance {
  patientId: string;
  symptoms: string[];
  vitalSigns: VitalSigns;
  labResults?: LabResult[];
  suggestedDiagnoses: DiagnosisSuggestion[];
  recommendedTests: string[];
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
  confidence: number;
  timestamp: Date;
}

export interface DiagnosisSuggestion {
  diagnosis: string;
  probability: number;
  supportingFactors: string[];
  differentialDiagnoses: string[];
  recommendedActions: string[];
}

// Resource optimization types
export interface ResourceOptimization {
  type: 'STAFF' | 'BED' | 'EQUIPMENT' | 'MEDICATION';
  currentUtilization: number;
  optimalUtilization: number;
  recommendations: OptimizationRecommendation[];
  projectedSavings?: number;
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: Date;
}

export interface OptimizationRecommendation {
  action: string;
  impact: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedSavings?: number;
  timeframe: string;
}

// Appointment and scheduling types
export interface AppointmentPrediction {
  date: Date;
  department: string;
  predictedDemand: number;
  recommendedStaffing: StaffingRecommendation[];
  expectedWaitTime: number;
  noShowProbability: number;
  confidence: number;
}

export interface StaffingRecommendation {
  role: string;
  recommendedCount: number;
  currentCount: number;
  justification: string;
}

// Inventory management types
export interface InventoryPrediction {
  medicationId: string;
  medicationName: string;
  currentStock: number;
  predictedDemand: number;
  recommendedOrderQuantity: number;
  reorderPoint: number;
  stockoutRisk: number;
  expiryRisk: number;
  costOptimization: number;
  supplier?: string;
  leadTime?: number;
}

// Analytics and insights types
export interface PatientInsight {
  patientId: string;
  insights: Insight[];
  trends: Trend[];
  alerts: Alert[];
  recommendations: string[];
  lastUpdated: Date;
}

export interface Insight {
  type: 'HEALTH_TREND' | 'MEDICATION_ADHERENCE' | 'RISK_FACTOR' | 'LIFESTYLE';
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  actionRequired: boolean;
  data?: any;
}

export interface Trend {
  metric: string;
  direction: 'IMPROVING' | 'STABLE' | 'DECLINING';
  changeRate: number;
  timeframe: string;
  significance: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Alert {
  id: string;
  type: 'CRITICAL_VALUE' | 'DRUG_INTERACTION' | 'ALLERGY' | 'APPOINTMENT_DUE';
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
  acknowledged: boolean;
  actionTaken?: string;
}

// Model training types
export interface ModelTrainingConfig {
  modelType: 'RISK_PREDICTION' | 'DIAGNOSIS_ASSISTANCE' | 'RESOURCE_OPTIMIZATION' | 'DEMAND_FORECASTING';
  dataSource: string;
  features: string[];
  target: string;
  algorithm: string;
  hyperparameters: Record<string, any>;
  validationSplit: number;
  epochs?: number;
  batchSize?: number;
}

export interface ModelPerformance {
  modelId: string;
  modelType: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc?: number;
  confusionMatrix?: number[][];
  trainingDate: Date;
  validationDate: Date;
  datasetSize: number;
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
  requestId?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Configuration types
export interface AIServiceConfig {
  modelUpdateInterval: string;
  predictionCacheTTL: number;
  batchSize: number;
  maxConcurrentPredictions: number;
  enableMetrics: boolean;
  logLevel: string;
}

// Error types
export interface AIServiceError extends Error {
  code: string;
  statusCode: number;
  details?: any;
  timestamp: Date;
}

// Utility types
export type PredictionType = 'RISK' | 'DIAGNOSIS' | 'RESOURCE' | 'DEMAND' | 'INVENTORY';
export type ModelStatus = 'TRAINING' | 'READY' | 'UPDATING' | 'ERROR';
export type DataQuality = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

export interface ModelInfo {
  id: string;
  name: string;
  type: PredictionType;
  version: string;
  status: ModelStatus;
  accuracy: number;
  lastTrained: Date;
  nextUpdate: Date;
  dataQuality: DataQuality;
}