# دليل API - نظام إدارة المستشفيات

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [المصادقة والتفويض](#المصادقة-والتفويض)
3. [هيكل الاستجابة](#هيكل-الاستجابة)
4. [معالجة الأخطاء](#معالجة-الأخطاء)
5. [APIs الأساسية](#apis-الأساسية)
6. [APIs الطبية](#apis-الطبية)
7. [APIs الإدارية](#apis-الإدارية)
8. [APIs المتقدمة](#apis-المتقدمة)
9. [WebSocket Events](#websocket-events)
10. [أمثلة عملية](#أمثلة-عملية)

## نظرة عامة

### Base URL
```
Production: https://api.yourdomain.com
Development: http://localhost:5000
```

### Content Type
جميع الطلبات والاستجابات تستخدم `application/json`

### Rate Limiting
- **الحد الأقصى**: 100 طلب لكل 15 دقيقة لكل IP
- **Headers المرجعة**:
  - `X-RateLimit-Limit`: الحد الأقصى للطلبات
  - `X-RateLimit-Remaining`: الطلبات المتبقية
  - `X-RateLimit-Reset`: وقت إعادة تعيين العداد

## المصادقة والتفويض

### تسجيل الدخول
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "doctor@hospital.com",
  "password": "securePassword123"
}
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "doctor@hospital.com",
      "name": "د. أحمد محمد",
      "role": "doctor",
      "department": "cardiology",
      "permissions": ["read_patients", "write_patients"]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 604800
    }
  }
}
```

### استخدام Token
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### تجديد Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### الأدوار والصلاحيات

#### الأدوار المتاحة
- `admin`: مدير النظام
- `doctor`: طبيب
- `nurse`: ممرض/ممرضة
- `pharmacist`: صيدلي
- `receptionist`: موظف استقبال
- `lab_technician`: فني مختبر
- `radiologist`: أخصائي أشعة
- `hr_manager`: مدير الموارد البشرية
- `finance_manager`: مدير مالي

#### الصلاحيات
```json
{
  "patients": ["read", "write", "delete"],
  "appointments": ["read", "write", "cancel"],
  "medical_records": ["read", "write"],
  "prescriptions": ["read", "write", "dispense"],
  "lab_results": ["read", "write", "approve"],
  "radiology": ["read", "write", "report"],
  "billing": ["read", "write", "process"],
  "inventory": ["read", "write", "manage"],
  "reports": ["read", "generate"],
  "users": ["read", "write", "manage"]
}
```

## هيكل الاستجابة

### الاستجابة الناجحة
```json
{
  "success": true,
  "data": {
    // البيانات المطلوبة
  },
  "message": "تم تنفيذ العملية بنجاح",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

### الاستجابة مع Pagination
```json
{
  "success": true,
  "data": {
    "items": [
      // العناصر
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## معالجة الأخطاء

### رموز الأخطاء
- `400`: Bad Request - طلب غير صحيح
- `401`: Unauthorized - غير مصرح
- `403`: Forbidden - ممنوع
- `404`: Not Found - غير موجود
- `409`: Conflict - تضارب في البيانات
- `422`: Validation Error - خطأ في التحقق
- `429`: Too Many Requests - تجاوز الحد المسموح
- `500`: Internal Server Error - خطأ في الخادم

### هيكل رسالة الخطأ
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "البيانات المدخلة غير صحيحة",
    "details": [
      {
        "field": "email",
        "message": "البريد الإلكتروني مطلوب"
      },
      {
        "field": "password",
        "message": "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

## APIs الأساسية

### إدارة المستخدمين

#### الحصول على جميع المستخدمين
```http
GET /api/auth/users?page=1&limit=20&role=doctor&department=cardiology
Authorization: Bearer {token}
```

#### إنشاء مستخدم جديد
```http
POST /api/auth/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "د. سارة أحمد",
  "email": "sara@hospital.com",
  "password": "securePassword123",
  "role": "doctor",
  "department": "pediatrics",
  "phone": "+966501234567",
  "specialization": "طب الأطفال",
  "licenseNumber": "DOC123456",
  "permissions": ["read_patients", "write_patients", "read_appointments"]
}
```

#### تحديث مستخدم
```http
PUT /api/auth/users/{userId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "د. سارة أحمد المحدث",
  "phone": "+966501234568",
  "department": "emergency"
}
```

#### حذف مستخدم
```http
DELETE /api/auth/users/{userId}
Authorization: Bearer {token}
```

### إدارة الملف الشخصي

#### الحصول على الملف الشخصي
```http
GET /api/auth/profile
Authorization: Bearer {token}
```

#### تحديث الملف الشخصي
```http
PUT /api/auth/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "د. أحمد محمد المحدث",
  "phone": "+966501234567",
  "bio": "استشاري أمراض القلب مع خبرة 15 سنة"
}
```

#### تغيير كلمة المرور
```http
PUT /api/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}
```

## APIs الطبية

### إدارة المرضى

#### الحصول على جميع المرضى
```http
GET /api/emr/patients?page=1&limit=20&search=أحمد&status=active
Authorization: Bearer {token}
```

#### إنشاء مريض جديد
```http
POST /api/emr/patients
Authorization: Bearer {token}
Content-Type: application/json

{
  "personalInfo": {
    "name": "أحمد محمد علي",
    "dateOfBirth": "1985-05-15",
    "gender": "male",
    "nationalId": "1234567890",
    "phone": "+966501234567",
    "email": "ahmed@email.com",
    "address": {
      "street": "شارع الملك فهد",
      "city": "الرياض",
      "state": "الرياض",
      "zipCode": "12345",
      "country": "السعودية"
    }
  },
  "emergencyContact": {
    "name": "فاطمة أحمد",
    "relationship": "زوجة",
    "phone": "+966507654321"
  },
  "insurance": {
    "provider": "شركة التأمين الطبي",
    "policyNumber": "INS123456",
    "groupNumber": "GRP789",
    "expiryDate": "2024-12-31"
  },
  "medicalHistory": {
    "allergies": ["البنسلين", "الفول السوداني"],
    "chronicConditions": ["ارتفاع ضغط الدم"],
    "medications": ["أملوديبين 5mg"],
    "surgeries": [
      {
        "procedure": "استئصال الزائدة الدودية",
        "date": "2020-03-15",
        "hospital": "مستشفى الملك فيصل"
      }
    ]
  }
}
```

#### الحصول على مريض محدد
```http
GET /api/emr/patients/{patientId}
Authorization: Bearer {token}
```

#### تحديث بيانات مريض
```http
PUT /api/emr/patients/{patientId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "personalInfo": {
    "phone": "+966501234568",
    "email": "ahmed.new@email.com"
  },
  "medicalHistory": {
    "allergies": ["البنسلين", "الفول السوداني", "الأسبرين"]
  }
}
```

### إدارة المواعيد

#### الحصول على المواعيد
```http
GET /api/emr/appointments?date=2024-01-15&doctorId=doc123&status=scheduled
Authorization: Bearer {token}
```

#### حجز موعد جديد
```http
POST /api/emr/appointments
Authorization: Bearer {token}
Content-Type: application/json

{
  "patientId": "patient123",
  "doctorId": "doctor456",
  "date": "2024-01-20",
  "time": "10:00",
  "duration": 30,
  "type": "consultation",
  "reason": "فحص دوري",
  "notes": "مريض يعاني من ألم في الصدر"
}
```

#### تحديث موعد
```http
PUT /api/emr/appointments/{appointmentId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "date": "2024-01-21",
  "time": "11:00",
  "status": "rescheduled",
  "notes": "تم تأجيل الموعد بناء على طلب المريض"
}
```

#### إلغاء موعد
```http
DELETE /api/emr/appointments/{appointmentId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "طلب المريض",
  "notes": "المريض سافر خارج المدينة"
}
```

### السجلات الطبية

#### إنشاء سجل طبي
```http
POST /api/emr/medical-records
Authorization: Bearer {token}
Content-Type: application/json

{
  "patientId": "patient123",
  "appointmentId": "appointment456",
  "chiefComplaint": "ألم في الصدر",
  "historyOfPresentIllness": "يشكو المريض من ألم في الصدر منذ 3 أيام",
  "physicalExamination": {
    "vitalSigns": {
      "bloodPressure": "140/90",
      "heartRate": 85,
      "temperature": 37.2,
      "respiratoryRate": 18,
      "oxygenSaturation": 98
    },
    "generalAppearance": "المريض يبدو متعب",
    "systemicExamination": {
      "cardiovascular": "أصوات القلب طبيعية",
      "respiratory": "أصوات الرئة صافية",
      "abdominal": "البطن لين غير مؤلم"
    }
  },
  "assessment": "ألم في الصدر - يحتاج لفحوصات إضافية",
  "plan": {
    "medications": [
      {
        "name": "أسبرين",
        "dosage": "81mg",
        "frequency": "مرة يومياً",
        "duration": "30 يوم"
      }
    ],
    "investigations": [
      "تخطيط القلب",
      "تحليل إنزيمات القلب"
    ],
    "followUp": "مراجعة خلال أسبوع"
  }
}
```

#### الحصول على السجلات الطبية
```http
GET /api/emr/medical-records?patientId=patient123&fromDate=2024-01-01&toDate=2024-01-31
Authorization: Bearer {token}
```

### الوصفات الطبية

#### إنشاء وصفة طبية
```http
POST /api/emr/prescriptions
Authorization: Bearer {token}
Content-Type: application/json

{
  "patientId": "patient123",
  "doctorId": "doctor456",
  "medications": [
    {
      "name": "أموكسيسيلين",
      "strength": "500mg",
      "form": "كبسولة",
      "quantity": 21,
      "dosage": "كبسولة واحدة",
      "frequency": "ثلاث مرات يومياً",
      "duration": "7 أيام",
      "instructions": "يؤخذ مع الطعام"
    },
    {
      "name": "باراسيتامول",
      "strength": "500mg",
      "form": "قرص",
      "quantity": 20,
      "dosage": "قرص واحد",
      "frequency": "عند الحاجة",
      "duration": "حسب الحاجة",
      "instructions": "للألم والحمى"
    }
  ],
  "diagnosis": "التهاب الحلق البكتيري",
  "notes": "يرجى إكمال الكورس كاملاً"
}
```

#### صرف الوصفة
```http
PUT /api/pharmacy/prescriptions/{prescriptionId}/dispense
Authorization: Bearer {token}
Content-Type: application/json

{
  "dispensedBy": "pharmacist123",
  "dispensedDate": "2024-01-15T14:30:00Z",
  "medications": [
    {
      "medicationId": "med123",
      "quantityDispensed": 21,
      "batchNumber": "BATCH001",
      "expiryDate": "2025-12-31"
    }
  ],
  "totalCost": 85.50,
  "patientCopay": 15.00,
  "insuranceCoverage": 70.50
}
```

## APIs الإدارية

### إدارة الموارد البشرية

#### الحصول على الموظفين
```http
GET /api/hr/employees?department=cardiology&status=active&page=1&limit=20
Authorization: Bearer {token}
```

#### إضافة موظف جديد
```http
POST /api/hr/employees
Authorization: Bearer {token}
Content-Type: application/json

{
  "personalInfo": {
    "name": "د. محمد أحمد",
    "email": "mohammed@hospital.com",
    "phone": "+966501234567",
    "nationalId": "1234567890",
    "dateOfBirth": "1980-05-15",
    "address": {
      "street": "شارع العليا",
      "city": "الرياض",
      "zipCode": "12345"
    }
  },
  "employmentInfo": {
    "employeeId": "EMP001",
    "department": "cardiology",
    "position": "استشاري أمراض القلب",
    "hireDate": "2024-01-01",
    "salary": 25000,
    "workSchedule": {
      "type": "full-time",
      "hoursPerWeek": 40,
      "shifts": ["morning", "evening"]
    }
  },
  "qualifications": {
    "education": [
      {
        "degree": "دكتوراه في الطب",
        "institution": "جامعة الملك سعود",
        "year": 2005
      }
    ],
    "certifications": [
      {
        "name": "البورد السعودي لأمراض القلب",
        "issuingBody": "الهيئة السعودية للتخصصات الصحية",
        "issueDate": "2010-06-15",
        "expiryDate": "2025-06-15"
      }
    ]
  }
}
```

### إدارة المالية

#### الحصول على الفواتير
```http
GET /api/finance/bills?patientId=patient123&status=pending&fromDate=2024-01-01
Authorization: Bearer {token}
```

#### إنشاء فاتورة
```http
POST /api/finance/bills
Authorization: Bearer {token}
Content-Type: application/json

{
  "patientId": "patient123",
  "appointmentId": "appointment456",
  "items": [
    {
      "type": "consultation",
      "description": "استشارة أمراض القلب",
      "quantity": 1,
      "unitPrice": 300,
      "total": 300
    },
    {
      "type": "investigation",
      "description": "تخطيط القلب",
      "quantity": 1,
      "unitPrice": 150,
      "total": 150
    }
  ],
  "subtotal": 450,
  "tax": 67.50,
  "discount": 0,
  "total": 517.50,
  "insurance": {
    "provider": "شركة التأمين",
    "coverage": 80,
    "coveredAmount": 414,
    "patientResponsibility": 103.50
  }
}
```

#### معالجة الدفع
```http
POST /api/finance/payments
Authorization: Bearer {token}
Content-Type: application/json

{
  "billId": "bill123",
  "amount": 103.50,
  "method": "credit_card",
  "reference": "TXN123456789",
  "paidBy": "patient123",
  "notes": "دفع كامل للفاتورة"
}
```

## APIs المتقدمة

### الذكاء الاصطناعي

#### توقع الطلب على الأدوية
```http
POST /api/ai-models/drug-demand/predict
Authorization: Bearer {token}
Content-Type: application/json

{
  "drugId": "drug123",
  "timeframe": "monthly",
  "factors": {
    "seasonal": true,
    "demographic": {
      "ageGroups": ["18-30", "31-50", "51-70"],
      "conditions": ["diabetes", "hypertension"]
    },
    "external": {
      "epidemics": false,
      "campaigns": true
    }
  }
}
```

**الاستجابة:**
```json
{
  "success": true,
  "data": {
    "drugId": "drug123",
    "predictions": [
      {
        "period": "2024-02",
        "predictedDemand": 1250,
        "confidence": 0.85,
        "factors": {
          "historical": 0.4,
          "seasonal": 0.3,
          "demographic": 0.2,
          "external": 0.1
        }
      }
    ],
    "recommendations": [
      "زيادة المخزون بنسبة 15%",
      "طلب إضافي من المورد الرئيسي"
    ],
    "riskAssessment": {
      "stockoutRisk": "low",
      "overstockRisk": "medium"
    }
  }
}
```

#### توقع رفض المطالبات التأمينية
```http
POST /api/ai-models/claim-rejection/predict
Authorization: Bearer {token}
Content-Type: application/json

{
  "claimData": {
    "amount": 1500,
    "serviceType": "surgery",
    "diagnosis": "appendectomy",
    "patientHistory": {
      "previousClaims": 3,
      "totalClaimedAmount": 5000,
      "rejectionRate": 0.1
    },
    "providerHistory": {
      "totalClaims": 1000,
      "rejectionRate": 0.05,
      "averageClaimAmount": 800
    },
    "policyLimits": {
      "annualLimit": 50000,
      "usedAmount": 15000,
      "serviceLimit": 10000
    }
  }
}
```

### إدارة سلسلة التوريد

#### الحصول على توصيات إعادة الطلب
```http
GET /api/supply-chain/inventory/reorder-recommendations
Authorization: Bearer {token}
```

**الاستجابة:**
```json
{
  "success": true,
  "data": [
    {
      "productId": "prod123",
      "productName": "أموكسيسيلين 500mg",
      "currentStock": 50,
      "reorderPoint": 100,
      "recommendedQuantity": 500,
      "urgency": "high",
      "estimatedStockoutDate": "2024-01-25",
      "preferredSupplier": {
        "id": "supplier123",
        "name": "شركة الأدوية المتقدمة",
        "leadTime": 7,
        "price": 2.50
      }
    }
  ]
}
```

#### إنشاء أمر شراء
```http
POST /api/supply-chain/purchase-orders
Authorization: Bearer {token}
Content-Type: application/json

{
  "supplierId": "supplier123",
  "requestedBy": "user123",
  "items": [
    {
      "productId": "prod123",
      "quantity": 500,
      "unitPrice": 2.50,
      "total": 1250
    }
  ],
  "subtotal": 1250,
  "tax": 187.50,
  "total": 1437.50,
  "deliveryDate": "2024-01-30",
  "notes": "طلب عاجل - مخزون منخفض"
}
```

### التقارير والتحليلات

#### تقرير الأداء المالي
```http
GET /api/dashboard/financial-performance?period=monthly&year=2024&month=1
Authorization: Bearer {token}
```

#### تقرير استخدام الأسرة
```http
GET /api/dashboard/bed-utilization?fromDate=2024-01-01&toDate=2024-01-31&department=icu
Authorization: Bearer {token}
```

#### تحليل رضا المرضى
```http
GET /api/dashboard/patient-satisfaction?period=quarterly&year=2024&quarter=1
Authorization: Bearer {token}
```

## WebSocket Events

### الاتصال
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### الأحداث المتاحة

#### تحديثات المواعيد
```javascript
// الاستماع لتحديثات المواعيد
socket.on('appointment:updated', (data) => {
  console.log('تم تحديث الموعد:', data);
});

// إرسال تحديث موعد
socket.emit('appointment:update', {
  appointmentId: 'appointment123',
  status: 'completed'
});
```

#### تنبيهات الطوارئ
```javascript
socket.on('emergency:alert', (data) => {
  console.log('تنبيه طوارئ:', data);
  // عرض تنبيه للمستخدم
});
```

#### تحديثات المخزون
```javascript
socket.on('inventory:low-stock', (data) => {
  console.log('تنبيه مخزون منخفض:', data);
});
```

#### الرسائل الفورية
```javascript
// إرسال رسالة
socket.emit('message:send', {
  to: 'user123',
  message: 'مرحباً، هل يمكنك مراجعة تقرير المريض؟',
  type: 'urgent'
});

// استقبال رسالة
socket.on('message:received', (data) => {
  console.log('رسالة جديدة:', data);
});
```

## أمثلة عملية

### مثال شامل: حجز موعد وإنشاء سجل طبي

```javascript
// 1. البحث عن مريض
const searchPatients = async (query) => {
  const response = await fetch(`/api/emr/patients?search=${query}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// 2. حجز موعد
const bookAppointment = async (appointmentData) => {
  const response = await fetch('/api/emr/appointments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(appointmentData)
  });
  return response.json();
};

// 3. إنشاء سجل طبي بعد الفحص
const createMedicalRecord = async (recordData) => {
  const response = await fetch('/api/emr/medical-records', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(recordData)
  });
  return response.json();
};

// 4. إنشاء وصفة طبية
const createPrescription = async (prescriptionData) => {
  const response = await fetch('/api/emr/prescriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(prescriptionData)
  });
  return response.json();
};

// استخدام المثال
const handlePatientVisit = async () => {
  try {
    // البحث عن المريض
    const patients = await searchPatients('أحمد محمد');
    const patient = patients.data.items[0];

    // حجز موعد
    const appointment = await bookAppointment({
      patientId: patient.id,
      doctorId: 'doctor123',
      date: '2024-01-20',
      time: '10:00',
      type: 'consultation',
      reason: 'فحص دوري'
    });

    // بعد الفحص - إنشاء سجل طبي
    const medicalRecord = await createMedicalRecord({
      patientId: patient.id,
      appointmentId: appointment.data.id,
      chiefComplaint: 'ألم في الصدر',
      assessment: 'ألم عضلي',
      plan: {
        medications: ['مسكن للألم'],
        followUp: 'مراجعة خلال أسبوع'
      }
    });

    // إنشاء وصفة طبية
    const prescription = await createPrescription({
      patientId: patient.id,
      doctorId: 'doctor123',
      medications: [
        {
          name: 'إيبوبروفين',
          strength: '400mg',
          quantity: 20,
          frequency: 'ثلاث مرات يومياً'
        }
      ]
    });

    console.log('تم إكمال زيارة المريض بنجاح');
  } catch (error) {
    console.error('خطأ في معالجة زيارة المريض:', error);
  }
};
```

### مثال: تتبع المخزون وإعادة الطلب

```javascript
const manageInventory = async () => {
  try {
    // الحصول على توصيات إعادة الطلب
    const reorderRecommendations = await fetch('/api/supply-chain/inventory/reorder-recommendations', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json());

    // معالجة كل توصية
    for (const recommendation of reorderRecommendations.data) {
      if (recommendation.urgency === 'high') {
        // إنشاء أمر شراء تلقائي للعناصر العاجلة
        const purchaseOrder = await fetch('/api/supply-chain/purchase-orders', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            supplierId: recommendation.preferredSupplier.id,
            items: [{
              productId: recommendation.productId,
              quantity: recommendation.recommendedQuantity,
              unitPrice: recommendation.preferredSupplier.price
            }],
            priority: 'urgent'
          })
        }).then(res => res.json());

        console.log(`تم إنشاء أمر شراء عاجل: ${purchaseOrder.data.id}`);
      }
    }
  } catch (error) {
    console.error('خطأ في إدارة المخزون:', error);
  }
};
```

---

**للحصول على مساعدة إضافية أو الإبلاغ عن مشاكل في API، يرجى التواصل مع فريق التطوير**