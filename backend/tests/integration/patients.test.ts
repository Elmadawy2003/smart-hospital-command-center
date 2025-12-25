import request from 'supertest';
import { app } from '../../src/index';
import { UserModel } from '../../src/models/User';
import { PatientModel } from '../../src/models/Patient';
import { connectTestDB, closeTestDB, clearTestDB, createTestUser, generateAuthToken } from '../setup';

describe('Patients API Integration Tests', () => {
  let authToken: string;
  let doctorUser: any;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    
    // Create a doctor user for authentication
    doctorUser = await createTestUser({
      first_name: 'Dr. John',
      last_name: 'Smith',
      email: 'dr.smith@hospital.com',
      role: 'doctor',
      department: 'cardiology'
    });
    
    authToken = generateAuthToken(doctorUser._id);
  });

  describe('POST /api/patients', () => {
    const validPatientData = {
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: '1990-01-01',
      gender: 'male',
      phone: '+1234567890',
      email: 'john.doe@email.com',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345',
        country: 'USA'
      },
      emergency_contact: {
        name: 'Jane Doe',
        relationship: 'spouse',
        phone: '+1234567891'
      }
    };

    it('should create a new patient successfully', async () => {
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPatientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patient).toHaveProperty('_id');
      expect(response.body.data.patient).toHaveProperty('patientId');
      expect(response.body.data.patient.first_name).toBe(validPatientData.first_name);
      expect(response.body.data.patient.last_name).toBe(validPatientData.last_name);
      expect(response.body.data.patient.email).toBe(validPatientData.email);
      expect(response.body.data.patient.status).toBe('active');

      // Verify patient was created in database
      const patient = await PatientModel.findByEmail(validPatientData.email);
      expect(patient).toBeTruthy();
      expect(patient?.patient_id).toMatch(/^PAT-\d{8}-\d{4}$/);
    });

    it('should not create patient with duplicate email', async () => {
      // Create patient first
      await PatientModel.create(validPatientData);

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validPatientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        firstName: 'John'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/patients')
        .send(validPatientData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...validPatientData,
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidEmailData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate phone format', async () => {
      const invalidPhoneData = {
        ...validPatientData,
        phone: 'invalid-phone'
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPhoneData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/patients', () => {
    beforeEach(async () => {
      // Create test patients
      const patients = [
        {
          first_name: 'John',
          last_name: 'Doe',
          date_of_birth: new Date('1990-01-01'),
          gender: 'male',
          phone: '+1234567890',
          email: 'john.doe@email.com'
        },
        {
          first_name: 'Jane',
          last_name: 'Smith',
          date_of_birth: new Date('1985-05-15'),
          gender: 'female',
          phone: '+1234567891',
          email: 'jane.smith@email.com'
        },
        {
          first_name: 'Bob',
          last_name: 'Johnson',
          date_of_birth: new Date('1975-12-25'),
          gender: 'male',
          phone: '+1234567892',
          email: 'bob.johnson@email.com',
          status: 'inactive'
        }
      ];

      await PatientModel.create(patients[0]);
      await PatientModel.create(patients[1]);
      await PatientModel.create(patients[2]);
    });

    it('should get all active patients with pagination', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patients).toHaveLength(2); // Only active patients
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.totalPages).toBe(1);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/patients?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patients).toHaveLength(1);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.totalPages).toBe(2);
    });

    it('should support search by name', async () => {
      const response = await request(app)
        .get('/api/patients?search=Jane')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patients).toHaveLength(1);
      expect(response.body.data.patients[0].firstName).toBe('Jane');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/patients')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/patients/:id', () => {
    let patientId: string;

    beforeEach(async () => {
      const patient = await PatientModel.create({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: new Date('1990-01-01'),
        gender: 'male',
        phone: '+1234567890',
        email: 'john.doe@email.com',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+1234567891',
        emergency_contact_relationship: 'spouse'
      });
      patientId = patient.id;
    });

    it('should get patient by ID', async () => {
      const response = await request(app)
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patient._id).toBe(patientId);
      expect(response.body.data.patient.firstName).toBe('John');
      expect(response.body.data.patient.lastName).toBe('Doe');
    });

    it('should return 404 for non-existent patient', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/patients/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid patient ID', async () => {
      const response = await request(app)
        .get('/api/patients/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/patients/${patientId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/patients/:id', () => {
    let patientId: string;

    beforeEach(async () => {
      const patient = await PatientModel.create({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: new Date('1990-01-01'),
        gender: 'male',
        phone: '+1234567890',
        email: 'john.doe@email.com',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+1234567891',
        emergency_contact_relationship: 'spouse'
      });
      patientId = patient.id;
    });

    it('should update patient successfully', async () => {
      const updateData = {
        firstName: 'Jane',
        phone: '+1234567899'
      };

      const response = await request(app)
        .put(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patient.firstName).toBe(updateData.firstName);
      expect(response.body.data.patient.phone).toBe(updateData.phone);

      // Verify update in database
      const updatedPatient = await Patient.findById(patientId);
      expect(updatedPatient?.firstName).toBe(updateData.firstName);
      expect(updatedPatient?.phone).toBe(updateData.phone);
    });

    it('should return 404 for non-existent patient', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .put(`/api/patients/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: 'Jane' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should validate email uniqueness', async () => {
      // Create another patient
      await Patient.create({
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: new Date('1985-01-01'),
        gender: 'female',
        phone: '+1234567891',
        email: 'jane.smith@email.com'
      });

      const response = await request(app)
        .put(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'jane.smith@email.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/patients/${patientId}`)
        .send({ firstName: 'Jane' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/patients/:id', () => {
    let patientId: string;

    beforeEach(async () => {
      const patient = await PatientModel.create({
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
        emergency_contact_phone: '+1234567891',
        emergency_contact_relationship: 'spouse'
      });
      patientId = patient.id;
    });

    it('should soft delete patient successfully', async () => {
      const response = await request(app)
        .delete(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify soft delete in database
      const deletedPatient = await Patient.findById(patientId);
      expect(deletedPatient?.isActive).toBe(false);
    });

    it('should return 404 for non-existent patient', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .delete(`/api/patients/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/patients/${patientId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/patients/:id/medical-history', () => {
    let patientId: string;

    beforeEach(async () => {
      const patient = await PatientModel.create({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: new Date('1990-01-01'),
        gender: 'male',
        phone: '+1234567890',
        email: 'john.doe@email.com',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+1234567891',
        emergency_contact_relationship: 'spouse'
      });
      patientId = patient.id;
    });

    it('should add medical history successfully', async () => {
      const medicalHistory = {
        condition: 'Hypertension',
        diagnosedDate: '2020-01-01',
        status: 'active',
        notes: 'Controlled with medication'
      };

      const response = await request(app)
        .post(`/api/patients/${patientId}/medical-history`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(medicalHistory)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patient.medicalHistory).toHaveLength(1);
      expect(response.body.data.patient.medicalHistory[0].condition).toBe(medicalHistory.condition);

      // Verify in database
      const updatedPatient = await PatientModel.findById(patientId);
      expect(updatedPatient?.medical_conditions).toHaveLength(1);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        condition: 'Hypertension'
        // Missing required fields
      };

      const response = await request(app)
        .post(`/api/patients/${patientId}/medical-history`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/patients/${patientId}/medical-history`)
        .send({ condition: 'Hypertension' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/patients/:id/allergies', () => {
    let patientId: string;

    beforeEach(async () => {
      const patient = await PatientModel.create({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: new Date('1990-01-01'),
        gender: 'male',
        phone: '+1234567890',
        email: 'john.doe@email.com',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+1234567891',
        emergency_contact_relationship: 'spouse'
      });
      patientId = patient.id;
    });

    it('should add allergy successfully', async () => {
      const allergy = {
        allergen: 'Penicillin',
        severity: 'severe',
        reaction: 'Anaphylaxis',
        notes: 'Avoid all penicillin-based antibiotics'
      };

      const response = await request(app)
        .post(`/api/patients/${patientId}/allergies`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(allergy)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.patient.allergies).toHaveLength(1);
      expect(response.body.data.patient.allergies[0].allergen).toBe(allergy.allergen);

      // Verify in database
      const updatedPatient = await PatientModel.findById(patientId);
      expect(updatedPatient?.allergies).toHaveLength(1);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        allergen: 'Penicillin'
        // Missing required fields
      };

      const response = await request(app)
        .post(`/api/patients/${patientId}/allergies`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/patients/${patientId}/allergies`)
        .send({ allergen: 'Penicillin' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/patients/statistics', () => {
    beforeEach(async () => {
      // Create test patients
      await PatientModel.create({
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: new Date('1990-01-01'),
        gender: 'male',
        phone: '+1234567890',
        email: 'john.doe@email.com',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '+1234567891',
        emergency_contact_relationship: 'spouse'
      });

      await PatientModel.create({
        first_name: 'Jane',
        last_name: 'Smith',
        date_of_birth: new Date('1985-05-15'),
        gender: 'female',
        phone: '+1234567891',
        email: 'jane.smith@email.com',
        address: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        zip_code: '90001',
        country: 'USA',
        emergency_contact_name: 'John Smith',
        emergency_contact_phone: '+1234567892',
        emergency_contact_relationship: 'spouse'
      });

      await PatientModel.create({
        first_name: 'Bob',
        last_name: 'Johnson',
        date_of_birth: new Date('1975-12-25'),
        gender: 'male',
        phone: '+1234567892',
        email: 'bob.johnson@email.com',
        address: '789 Pine St',
        city: 'Chicago',
        state: 'IL',
        zip_code: '60001',
        country: 'USA',
        emergency_contact_name: 'Alice Johnson',
        emergency_contact_phone: '+1234567893',
        emergency_contact_relationship: 'spouse'
      });
    });

    it('should get patient statistics', async () => {
      const response = await request(app)
        .get('/api/patients/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics.total).toBe(3);
      expect(response.body.data.statistics.active).toBe(2);
      expect(response.body.data.statistics.inactive).toBe(1);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/patients/statistics')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});