import { Patient, PatientModel } from '../../../src/models/Patient';
import { testHelper } from '../../setup';

describe('Patient Model', () => {
  beforeEach(async () => {
    await testHelper.clearDatabase();
  });

  describe('Patient Interface', () => {
    it('should define correct patient interface structure', () => {
      const patientData: Patient = {
        id: 'patient123',
        mrn: 'PAT-20231201-0001',
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: new Date('1990-01-01'),
        gender: 'male',
        phone: '+1234567890',
        email: 'john.doe@email.com',
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip_code: '12345',
        country: 'USA',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_relationship: 'spouse',
        emergency_contact_phone: '+1234567891',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(patientData).toBeDefined();
      expect(patientData.first_name).toBe('John');
      expect(patientData.last_name).toBe('Doe');
      expect(patientData.email).toBe('john.doe@email.com');
      expect(patientData.gender).toBe('male');
      expect(patientData.status).toBe('active');
    });
  });

  describe('PatientModel.create', () => {
    it('should create a patient with valid data', async () => {
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

      const patient = await PatientModel.create(patientData);

      expect(patient).toBeDefined();
      expect(patient.id).toBeDefined();
      expect(patient.mrn).toBeDefined();
      expect(patient.first_name).toBe(patientData.first_name);
      expect(patient.last_name).toBe(patientData.last_name);
      expect(patient.email).toBe(patientData.email);
      expect(patient.status).toBe('active');
      expect(patient.created_at).toBeDefined();
      expect(patient.updated_at).toBeDefined();
    });

    it('should generate unique MRN for each patient', async () => {
      const patientData1 = {
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

      const patientData2 = {
        ...patientData1,
        email: 'jane.doe@email.com',
        first_name: 'Jane'
      };

      const patient1 = await PatientModel.create(patientData1);
      const patient2 = await PatientModel.create(patientData2);

      expect(patient1.mrn).toBeDefined();
      expect(patient2.mrn).toBeDefined();
      expect(patient1.mrn).not.toBe(patient2.mrn);
    });

    it('should throw error for duplicate email', async () => {
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

      await PatientModel.create(patientData);

      await expect(PatientModel.create(patientData)).rejects.toThrow();
    });
  });

  describe('PatientModel.findById', () => {
    it('should find patient by id', async () => {
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

      const createdPatient = await PatientModel.create(patientData);
      const foundPatient = await PatientModel.findById(createdPatient.id);

      expect(foundPatient).toBeDefined();
      expect(foundPatient?.id).toBe(createdPatient.id);
      expect(foundPatient?.first_name).toBe(patientData.first_name);
      expect(foundPatient?.email).toBe(patientData.email);
    });

    it('should return null for non-existent id', async () => {
      const foundPatient = await PatientModel.findById('nonexistent-id');
      expect(foundPatient).toBeNull();
    });
  });

  describe('PatientModel.findByEmail', () => {
    it('should find patient by email', async () => {
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

      const createdPatient = await PatientModel.create(patientData);
      const foundPatient = await PatientModel.findByEmail(patientData.email);

      expect(foundPatient).toBeDefined();
      expect(foundPatient?.id).toBe(createdPatient.id);
      expect(foundPatient?.email).toBe(patientData.email);
    });

    it('should return null for non-existent email', async () => {
      const foundPatient = await PatientModel.findByEmail('nonexistent@email.com');
      expect(foundPatient).toBeNull();
    });
  });

  describe('PatientModel.findByMRN', () => {
    it('should find patient by MRN', async () => {
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

      const createdPatient = await PatientModel.create(patientData);
      const foundPatient = await PatientModel.findByMRN(createdPatient.mrn);

      expect(foundPatient).toBeDefined();
      expect(foundPatient?.id).toBe(createdPatient.id);
      expect(foundPatient?.mrn).toBe(createdPatient.mrn);
    });

    it('should return null for non-existent MRN', async () => {
      const foundPatient = await PatientModel.findByMRN('PAT-NONEXISTENT');
      expect(foundPatient).toBeNull();
    });
  });

  describe('PatientModel.update', () => {
    it('should update patient successfully', async () => {
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

      const createdPatient = await PatientModel.create(patientData);
      const updateData = {
        first_name: 'Jane',
        phone: '+9876543210'
      };

      const updatedPatient = await PatientModel.update(createdPatient.id, updateData);

      expect(updatedPatient).toBeDefined();
      expect(updatedPatient?.first_name).toBe(updateData.first_name);
      expect(updatedPatient?.phone).toBe(updateData.phone);
      expect(updatedPatient?.last_name).toBe(patientData.last_name); // unchanged
      expect(updatedPatient?.updated_at).toBeDefined();
    });

    it('should return null when updating non-existent patient', async () => {
      const updateData = { first_name: 'Jane' };
      const updatedPatient = await PatientModel.update('nonexistent-id', updateData);
      expect(updatedPatient).toBeNull();
    });
  });

  describe('PatientModel.delete', () => {
    it('should soft delete patient', async () => {
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

      const createdPatient = await PatientModel.create(patientData);
      const deleteResult = await PatientModel.delete(createdPatient.id);

      expect(deleteResult).toBe(true);

      // Verify patient is soft deleted
      const foundPatient = await PatientModel.findById(createdPatient.id);
      expect(foundPatient?.status).toBe('inactive');
    });

    it('should return false when deleting non-existent patient', async () => {
      const deleteResult = await PatientModel.delete('nonexistent-id');
      expect(deleteResult).toBe(false);
    });
  });

  describe('PatientModel.findAll', () => {
    beforeEach(async () => {
      // Create test patients
      const patients = [
        {
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
        },
        {
          first_name: 'Jane',
          last_name: 'Smith',
          date_of_birth: new Date('1985-05-15'),
          gender: 'female' as const,
          phone: '+1234567892',
          email: 'jane.smith@email.com',
          address: '456 Oak Ave',
          city: 'Anytown',
          state: 'CA',
          zip_code: '12345',
          country: 'USA',
          emergency_contact_name: 'John Smith',
          emergency_contact_relationship: 'spouse',
          emergency_contact_phone: '+1234567893'
        }
      ];

      for (const patientData of patients) {
        await PatientModel.create(patientData);
      }
    });

    it('should return all active patients', async () => {
      const result = await PatientModel.findAll({}, 10, 0);

      expect(result.patients).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.patients[0].status).toBe('active');
      expect(result.patients[1].status).toBe('active');
    });

    it('should support pagination', async () => {
      const result = await PatientModel.findAll({}, 1, 0);

      expect(result.patients).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('should support search by name', async () => {
      const result = await PatientModel.findAll({ search: 'John' }, 10, 0);

      expect(result.patients).toHaveLength(1);
      expect(result.patients[0].first_name).toBe('John');
    });

    it('should support filtering by gender', async () => {
      const result = await PatientModel.findAll({ gender: 'female' }, 10, 0);

      expect(result.patients).toHaveLength(1);
      expect(result.patients[0].gender).toBe('female');
    });
  });

  describe('PatientModel.getStatistics', () => {
    beforeEach(async () => {
      // Create test patients with different demographics
      const patients = [
        {
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
        },
        {
          first_name: 'Jane',
          last_name: 'Smith',
          date_of_birth: new Date('1985-05-15'),
          gender: 'female' as const,
          phone: '+1234567892',
          email: 'jane.smith@email.com',
          address: '456 Oak Ave',
          city: 'Anytown',
          state: 'CA',
          zip_code: '12345',
          country: 'USA',
          emergency_contact_name: 'John Smith',
          emergency_contact_relationship: 'spouse',
          emergency_contact_phone: '+1234567893'
        },
        {
          first_name: 'Bob',
          last_name: 'Johnson',
          date_of_birth: new Date('1950-12-25'),
          gender: 'male' as const,
          phone: '+1234567894',
          email: 'bob.johnson@email.com',
          address: '789 Pine St',
          city: 'Anytown',
          state: 'CA',
          zip_code: '12345',
          country: 'USA',
          emergency_contact_name: 'Mary Johnson',
          emergency_contact_relationship: 'spouse',
          emergency_contact_phone: '+1234567895'
        }
      ];

      for (const patientData of patients) {
        await PatientModel.create(patientData);
      }
    });

    it('should return correct patient statistics', async () => {
      const stats = await PatientModel.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(3);
      expect(stats.inactive).toBe(0);
      expect(stats.byGender.male).toBe(2);
      expect(stats.byGender.female).toBe(1);
      expect(stats.byAgeGroup).toBeDefined();
    });
  });
});