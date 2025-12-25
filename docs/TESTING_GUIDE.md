# دليل الاختبار الشامل - نظام إدارة المستشفيات

## نظرة عامة

هذا الدليل يوفر إطار عمل شامل لاختبار نظام إدارة المستشفيات، بما يشمل اختبارات الوحدة، اختبارات التكامل، اختبارات الأداء، واختبارات الأمان.

## أنواع الاختبارات

### 1. اختبارات الوحدة (Unit Tests)
### 2. اختبارات التكامل (Integration Tests)
### 3. اختبارات واجهة المستخدم (UI Tests)
### 4. اختبارات الأداء (Performance Tests)
### 5. اختبارات الأمان (Security Tests)
### 6. اختبارات قبول المستخدم (User Acceptance Tests)

---

## إعداد بيئة الاختبار

### متطلبات النظام

```bash
# تثبيت أدوات الاختبار
npm install --save-dev jest supertest cypress artillery
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev eslint-plugin-testing-library
```

### إعداد Jest للاختبارات

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/src/**/__tests__/**/*.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000
};
```

### إعداد قاعدة بيانات الاختبار

```javascript
// tests/setup.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
```

---

## اختبارات الوحدة (Unit Tests)

### اختبار نماذج قاعدة البيانات

```javascript
// tests/models/patient.test.js
const Patient = require('../../src/models/Patient');

