// Core User and Authentication Types
export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string;
  permissions: string[];
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
  hireDate: Date;
  salary?: number;
  isActive: boolean;
  resetToken?: string;
  resetTokenExpiry?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  PHARMACIST = 'pharmacist',
  LAB_TECH = 'lab_tech',
  RADIOLOGIST = 'radiologist',
  HR = 'hr',
  FINANCE = 'finance',
  RECEPTIONIST = 'receptionist'
}

export enum GenderType {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

// Patient Types
export interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: GenderType;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: EmergencyContact;
  insuranceInfo?: InsuranceInfo;
  medicalHistory: MedicalHistoryItem[];
  allergies: Allergy[];
  bloodType?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  groupNumber?: string;
  expiryDate?: Date;
}

export interface MedicalHistoryItem {
  condition: string;
  diagnosedDate: Date;
  status: 'active' | 'resolved' | 'chronic';
  notes?: string;
}

export interface Allergy {
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe';
  reaction: string;
  notes?: string;
}

// Medical Record Types
export interface MedicalRecord {
  id: string;
  patientId: string;
  doctorId: string;
  diagnosis: string;
  symptoms: string[];
  treatment?: string;
  medications: Medication[];
  notes?: string;
  visitDate: Date;
  followUpDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

// Appointment Types
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

export enum AppointmentType {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow_up',
  EMERGENCY = 'emergency',
  SURGERY = 'surgery',
  CHECKUP = 'checkup',
  VACCINATION = 'vaccination'
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  duration: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
  roomNumber?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Billing and Finance Types
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export interface Bill {
  id: string;
  patientId: string;
  appointmentId?: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: PaymentStatus;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: 'consultation' | 'procedure' | 'medication' | 'lab' | 'imaging' | 'other';
}

export interface Payment {
  id: string;
  billId: string;
  amount: number;
  method: 'cash' | 'card' | 'insurance' | 'bank_transfer';
  reference?: string;
  processedBy: string;
  processedAt: Date;
  notes?: string;
}

// Inventory Types
export enum InventoryStatus {
  IN_STOCK = 'in_stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
  EXPIRED = 'expired'
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  sku: string;
  description?: string;
  quantity: number;
  minQuantity: number;
  maxQuantity: number;
  unitPrice: number;
  supplier: string;
  expiryDate?: Date;
  batchNumber?: string;
  location: string;
  status: InventoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Laboratory Types
export interface LabOrder {
  id: string;
  patientId: string;
  doctorId: string;
  tests: LabTest[];
  priority: 'routine' | 'urgent' | 'stat';
  status: 'ordered' | 'collected' | 'processing' | 'completed' | 'cancelled';
  orderedAt: Date;
  collectedAt?: Date;
  completedAt?: Date;
  notes?: string;
}

export interface LabTest {
  testCode: string;
  testName: string;
  specimen: string;
  instructions?: string;
}

export interface LabResult {
  id: string;
  labOrderId: string;
  testCode: string;
  result: string;
  normalRange: string;
  unit: string;
  status: 'normal' | 'abnormal' | 'critical';
  performedBy: string;
  verifiedBy?: string;
  performedAt: Date;
  verifiedAt?: Date;
  notes?: string;
}

// Imaging Types
export interface ImagingOrder {
  id: string;
  patientId: string;
  doctorId: string;
  studyType: string;
  bodyPart: string;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'ordered' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  contrast: boolean;
  clinicalInfo: string;
  orderedAt: Date;
  scheduledAt?: Date;
  completedAt?: Date;
}

export interface ImagingResult {
  id: string;
  imagingOrderId: string;
  findings: string;
  impression: string;
  recommendation?: string;
  images: string[];
  radiologistId: string;
  reportedAt: Date;
  status: 'preliminary' | 'final' | 'amended';
}

// HR Types
export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TERMINATED = 'terminated',
  ON_LEAVE = 'on_leave'
}

export interface Employee {
  id: string;
  employeeNumber: string;
  userId: string;
  position: string;
  department: string;
  manager?: string;
  startDate: Date;
  endDate?: Date;
  status: EmployeeStatus;
  workSchedule: WorkSchedule;
  emergencyContact: EmergencyContact;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkSchedule {
  type: 'full_time' | 'part_time' | 'contract';
  hoursPerWeek: number;
  shifts: Shift[];
}

export interface Shift {
  day: string;
  startTime: string;
  endTime: string;
}

// Department Types
export interface Department {
  id: string;
  name: string;
  description?: string;
  headOfDepartment?: string;
  location?: string;
  phone?: string;
  email?: string;
  budget?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// AI and Analytics Types
export interface RiskPrediction {
  id: string;
  patientId: string;
  riskType: 'readmission' | 'mortality' | 'deterioration';
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  factors: RiskFactor[];
  recommendations: string[];
  predictedAt: Date;
  validUntil: Date;
}

export interface RiskFactor {
  factor: string;
  impact: number;
  description: string;
}

export interface VitalSigns {
  temperature: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  weight?: number;
  height?: number;
  bmi?: number;
  recordedAt: Date;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Dashboard Types
export interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  pendingLabs: number;
  criticalAlerts: number;
  bedOccupancy: number;
  revenue: {
    today: number;
    month: number;
    year: number;
  };
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  priority: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
  expiresAt?: Date;
}

// Audit Log Types
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// Configuration Types
export interface SystemConfig {
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhone: string;
  hospitalEmail: string;
  timezone: string;
  currency: string;
  language: string;
  features: {
    aiPredictions: boolean;
    telehealth: boolean;
    mobileApp: boolean;
    analytics: boolean;
  };
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface CustomError extends Error {
  statusCode: number;
  isOperational: boolean;
  validationErrors?: ValidationError[];
}