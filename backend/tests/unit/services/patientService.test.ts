import { PatientService } from '../../../src/services/PatientService';
import { PatientModel } from '../../../src/models/Patient';
import { AppError } from '../../../src/utils/AppError';

// Mock the Patient model
jest.mock('../../../src/models/Patient');

const mockPatient = PatientModel as jest.Mocked<typeof PatientModel>;

describe('PatientService', () => {
  let patientService: PatientService;

  beforeEach(() => {
    patientService = new PatientService();
    jest.clearAllMocks();
  });

  describe('createPatient', () => {
    const patientData = {
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: new Date('1990-01-01'),
      gender: 'male' as const,
      phone: '+1234567890',
      email: 'john.doe@email.com',
      address: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zip_code: '12345',
      country: 'USA',
      emergency_contact_name: 'Jane Doe',
      emergency_contact_relationship: 'spouse',
      emergency_contact_phone: '+1234567891'
    };

    it('should create a patient successfully', async () => {
      const mockPatientResult = {
        id: 'patient123',
        ...patientData,
        mrn: 'PAT-20231201-0001',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPatient.findByEmail = jest.fn().mockResolvedValue(null);
      mockPatient.create = jest.fn().mockResolvedValue(mockPatientResult);

      const result = await patientService.createPatient(patientData);

      expect(mockPatient.findByEmail).toHaveBeenCalledWith(patientData.email);
      expect(mockPatient.create).toHaveBeenCalledWith(patientData);
      expect(result).toEqual(mockPatientResult);
    });

    it('should throw error if patient with email already exists', async () => {
      const existingPatient = { id: 'existing123', email: patientData.email };
      mockPatient.findByEmail = jest.fn().mockResolvedValue(existingPatient);

      await expect(patientService.createPatient(patientData)).rejects.toThrow(
        new AppError('Patient with this email already exists', 400)
      );

      expect(mockPatient.findByEmail).toHaveBeenCalledWith(patientData.email);
      expect(mockPatient.create).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPatient.findByEmail = jest.fn().mockResolvedValue(null);
      mockPatient.create = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(patientService.createPatient(patientData)).rejects.toThrow(
        new AppError('Failed to create patient', 500)
      );
    });
  });

  describe('getPatientById', () => {
    it('should return patient when found', async () => {
      const mockPatientResult = {
        id: 'patient123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@email.com'
      };

      mockPatient.findById = jest.fn().mockResolvedValue(mockPatientResult);

      const result = await patientService.getPatientById('patient123');

      expect(mockPatient.findById).toHaveBeenCalledWith('patient123');
      expect(result).toEqual(mockPatientResult);
    });

    it('should return null when patient not found', async () => {
      mockPatient.findById = jest.fn().mockResolvedValue(null);

      const result = await patientService.getPatientById('nonexistent');

      expect(mockPatient.findById).toHaveBeenCalledWith('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getPatientByPatientId', () => {
    it('should return patient when found by MRN', async () => {
      const mockPatientResult = {
        id: 'patient123',
        mrn: 'PAT-20231201-0001',
        first_name: 'John',
        last_name: 'Doe'
      };

      mockPatient.findByMRN = jest.fn().mockResolvedValue(mockPatientResult);

      const result = await patientService.getPatientByPatientId('PAT-20231201-0001');

      expect(mockPatient.findByMRN).toHaveBeenCalledWith('PAT-20231201-0001');
      expect(result).toEqual(mockPatientResult);
    });

    it('should return null when patient not found by MRN', async () => {
      mockPatient.findByMRN = jest.fn().mockResolvedValue(null);

      const result = await patientService.getPatientByPatientId('nonexistent');

      expect(mockPatient.findByMRN).toHaveBeenCalledWith('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updatePatient', () => {
    const updateData = {
      first_name: 'Jane',
      phone: '+9876543210'
    };

    it('should update patient successfully', async () => {
      const existingPatient = {
        id: 'patient123',
        email: 'john.doe@email.com',
        first_name: 'John'
      };
      const updatedPatient = { ...existingPatient, ...updateData };

      mockPatient.findById = jest.fn().mockResolvedValue(existingPatient);
      mockPatient.update = jest.fn().mockResolvedValue(updatedPatient);

      const result = await patientService.updatePatient('patient123', updateData);

      expect(mockPatient.findById).toHaveBeenCalledWith('patient123');
      expect(mockPatient.update).toHaveBeenCalledWith('patient123', updateData);
      expect(result).toEqual(updatedPatient);
    });

    it('should throw error if patient not found', async () => {
      mockPatient.findById = jest.fn().mockResolvedValue(null);

      await expect(patientService.updatePatient('nonexistent', updateData)).rejects.toThrow(
        new AppError('Patient not found', 404)
      );

      expect(mockPatient.update).not.toHaveBeenCalled();
    });

    it('should check email uniqueness when updating email', async () => {
      const existingPatient = {
        id: 'patient123',
        email: 'john.doe@email.com'
      };
      const updateWithEmail = { email: 'new.email@email.com' };
      const conflictingPatient = { id: 'other123', email: 'new.email@email.com' };

      mockPatient.findById = jest.fn().mockResolvedValue(existingPatient);
      mockPatient.findByEmail = jest.fn().mockResolvedValue(conflictingPatient);

      await expect(patientService.updatePatient('patient123', updateWithEmail)).rejects.toThrow(
        new AppError('Email already in use by another patient', 400)
      );

      expect(mockPatient.update).not.toHaveBeenCalled();
    });
  });

  describe('deletePatient', () => {
    it('should soft delete patient successfully', async () => {
      const existingPatient = { id: 'patient123', first_name: 'John' };

      mockPatient.findById = jest.fn().mockResolvedValue(existingPatient);
      mockPatient.delete = jest.fn().mockResolvedValue(true);

      const result = await patientService.deletePatient('patient123');

      expect(mockPatient.findById).toHaveBeenCalledWith('patient123');
      expect(mockPatient.delete).toHaveBeenCalledWith('patient123');
      expect(result).toBe(true);
    });

    it('should throw error if patient not found', async () => {
      mockPatient.findById = jest.fn().mockResolvedValue(null);

      await expect(patientService.deletePatient('nonexistent')).rejects.toThrow(
        new AppError('Patient not found', 404)
      );

      expect(mockPatient.delete).not.toHaveBeenCalled();
    });
  });

  describe('getAllPatients', () => {
    it('should return paginated patients', async () => {
      const mockPatients = [
        { id: 'patient1', first_name: 'John', last_name: 'Doe' },
        { id: 'patient2', first_name: 'Jane', last_name: 'Smith' }
      ];
      const mockResult = { patients: mockPatients, total: 2 };

      mockPatient.findAll = jest.fn().mockResolvedValue(mockResult);

      const result = await patientService.getAllPatients({}, 1, 10);

      expect(mockPatient.findAll).toHaveBeenCalledWith({}, 10, 0);
      expect(result).toEqual({
        patients: mockPatients,
        total: 2,
        page: 1,
        totalPages: 1
      });
    });

    it('should handle search query', async () => {
      const filters = { search: 'John' };
      const mockResult = { patients: [], total: 0 };

      mockPatient.findAll = jest.fn().mockResolvedValue(mockResult);

      await patientService.getAllPatients(filters, 1, 10);

      expect(mockPatient.findAll).toHaveBeenCalledWith(filters, 10, 0);
    });
  });

  describe('addMedicalHistory', () => {
    const medicalHistory = {
      condition: 'Hypertension',
      diagnosedDate: new Date('2023-01-01'),
      status: 'active',
      notes: 'Controlled with medication'
    };

    it('should add medical history successfully', async () => {
      const existingPatient = { id: 'patient123', first_name: 'John' };
      const updatedPatient = { ...existingPatient, medicalHistory: [medicalHistory] };

      mockPatient.findById = jest.fn().mockResolvedValue(existingPatient);
      mockPatient.addMedicalHistory = jest.fn().mockResolvedValue(updatedPatient);

      const result = await patientService.addMedicalHistory('patient123', medicalHistory);

      expect(mockPatient.findById).toHaveBeenCalledWith('patient123');
      expect(mockPatient.addMedicalHistory).toHaveBeenCalledWith('patient123', medicalHistory);
      expect(result).toEqual(updatedPatient);
    });

    it('should throw error if patient not found', async () => {
      mockPatient.findById = jest.fn().mockResolvedValue(null);

      await expect(patientService.addMedicalHistory('nonexistent', medicalHistory)).rejects.toThrow(
        new AppError('Patient not found', 404)
      );

      expect(mockPatient.addMedicalHistory).not.toHaveBeenCalled();
    });
  });

  describe('addAllergy', () => {
    const allergy = {
      allergen: 'Penicillin',
      severity: 'severe',
      reaction: 'Anaphylaxis',
      notes: 'Avoid all penicillin-based antibiotics'
    };

    it('should add allergy successfully', async () => {
      const existingPatient = { id: 'patient123', first_name: 'John' };
      const updatedPatient = { ...existingPatient, allergies: [allergy] };

      mockPatient.findById = jest.fn().mockResolvedValue(existingPatient);
      mockPatient.addAllergy = jest.fn().mockResolvedValue(updatedPatient);

      const result = await patientService.addAllergy('patient123', allergy);

      expect(mockPatient.findById).toHaveBeenCalledWith('patient123');
      expect(mockPatient.addAllergy).toHaveBeenCalledWith('patient123', allergy);
      expect(result).toEqual(updatedPatient);
    });

    it('should throw error if patient not found', async () => {
      mockPatient.findById = jest.fn().mockResolvedValue(null);

      await expect(patientService.addAllergy('nonexistent', allergy)).rejects.toThrow(
        new AppError('Patient not found', 404)
      );

      expect(mockPatient.addAllergy).not.toHaveBeenCalled();
    });
  });

  describe('getPatientStatistics', () => {
    it('should return patient statistics', async () => {
      const mockStats = {
        total: 100,
        active: 95,
        inactive: 5,
        byGender: { male: 50, female: 45, other: 5 },
        byAgeGroup: { '0-18': 20, '19-65': 60, '65+': 20 }
      };

      mockPatient.getStatistics = jest.fn().mockResolvedValue(mockStats);

      const result = await patientService.getPatientStatistics();

      expect(mockPatient.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('should handle empty statistics', async () => {
      const emptyStats = {
        total: 0,
        active: 0,
        inactive: 0,
        byGender: { male: 0, female: 0, other: 0 },
        byAgeGroup: {}
      };

      mockPatient.getStatistics = jest.fn().mockResolvedValue(emptyStats);

      const result = await patientService.getPatientStatistics();

      expect(result).toEqual(emptyStats);
    });
  });
});