describe('Patient Model', () => {
  describe('Validation', () => {
    test('should create a valid patient', async () => {
      const patientData = {
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '1234567890',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        phone: '0501234567',
        email: 'ahmed@example.com',
        address: {
          street: 'شارع الملك فهد',
          city: 'الرياض',
          postalCode: '12345'
        }
      };

      const patient = new Patient(patientData);
      const savedPatient = await patient.save();

      expect(savedPatient._id).toBeDefined();
      expect(savedPatient.firstName).toBe('أحمد');
      expect(savedPatient.nationalId).toBe('1234567890');
    });

    test('should fail without required fields', async () => {
      const patient = new Patient({});
      
      await expect(patient.save()).rejects.toThrow();
    });

    test('should validate national ID format', async () => {
      const patientData = {
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '123', // رقم هوية غير صحيح
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male'
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });

    test('should validate email format', async () => {
      const patientData = {
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '1234567890',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        email: 'invalid-email' // بريد إلكتروني غير صحيح
      };

      const patient = new Patient(patientData);
      
      await expect(patient.save()).rejects.toThrow();
    });
  });

  describe('Methods', () => {
    test('should calculate age correctly', () => {
      const patient = new Patient({
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '1234567890',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male'
      });

      const age = patient.getAge();
      const expectedAge = new Date().getFullYear() - 1990;
      
      expect(age).toBe(expectedAge);
    });

    test('should get full name', () => {
      const patient = new Patient({
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '1234567890',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male'
      });

      expect(patient.getFullName()).toBe('أحمد محمد');
    });
  });
});
```

### اختبار الخدمات (Services)

```javascript
// tests/services/patientService.test.js
const PatientService = require('../../src/services/patientService');
const Patient = require('../../src/models/Patient');

describe('Patient Service', () => {
  let patientService;

  beforeEach(() => {
    patientService = new PatientService();
  });

  describe('createPatient', () => {
    test('should create a new patient', async () => {
      const patientData = {
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '1234567890',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        phone: '0501234567'
      };

      const result = await patientService.createPatient(patientData);

      expect(result.success).toBe(true);
      expect(result.patient).toBeDefined();
      expect(result.patient.firstName).toBe('أحمد');
    });

    test('should not create patient with duplicate national ID', async () => {
      const patientData = {
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '1234567890',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male'
      };

      // إنشاء المريض الأول
      await patientService.createPatient(patientData);

      // محاولة إنشاء مريض آخر بنفس رقم الهوية
      const result = await patientService.createPatient(patientData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('رقم الهوية موجود مسبقاً');
    });
  });

  describe('searchPatients', () => {
    beforeEach(async () => {
      // إنشاء بيانات تجريبية
      await Patient.create([
        {
          firstName: 'أحمد',
          lastName: 'محمد',
          nationalId: '1234567890',
          dateOfBirth: new Date('1990-01-01'),
          gender: 'male'
        },
        {
          firstName: 'فاطمة',
          lastName: 'علي',
          nationalId: '0987654321',
          dateOfBirth: new Date('1985-05-15'),
          gender: 'female'
        }
      ]);
    });

    test('should search patients by name', async () => {
      const results = await patientService.searchPatients('أحمد');

      expect(results.length).toBe(1);
      expect(results[0].firstName).toBe('أحمد');
    });

    test('should search patients by national ID', async () => {
      const results = await patientService.searchPatients('1234567890');

      expect(results.length).toBe(1);
      expect(results[0].nationalId).toBe('1234567890');
    });

    test('should return empty array for no matches', async () => {
      const results = await patientService.searchPatients('غير موجود');

      expect(results.length).toBe(0);
    });
  });
});
```

### اختبار وحدات التحكم (Controllers)

```javascript
// tests/controllers/patientController.test.js
const request = require('supertest');
const app = require('../../src/app');
const Patient = require('../../src/models/Patient');
const jwt = require('jsonwebtoken');

describe('Patient Controller', () => {
  let authToken;

  beforeEach(async () => {
    // إنشاء رمز مصادقة للاختبار
    authToken = jwt.sign(
      { userId: 'test-user-id', role: 'doctor' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  describe('POST /api/patients', () => {
    test('should create a new patient', async () => {
      const patientData = {
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '1234567890',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        phone: '0501234567'
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.patient.firstName).toBe('أحمد');
    });

    test('should return 400 for invalid data', async () => {
      const invalidData = {
        firstName: 'أحمد'
        // بيانات ناقصة
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return 401 without authentication', async () => {
      const patientData = {
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '1234567890',
        dateOfBirth: '1990-01-01',
        gender: 'male'
      };

      await request(app)
        .post('/api/patients')
        .send(patientData)
        .expect(401);
    });
  });

  describe('GET /api/patients/:id', () => {
    test('should get patient by ID', async () => {
      const patient = await Patient.create({
        firstName: 'أحمد',
        lastName: 'محمد',
        nationalId: '1234567890',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male'
      });

      const response = await request(app)
        .get(`/api/patients/${patient._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.patient.firstName).toBe('أحمد');
    });

    test('should return 404 for non-existent patient', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      await request(app)
        .get(`/api/patients/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
```

---

## اختبارات التكامل (Integration Tests)

### اختبار تدفق العمل الكامل

```javascript
// tests/integration/appointment-workflow.test.js
const request = require('supertest');
const app = require('../../src/app');
const Patient = require('../../src/models/Patient');
const Doctor = require('../../src/models/Doctor');
const Appointment = require('../../src/models/Appointment');

describe('Appointment Workflow Integration', () => {
  let patient, doctor, authToken;

  beforeEach(async () => {
    // إنشاء بيانات تجريبية
    patient = await Patient.create({
      firstName: 'أحمد',
      lastName: 'محمد',
      nationalId: '1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male'
    });

    doctor = await Doctor.create({
      firstName: 'د. سارة',
      lastName: 'أحمد',
      specialization: 'internal_medicine',
      licenseNumber: 'DOC123456',
      email: 'dr.sara@hospital.com'
    });

    // إنشاء رمز مصادقة
    authToken = jwt.sign(
      { userId: doctor._id, role: 'doctor' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  test('should complete full appointment workflow', async () => {
    // 1. حجز موعد
    const appointmentData = {
      patientId: patient._id,
      doctorId: doctor._id,
      appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // غداً
      appointmentTime: '10:00',
      type: 'consultation',
      reason: 'فحص دوري'
    };

    const bookingResponse = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${authToken}`)
      .send(appointmentData)
      .expect(201);

    const appointmentId = bookingResponse.body.appointment._id;

    // 2. تأكيد الموعد
    await request(app)
      .patch(`/api/appointments/${appointmentId}/confirm`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // 3. بدء الموعد
    await request(app)
      .patch(`/api/appointments/${appointmentId}/start`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // 4. إضافة ملاحظات طبية
    const medicalNotes = {
      symptoms: 'صداع خفيف',
      diagnosis: 'توتر',
      treatment: 'راحة وأدوية مسكنة',
      prescriptions: [
        {
          medication: 'باراسيتامول',
          dosage: '500mg',
          frequency: 'كل 8 ساعات',
          duration: '3 أيام'
        }
      ]
    };

    await request(app)
      .patch(`/api/appointments/${appointmentId}/notes`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(medicalNotes)
      .expect(200);

    // 5. إنهاء الموعد
    const completeResponse = await request(app)
      .patch(`/api/appointments/${appointmentId}/complete`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // التحقق من النتيجة النهائية
    expect(completeResponse.body.appointment.status).toBe('completed');
    expect(completeResponse.body.appointment.medicalNotes).toBeDefined();
  });
});
```

### اختبار تكامل قاعدة البيانات

```javascript
// tests/integration/database-integration.test.js
const mongoose = require('mongoose');
const Patient = require('../../src/models/Patient');
const MedicalRecord = require('../../src/models/MedicalRecord');
const Appointment = require('../../src/models/Appointment');

describe('Database Integration', () => {
  test('should maintain referential integrity', async () => {
    // إنشاء مريض
    const patient = await Patient.create({
      firstName: 'أحمد',
      lastName: 'محمد',
      nationalId: '1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male'
    });

    // إنشاء سجل طبي
    const medicalRecord = await MedicalRecord.create({
      patientId: patient._id,
      date: new Date(),
      type: 'consultation',
      diagnosis: 'فحص دوري',
      treatment: 'لا يوجد',
      doctorId: new mongoose.Types.ObjectId()
    });

    // إنشاء موعد
    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: new mongoose.Types.ObjectId(),
      appointmentDate: new Date(),
      appointmentTime: '10:00',
      type: 'consultation',
      status: 'scheduled'
    });

    // التحقق من الروابط
    const foundPatient = await Patient.findById(patient._id)
      .populate('medicalRecords')
      .populate('appointments');

    expect(foundPatient.medicalRecords).toHaveLength(1);
    expect(foundPatient.appointments).toHaveLength(1);
  });

  test('should handle cascade deletion', async () => {
    const patient = await Patient.create({
      firstName: 'أحمد',
      lastName: 'محمد',
      nationalId: '1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male'
    });

    await MedicalRecord.create({
      patientId: patient._id,
      date: new Date(),
      type: 'consultation',
      diagnosis: 'فحص دوري',
      treatment: 'لا يوجد',
      doctorId: new mongoose.Types.ObjectId()
    });

    // حذف المريض
    await Patient.findByIdAndDelete(patient._id);

    // التحقق من حذف السجلات المرتبطة
    const orphanedRecords = await MedicalRecord.find({ patientId: patient._id });
    expect(orphanedRecords).toHaveLength(0);
  });
});
```

---

## اختبارات واجهة المستخدم (UI Tests)

### إعداد Cypress

```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.js',
    video: true,
    screenshot: true,
    viewportWidth: 1280,
    viewportHeight: 720
  }
});
```

### اختبارات تسجيل الدخول

```javascript
// cypress/e2e/auth.cy.js
describe('Authentication', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should login with valid credentials', () => {
    cy.get('[data-testid="email-input"]').type('doctor@hospital.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();

    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="user-menu"]').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.get('[data-testid="email-input"]').type('invalid@email.com');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-button"]').click();

    cy.get('[data-testid="error-message"]')
      .should('be.visible')
      .and('contain', 'بيانات الدخول غير صحيحة');
  });

  it('should validate required fields', () => {
    cy.get('[data-testid="login-button"]').click();

    cy.get('[data-testid="email-error"]')
      .should('be.visible')
      .and('contain', 'البريد الإلكتروني مطلوب');
    
    cy.get('[data-testid="password-error"]')
      .should('be.visible')
      .and('contain', 'كلمة المرور مطلوبة');
  });
});
```

### اختبارات إدارة المرضى

```javascript
// cypress/e2e/patients.cy.js
describe('Patient Management', () => {
  beforeEach(() => {
    // تسجيل الدخول
    cy.login('doctor@hospital.com', 'password123');
    cy.visit('/patients');
  });

  it('should create a new patient', () => {
    cy.get('[data-testid="add-patient-button"]').click();

    // ملء النموذج
    cy.get('[data-testid="first-name-input"]').type('أحمد');
    cy.get('[data-testid="last-name-input"]').type('محمد');
    cy.get('[data-testid="national-id-input"]').type('1234567890');
    cy.get('[data-testid="date-of-birth-input"]').type('1990-01-01');
    cy.get('[data-testid="gender-select"]').select('male');
    cy.get('[data-testid="phone-input"]').type('0501234567');

    cy.get('[data-testid="save-patient-button"]').click();

    // التحقق من النجاح
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'تم إضافة المريض بنجاح');

    // التحقق من ظهور المريض في القائمة
    cy.get('[data-testid="patients-table"]')
      .should('contain', 'أحمد محمد')
      .and('contain', '1234567890');
  });

  it('should search for patients', () => {
    // إنشاء مريض للبحث عنه
    cy.createPatient({
      firstName: 'فاطمة',
      lastName: 'علي',
      nationalId: '0987654321'
    });

    // البحث بالاسم
    cy.get('[data-testid="search-input"]').type('فاطمة');
    cy.get('[data-testid="search-button"]').click();

    cy.get('[data-testid="patients-table"]')
      .should('contain', 'فاطمة علي')
      .and('not.contain', 'أحمد محمد');

    // مسح البحث
    cy.get('[data-testid="clear-search-button"]').click();
    cy.get('[data-testid="patients-table"]')
      .should('contain', 'فاطمة علي');
  });

  it('should edit patient information', () => {
    cy.createPatient({
      firstName: 'سعد',
      lastName: 'الأحمد',
      nationalId: '1122334455'
    });

    // فتح نموذج التعديل
    cy.get('[data-testid="edit-patient-1122334455"]').click();

    // تعديل البيانات
    cy.get('[data-testid="phone-input"]').clear().type('0509876543');
    cy.get('[data-testid="email-input"]').type('saad@example.com');

    cy.get('[data-testid="save-patient-button"]').click();

    // التحقق من التحديث
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'تم تحديث بيانات المريض');
  });
});
```

### اختبارات الاستجابة (Responsive Tests)

```javascript
// cypress/e2e/responsive.cy.js
describe('Responsive Design', () => {
  const viewports = [
    { device: 'mobile', width: 375, height: 667 },
    { device: 'tablet', width: 768, height: 1024 },
    { device: 'desktop', width: 1280, height: 720 }
  ];

  viewports.forEach(({ device, width, height }) => {
    describe(`${device} viewport`, () => {
      beforeEach(() => {
        cy.viewport(width, height);
        cy.login('doctor@hospital.com', 'password123');
      });

      it('should display navigation correctly', () => {
        cy.visit('/dashboard');

        if (device === 'mobile') {
          // في الهاتف المحمول، يجب أن تكون القائمة مخفية
          cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
          cy.get('[data-testid="desktop-navigation"]').should('not.be.visible');
        } else {
          // في الأجهزة الأكبر، يجب أن تكون القائمة ظاهرة
          cy.get('[data-testid="desktop-navigation"]').should('be.visible');
          cy.get('[data-testid="mobile-menu-button"]').should('not.be.visible');
        }
      });

      it('should display tables correctly', () => {
        cy.visit('/patients');

        if (device === 'mobile') {
          // في الهاتف المحمول، يجب أن تكون الجداول قابلة للتمرير
          cy.get('[data-testid="patients-table"]')
            .should('have.css', 'overflow-x', 'auto');
        } else {
          // في الأجهزة الأكبر، يجب أن تظهر جميع الأعمدة
          cy.get('[data-testid="patients-table"] th')
            .should('have.length.greaterThan', 3);
        }
      });
    });
  });
});
```

---

## اختبارات الأداء (Performance Tests)

### إعداد Artillery للاختبارات

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "Patient Management Load Test"
    weight: 40
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "doctor@hospital.com"
            password: "password123"
          capture:
            - json: "$.token"
              as: "authToken"
      - get:
          url: "/api/patients"
          headers:
            Authorization: "Bearer {{ authToken }}"
      - post:
          url: "/api/patients"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            firstName: "مريض"
            lastName: "تجريبي"
            nationalId: "{{ $randomInt(1000000000, 9999999999) }}"
            dateOfBirth: "1990-01-01"
            gender: "male"

  - name: "Appointment Booking Load Test"
    weight: 30
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "doctor@hospital.com"
            password: "password123"
          capture:
            - json: "$.token"
              as: "authToken"
      - get:
          url: "/api/appointments"
          headers:
            Authorization: "Bearer {{ authToken }}"
      - post:
          url: "/api/appointments"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            patientId: "{{ $randomString() }}"
            doctorId: "{{ $randomString() }}"
            appointmentDate: "2024-12-31"
            appointmentTime: "10:00"
            type: "consultation"

  - name: "Medical Records Access"
    weight: 30
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "doctor@hospital.com"
            password: "password123"
          capture:
            - json: "$.token"
              as: "authToken"
      - get:
          url: "/api/medical-records"
          headers:
            Authorization: "Bearer {{ authToken }}"
```

### اختبارات الأداء المخصصة

```javascript
// tests/performance/load-test.js
const autocannon = require('autocannon');
const app = require('../../src/app');

describe('Performance Tests', () => {
  let server;

  beforeAll((done) => {
    server = app.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  test('should handle concurrent patient requests', async () => {
    const port = server.address().port;
    
    const result = await autocannon({
      url: `http://localhost:${port}/api/patients`,
      connections: 50,
      duration: 30,
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });

    // التحقق من معايير الأداء
    expect(result.latency.average).toBeLessThan(500); // أقل من 500ms
    expect(result.errors).toBe(0); // لا توجد أخطاء
    expect(result.timeouts).toBe(0); // لا توجد انتهاءات صلاحية
  });

  test('should handle database queries efficiently', async () => {
    const startTime = Date.now();
    
    // تنفيذ 100 استعلام متزامن
    const promises = Array.from({ length: 100 }, () =>
      Patient.find().limit(10)
    );
    
    await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // يجب أن يكتمل في أقل من 5 ثوانٍ
    expect(duration).toBeLessThan(5000);
  });
});
```

### مراقبة استخدام الذاكرة

```javascript
// tests/performance/memory-test.js
const memwatch = require('memwatch-next');
const PatientService = require('../../src/services/patientService');

describe('Memory Usage Tests', () => {
  test('should not have memory leaks in patient operations', (done) => {
    let heapDiff;
    
    memwatch.once('leak', (info) => {
      fail(`Memory leak detected: ${info.reason}`);
    });

    const hd = new memwatch.HeapDiff();
    
    // تنفيذ عمليات متكررة
    const performOperations = async () => {
      const patientService = new PatientService();
      
      for (let i = 0; i < 1000; i++) {
        await patientService.createPatient({
          firstName: `مريض${i}`,
          lastName: 'تجريبي',
          nationalId: `${1000000000 + i}`,
          dateOfBirth: new Date('1990-01-01'),
          gender: 'male'
        });
        
        if (i % 100 === 0) {
          global.gc && global.gc(); // تشغيل جامع القمامة إذا كان متاحاً
        }
      }
    };

    performOperations().then(() => {
      const diff = hd.end();
      
      // التحقق من عدم وجود تسريب كبير للذاكرة
      expect(diff.change.size_bytes).toBeLessThan(50 * 1024 * 1024); // أقل من 50MB
      
      done();
    }).catch(done);
  });
});
```

---

## اختبارات الأمان (Security Tests)

### اختبار المصادقة والتفويض

```javascript
// tests/security/auth-security.test.js
const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');

describe('Authentication Security', () => {
  describe('JWT Token Security', () => {
    test('should reject invalid tokens', async () => {
      const invalidToken = 'invalid.token.here';

      await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    test('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user', role: 'doctor' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // منتهي الصلاحية
      );

      await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    test('should reject tokens with invalid signature', async () => {
      const tokenWithWrongSecret = jwt.sign(
        { userId: 'test-user', role: 'doctor' },
        'wrong-secret'
      );

      await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${tokenWithWrongSecret}`)
        .expect(401);
    });
  });

  describe('Role-Based Access Control', () => {
    test('should allow doctors to access patient data', async () => {
      const doctorToken = jwt.sign(
        { userId: 'doctor-id', role: 'doctor' },
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);
    });

    test('should deny nurses access to financial data', async () => {
      const nurseToken = jwt.sign(
        { userId: 'nurse-id', role: 'nurse' },
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get('/api/finance/reports')
        .set('Authorization', `Bearer ${nurseToken}`)
        .expect(403);
    });

    test('should allow admin access to all resources', async () => {
      const adminToken = jwt.sign(
        { userId: 'admin-id', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const endpoints = [
        '/api/patients',
        '/api/finance/reports',
        '/api/hr/employees',
        '/api/admin/settings'
      ];

      for (const endpoint of endpoints) {
        await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect((res) => {
            expect(res.status).not.toBe(403);
          });
      }
    });
  });
});
```

### اختبار حقن SQL والهجمات

```javascript
// tests/security/injection-attacks.test.js
const request = require('supertest');
const app = require('../../src/app');
const jwt = require('jsonwebtoken');

describe('Injection Attack Prevention', () => {
  let authToken;

  beforeEach(() => {
    authToken = jwt.sign(
      { userId: 'test-user', role: 'doctor' },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  describe('NoSQL Injection Prevention', () => {
    test('should prevent NoSQL injection in search', async () => {
      const maliciousPayload = {
        search: { $ne: null } // محاولة حقن NoSQL
      };

      const response = await request(app)
        .post('/api/patients/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousPayload);

      // يجب أن يرفض الطلب أو يعامله كنص عادي
      expect(response.status).not.toBe(500);
      expect(response.body.patients || []).toHaveLength(0);
    });

    test('should sanitize user input', async () => {
      const maliciousData = {
        firstName: '<script>alert("XSS")</script>',
        lastName: '${7*7}', // محاولة حقن تعبير
        nationalId: '1234567890'
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(400); // يجب أن يرفض البيانات الضارة

      expect(response.body.error).toContain('بيانات غير صالحة');
    });
  });

  describe('XSS Prevention', () => {
    test('should escape HTML in responses', async () => {
      const patient = await Patient.create({
        firstName: '<script>alert("XSS")</script>',
        lastName: 'Test',
        nationalId: '1234567890',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male'
      });

      const response = await request(app)
        .get(`/api/patients/${patient._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // يجب أن يكون HTML مُهرَّب
      expect(response.body.patient.firstName).not.toContain('<script>');
      expect(response.body.patient.firstName).toContain('&lt;script&gt;');
    });
  });

  describe('CSRF Prevention', () => {
    test('should require CSRF token for state-changing operations', async () => {
      // محاولة إنشاء مريض بدون CSRF token
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://malicious-site.com')
        .send({
          firstName: 'أحمد',
          lastName: 'محمد',
          nationalId: '1234567890',
          dateOfBirth: '1990-01-01',
          gender: 'male'
        });

      // يجب أن يرفض الطلب من مصدر غير موثوق
      expect(response.status).toBe(403);
    });
  });
});
```

### اختبار تشفير البيانات

```javascript
// tests/security/encryption.test.js
const crypto = require('crypto');
const Patient = require('../../src/models/Patient');
const { encryptSensitiveData, decryptSensitiveData } = require('../../src/utils/encryption');

describe('Data Encryption', () => {
  test('should encrypt sensitive patient data', async () => {
    const sensitiveData = {
      nationalId: '1234567890',
      medicalHistory: 'تاريخ طبي حساس',
      allergies: ['البنسلين', 'الأسبرين']
    };

    const encrypted = encryptSensitiveData(sensitiveData);
    
    // التحقق من أن البيانات مشفرة
    expect(encrypted).not.toEqual(sensitiveData);
    expect(encrypted.nationalId).not.toBe('1234567890');
    
    // التحقق من إمكانية فك التشفير
    const decrypted = decryptSensitiveData(encrypted);
    expect(decrypted).toEqual(sensitiveData);
  });

  test('should hash passwords securely', async () => {
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // التحقق من أن كلمة المرور مُهشَّة
    expect(hashedPassword).not.toBe(password);
    expect(hashedPassword.length).toBeGreaterThan(50);
    
    // التحقق من صحة التحقق
    const isValid = await bcrypt.compare(password, hashedPassword);
    expect(isValid).toBe(true);
    
    const isInvalid = await bcrypt.compare('wrongpassword', hashedPassword);
    expect(isInvalid).toBe(false);
  });

  test('should use secure random tokens', () => {
    const token1 = crypto.randomBytes(32).toString('hex');
    const token2 = crypto.randomBytes(32).toString('hex');
    
    // التحقق من أن الرموز مختلفة
    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(64); // 32 bytes = 64 hex characters
    expect(token2.length).toBe(64);
  });
});
```

---

## اختبارات قبول المستخدم (User Acceptance Tests)

### سيناريوهات الاستخدام الحقيقي

```javascript
// tests/acceptance/patient-registration.test.js
describe('Patient Registration - User Acceptance', () => {
  it('should allow receptionist to register new patient', () => {
    // السيناريو: موظف الاستقبال يسجل مريض جديد
    
    // 1. تسجيل الدخول كموظف استقبال
    cy.login('receptionist@hospital.com', 'password123');
    
    // 2. الانتقال إلى صفحة تسجيل المرضى
    cy.visit('/patients/register');
    
    // 3. ملء بيانات المريض
    cy.get('[data-testid="patient-form"]').within(() => {
      cy.get('[name="firstName"]').type('عبدالله');
      cy.get('[name="lastName"]').type('الأحمد');
      cy.get('[name="nationalId"]').type('1234567890');
      cy.get('[name="dateOfBirth"]').type('1985-03-15');
      cy.get('[name="gender"]').select('male');
      cy.get('[name="phone"]').type('0501234567');
      cy.get('[name="email"]').type('abdullah@example.com');
      
      // عنوان المريض
      cy.get('[name="address.street"]').type('شارع الملك فهد');
      cy.get('[name="address.city"]').type('الرياض');
      cy.get('[name="address.postalCode"]').type('12345');
      
      // معلومات الطوارئ
      cy.get('[name="emergencyContact.name"]').type('سارة الأحمد');
      cy.get('[name="emergencyContact.relationship"]').type('زوجة');
      cy.get('[name="emergencyContact.phone"]').type('0509876543');
    });
    
    // 4. حفظ بيانات المريض
    cy.get('[data-testid="save-patient"]').click();
    
    // 5. التحقق من نجاح التسجيل
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'تم تسجيل المريض بنجاح');
    
    // 6. التحقق من إنشاء رقم المريض
    cy.get('[data-testid="patient-id"]')
      .should('be.visible')
      .and('match', /P\d{6}/); // تنسيق رقم المريض
    
    // 7. التحقق من ظهور المريض في قائمة المرضى
    cy.visit('/patients');
    cy.get('[data-testid="search-input"]').type('عبدالله الأحمد');
    cy.get('[data-testid="search-button"]').click();
    
    cy.get('[data-testid="patients-table"]')
      .should('contain', 'عبدالله الأحمد')
      .and('contain', '1234567890');
  });
});
```

### اختبار تدفق العمل الطبي

```javascript
// tests/acceptance/medical-workflow.test.js
describe('Medical Workflow - User Acceptance', () => {
  it('should complete full patient visit workflow', () => {
    // السيناريو: زيارة مريض كاملة من الحجز إلى الخروج
    
    // إعداد البيانات
    const patientData = {
      name: 'أحمد محمد',
      nationalId: '1234567890',
      phone: '0501234567'
    };
    
    // 1. حجز موعد (موظف الاستقبال)
    cy.login('receptionist@hospital.com', 'password123');
    cy.visit('/appointments/book');
    
    cy.get('[data-testid="patient-search"]').type(patientData.nationalId);
    cy.get('[data-testid="search-patient"]').click();
    cy.get('[data-testid="select-patient"]').click();
    
    cy.get('[data-testid="doctor-select"]').select('د. سارة أحمد');
    cy.get('[data-testid="appointment-date"]').type('2024-12-31');
    cy.get('[data-testid="appointment-time"]').select('10:00');
    cy.get('[data-testid="appointment-type"]').select('consultation');
    cy.get('[data-testid="reason"]').type('فحص دوري');
    
    cy.get('[data-testid="book-appointment"]').click();
    
    cy.get('[data-testid="booking-confirmation"]')
      .should('be.visible')
      .and('contain', 'تم حجز الموعد بنجاح');
    
    // 2. وصول المريض وتسجيل الحضور
    cy.visit('/reception/checkin');
    cy.get('[data-testid="patient-search"]').type(patientData.nationalId);
    cy.get('[data-testid="search-button"]').click();
    
    cy.get('[data-testid="checkin-button"]').click();
    cy.get('[data-testid="checkin-success"]')
      .should('be.visible')
      .and('contain', 'تم تسجيل وصول المريض');
    
    // 3. الفحص الطبي (الطبيب)
    cy.login('doctor@hospital.com', 'password123');
    cy.visit('/doctor/appointments');
    
    cy.get(`[data-testid="appointment-${patientData.nationalId}"]`).click();
    cy.get('[data-testid="start-consultation"]').click();
    
    // إدخال الفحص الطبي
    cy.get('[data-testid="vital-signs"]').within(() => {
      cy.get('[name="bloodPressure"]').type('120/80');
      cy.get('[name="heartRate"]').type('72');
      cy.get('[name="temperature"]').type('36.5');
      cy.get('[name="weight"]').type('70');
    });
    
    cy.get('[data-testid="symptoms"]').type('صداع خفيف');
    cy.get('[data-testid="diagnosis"]').type('توتر');
    cy.get('[data-testid="treatment-plan"]').type('راحة وأدوية مسكنة');
    
    // وصف الأدوية
    cy.get('[data-testid="add-prescription"]').click();
    cy.get('[data-testid="medication-name"]').type('باراسيتامول');
    cy.get('[data-testid="dosage"]').type('500mg');
    cy.get('[data-testid="frequency"]').type('كل 8 ساعات');
    cy.get('[data-testid="duration"]').type('3 أيام');
    
    cy.get('[data-testid="save-prescription"]').click();
    cy.get('[data-testid="complete-consultation"]').click();
    
    // 4. الصيدلية (الصيدلي)
    cy.login('pharmacist@hospital.com', 'password123');
    cy.visit('/pharmacy/prescriptions');
    
    cy.get(`[data-testid="prescription-${patientData.nationalId}"]`).click();
    cy.get('[data-testid="dispense-medication"]').click();
    
    cy.get('[data-testid="medication-dispensed"]')
      .should('be.visible')
      .and('contain', 'تم صرف الدواء');
    
    // 5. المحاسبة (موظف المحاسبة)
    cy.login('accountant@hospital.com', 'password123');
    cy.visit('/billing/pending');
    
    cy.get(`[data-testid="bill-${patientData.nationalId}"]`).click();
    cy.get('[data-testid="consultation-fee"]').should('contain', '200 ريال');
    cy.get('[data-testid="medication-fee"]').should('contain', '50 ريال');
    cy.get('[data-testid="total-amount"]').should('contain', '250 ريال');
    
    cy.get('[data-testid="payment-method"]').select('cash');
    cy.get('[data-testid="process-payment"]').click();
    
    cy.get('[data-testid="payment-success"]')
      .should('be.visible')
      .and('contain', 'تم استلام الدفع');
    
    // 6. خروج المريض
    cy.login('receptionist@hospital.com', 'password123');
    cy.visit('/reception/checkout');
    
    cy.get('[data-testid="patient-search"]').type(patientData.nationalId);
    cy.get('[data-testid="search-button"]').click();
    cy.get('[data-testid="checkout-button"]').click();
    
    cy.get('[data-testid="checkout-success"]')
      .should('be.visible')
      .and('contain', 'تم تسجيل خروج المريض');
  });
});
```

---

## تشغيل الاختبارات

### سكريبت تشغيل جميع الاختبارات

```bash
#!/bin/bash
# run-all-tests.sh

echo "🧪 بدء تشغيل جميع الاختبارات..."

# إعداد متغيرات البيئة للاختبار
export NODE_ENV=test
export DB_NAME=hospital_erp_test
export JWT_SECRET=test-secret-key

# تنظيف قاعدة البيانات
echo "🗄️ تنظيف قاعدة البيانات..."
npm run db:clean

# اختبارات الوحدة
echo "🔧 تشغيل اختبارات الوحدة..."
npm run test:unit

if [ $? -ne 0 ]; then
    echo "❌ فشلت اختبارات الوحدة"
    exit 1
fi

# اختبارات التكامل
echo "🔗 تشغيل اختبارات التكامل..."
npm run test:integration

if [ $? -ne 0 ]; then
    echo "❌ فشلت اختبارات التكامل"
    exit 1
fi

# بدء الخادم للاختبارات
echo "🚀 بدء الخادم للاختبارات..."
npm start &
SERVER_PID=$!

# انتظار بدء الخادم
sleep 10

# اختبارات واجهة المستخدم
echo "🖥️ تشغيل اختبارات واجهة المستخدم..."
npm run test:e2e

E2E_RESULT=$?

# اختبارات الأداء
echo "⚡ تشغيل اختبارات الأداء..."
npm run test:performance

PERFORMANCE_RESULT=$?

# اختبارات الأمان
echo "🔒 تشغيل اختبارات الأمان..."
npm run test:security

SECURITY_RESULT=$?

# إيقاف الخادم
echo "🛑 إيقاف الخادم..."
kill $SERVER_PID

# تقرير النتائج
echo "📊 تقرير النتائج:"
echo "✅ اختبارات الوحدة: نجحت"
echo "✅ اختبارات التكامل: نجحت"

if [ $E2E_RESULT -eq 0 ]; then
    echo "✅ اختبارات واجهة المستخدم: نجحت"
else
    echo "❌ اختبارات واجهة المستخدم: فشلت"
fi

if [ $PERFORMANCE_RESULT -eq 0 ]; then
    echo "✅ اختبارات الأداء: نجحت"
else
    echo "❌ اختبارات الأداء: فشلت"
fi

if [ $SECURITY_RESULT -eq 0 ]; then
    echo "✅ اختبارات الأمان: نجحت"
else
    echo "❌ اختبارات الأمان: فشلت"
fi

# إنشاء تقرير التغطية
echo "📈 إنشاء تقرير التغطية..."
npm run coverage:report

echo "🎉 انتهت جميع الاختبارات!"

# الخروج بحالة الخطأ إذا فشل أي اختبار
if [ $E2E_RESULT -ne 0 ] || [ $PERFORMANCE_RESULT -ne 0 ] || [ $SECURITY_RESULT -ne 0 ]; then
    exit 1
fi

exit 0
```

### إعداد package.json للاختبارات

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "test:performance": "artillery run artillery-config.yml",
    "test:security": "jest --testPathPattern=tests/security",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "coverage:report": "jest --coverage && open coverage/lcov-report/index.html",
    "db:clean": "node scripts/clean-test-db.js"
  }
}
```

---

## تقارير الاختبار

### إنشاء تقارير مفصلة

```javascript
// scripts/generate-test-report.js
const fs = require('fs');
const path = require('path');

class TestReportGenerator {
  constructor() {
    this.results = {
      unit: null,
      integration: null,
      e2e: null,
      performance: null,
      security: null
    };
  }

  async generateReport() {
    console.log('📊 إنشاء تقرير الاختبار الشامل...');

    // قراءة نتائج الاختبارات
    await this.loadTestResults();

    // إنشاء تقرير HTML
    const htmlReport = this.generateHTMLReport();

    // حفظ التقرير
    const reportPath = path.join(__dirname, '../reports/test-report.html');
    fs.writeFileSync(reportPath, htmlReport);

    console.log(`✅ تم إنشاء التقرير: ${reportPath}`);
  }

  async loadTestResults() {
    try {
      // قراءة نتائج Jest
      const jestResults = JSON.parse(
        fs.readFileSync('./coverage/coverage-summary.json', 'utf8')
      );
      
      this.results.unit = {
        passed: jestResults.total.lines.pct >= 80,
        coverage: jestResults.total.lines.pct,
        details: jestResults
      };

      // قراءة نتائج Cypress
      if (fs.existsSync('./cypress/reports/mochawesome.json')) {
        const cypressResults = JSON.parse(
          fs.readFileSync('./cypress/reports/mochawesome.json', 'utf8')
        );
        
        this.results.e2e = {
          passed: cypressResults.stats.failures === 0,
          tests: cypressResults.stats.tests,
          failures: cypressResults.stats.failures,
          duration: cypressResults.stats.duration
        };
      }

      // قراءة نتائج Artillery
      if (fs.existsSync('./artillery-report.json')) {
        const performanceResults = JSON.parse(
          fs.readFileSync('./artillery-report.json', 'utf8')
        );
        
        this.results.performance = {
          passed: performanceResults.aggregate.latency.p95 < 1000,
          latency: performanceResults.aggregate.latency,
          rps: performanceResults.aggregate.rps
        };
      }

    } catch (error) {
      console.error('خطأ في قراءة نتائج الاختبار:', error);
    }
  }

  generateHTMLReport() {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير الاختبار الشامل - نظام إدارة المستشفيات</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
        }
        .metric {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #007bff;
        }
        .metric.success { border-left-color: #28a745; }
        .metric.warning { border-left-color: #ffc107; }
        .metric.danger { border-left-color: #dc3545; }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .details {
            padding: 30px;
        }
        .test-section {
            margin-bottom: 30px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            overflow: hidden;
        }
        .section-header {
            background: #f8f9fa;
            padding: 15px 20px;
            font-weight: bold;
            border-bottom: 1px solid #e9ecef;
        }
        .section-content {
            padding: 20px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
        }
        .status-success {
            background: #d4edda;
            color: #155724;
        }
        .status-danger {
            background: #f8d7da;
            color: #721c24;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 12px;
            text-align: right;
            border-bottom: 1px solid #e9ecef;
        }
        th {
            background: #f8f9fa;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>تقرير الاختبار الشامل</h1>
            <p>نظام إدارة المستشفيات</p>
            <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
        </div>

        <div class="summary">
            ${this.generateMetricCard('اختبارات الوحدة', this.results.unit)}
            ${this.generateMetricCard('اختبارات التكامل', this.results.integration)}
            ${this.generateMetricCard('اختبارات واجهة المستخدم', this.results.e2e)}
            ${this.generateMetricCard('اختبارات الأداء', this.results.performance)}
            ${this.generateMetricCard('اختبارات الأمان', this.results.security)}
        </div>

        <div class="details">
            ${this.generateDetailedSections()}
        </div>
    </div>
</body>
</html>`;
  }

  generateMetricCard(title, result) {
    if (!result) {
      return `
        <div class="metric">
            <div class="metric-value">-</div>
            <div class="metric-label">${title}</div>
            <span class="status-badge">غير متوفر</span>
        </div>`;
    }

    const status = result.passed ? 'success' : 'danger';
    const statusText = result.passed ? 'نجح' : 'فشل';
    const value = result.coverage ? `${result.coverage}%` : 
                  result.tests ? `${result.tests - result.failures}/${result.tests}` : 
                  result.latency ? `${result.latency.p95}ms` : '✓';

    return `
      <div class="metric ${status}">
          <div class="metric-value">${value}</div>
          <div class="metric-label">${title}</div>
          <span class="status-badge status-${status}">${statusText}</span>
      </div>`;
  }

  generateDetailedSections() {
    return `
      <div class="test-section">
          <div class="section-header">تفاصيل اختبارات الوحدة</div>
          <div class="section-content">
              ${this.generateUnitTestDetails()}
          </div>
      </div>
      
      <div class="test-section">
          <div class="section-header">تفاصيل اختبارات الأداء</div>
          <div class="section-content">
              ${this.generatePerformanceDetails()}
          </div>
      </div>
      
      <div class="test-section">
          <div class="section-header">توصيات التحسين</div>
          <div class="section-content">
              ${this.generateRecommendations()}
          </div>
      </div>`;
  }
}

module.exports = TestReportGenerator;
```

---

## الخلاصة والنقاط الرئيسية

### أهمية الاختبار الشامل

1. **ضمان الجودة**: التأكد من عمل جميع وظائف النظام بشكل صحيح
2. **الأمان**: حماية البيانات الطبية الحساسة
3. **الأداء**: ضمان استجابة النظام تحت الأحمال المختلفة
4. **الموثوقية**: تقليل الأخطاء في البيئة الإنتاجية

### معايير النجاح

- **تغطية الكود**: 80% أو أكثر
- **زمن الاستجابة**: أقل من 500ms للعمليات العادية
- **معدل الأخطاء**: أقل من 0.1%
- **الأمان**: اجتياز جميع اختبارات الأمان

### الصيانة المستمرة

1. **تشغيل الاختبارات تلقائياً** مع كل تحديث
2. **مراجعة التقارير** بانتظام
3. **تحديث الاختبارات** مع إضافة ميزات جديدة
4. **تدريب الفريق** على أفضل ممارسات الاختبار

هذا الدليل يوفر إطار عمل شامل لضمان جودة وموثوقية نظام إدارة المستشفيات.