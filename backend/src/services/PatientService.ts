import { PatientModel, Patient, CreatePatientData, UpdatePatientData, PatientFilters } from '../models/Patient';
import { AppError } from '../utils/AppError';

export class PatientService {
  /**
   * Create a new patient
   */
  async createPatient(patientData: CreatePatientData): Promise<Patient> {
    try {
      // Check if patient with email already exists
      const existingPatient = await PatientModel.findByEmail(patientData.email);
      if (existingPatient) {
        throw new AppError('Patient with this email already exists', 400);
      }

      return await PatientModel.create(patientData);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create patient', 500);
    }
  }

  /**
   * Get patient by ID
   */
  async getPatientById(id: string): Promise<Patient | null> {
    try {
      return await PatientModel.findById(id);
    } catch (error) {
      throw new AppError('Failed to get patient', 500);
    }
  }

  /**
   * Get patient by patient ID (MRN)
   */
  async getPatientByPatientId(patientId: string): Promise<Patient | null> {
    try {
      return await PatientModel.findByMRN(patientId);
    } catch (error) {
      throw new AppError('Failed to get patient', 500);
    }
  }

  /**
   * Update patient
   */
  async updatePatient(id: string, updateData: UpdatePatientData): Promise<Patient> {
    try {
      const patient = await PatientModel.findById(id);
      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      // Check email uniqueness if email is being updated
      if (updateData.email && updateData.email !== patient.email) {
        const existingPatient = await PatientModel.findByEmail(updateData.email);
        if (existingPatient && existingPatient.id !== id) {
          throw new AppError('Email already in use by another patient', 400);
        }
      }

      return await PatientModel.update(id, updateData);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update patient', 500);
    }
  }

  /**
   * Delete patient (soft delete)
   */
  async deletePatient(id: string): Promise<boolean> {
    try {
      const patient = await PatientModel.findById(id);
      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      return await PatientModel.delete(id);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete patient', 500);
    }
  }

  /**
   * Get all patients with filters and pagination
   */
  async getAllPatients(
    filters: PatientFilters = {},
    page: number = 1,
    limit: number = 10
  ): Promise<{ patients: Patient[]; total: number; page: number; totalPages: number }> {
    try {
      const offset = (page - 1) * limit;
      const { patients, total } = await PatientModel.findAll(filters, limit, offset);
      
      return {
        patients,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new AppError('Failed to get patients', 500);
    }
  }

  /**
   * Add medical history to patient
   */
  async addMedicalHistory(
    patientId: string,
    medicalHistory: { condition: string; diagnosedDate: Date; status: string; notes?: string }
  ): Promise<Patient> {
    try {
      const patient = await PatientModel.findById(patientId);
      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      return await PatientModel.addMedicalHistory(patientId, medicalHistory);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to add medical history', 500);
    }
  }

  /**
   * Add allergy to patient
   */
  async addAllergy(
    patientId: string,
    allergy: { allergen: string; severity: string; reaction?: string; notes?: string }
  ): Promise<Patient> {
    try {
      const patient = await PatientModel.findById(patientId);
      if (!patient) {
        throw new AppError('Patient not found', 404);
      }

      return await PatientModel.addAllergy(patientId, allergy);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to add allergy', 500);
    }
  }

  /**
   * Get patient statistics
   */
  async getPatientStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byGender: { male: number; female: number; other: number };
    byAgeGroup: { [key: string]: number };
  }> {
    try {
      return await PatientModel.getStatistics();
    } catch (error) {
      throw new AppError('Failed to get patient statistics', 500);
    }
  }
}