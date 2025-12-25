# دليل الأمان والحماية - نظام إدارة المستشفيات

## 📋 جدول المحتويات

1. [نظرة عامة على الأمان](#نظرة-عامة-على-الأمان)
2. [معايير الامتثال](#معايير-الامتثال)
3. [أمان البيانات](#أمان-البيانات)
4. [المصادقة والتفويض](#المصادقة-والتفويض)
5. [أمان الشبكة](#أمان-الشبكة)
6. [أمان التطبيق](#أمان-التطبيق)
7. [مراقبة الأمان](#مراقبة-الأمان)
8. [النسخ الاحتياطية والاستعادة](#النسخ-الاحتياطية-والاستعادة)
9. [إدارة الحوادث الأمنية](#إدارة-الحوادث-الأمنية)
10. [التدريب والتوعية](#التدريب-والتوعية)

## نظرة عامة على الأمان

### مبادئ الأمان الأساسية

#### السرية (Confidentiality)
- تشفير جميع البيانات الحساسة
- التحكم في الوصول حسب الحاجة
- حماية البيانات أثناء النقل والتخزين

#### التكامل (Integrity)
- التحقق من صحة البيانات
- منع التلاعب غير المصرح به
- تسجيل جميع التغييرات

#### التوفر (Availability)
- ضمان استمرارية الخدمة
- خطط الاستعادة من الكوارث
- مراقبة الأداء المستمرة

### إطار الأمان المتعدد الطبقات

```
┌─────────────────────────────────────┐
│           طبقة المستخدم            │
├─────────────────────────────────────┤
│           طبقة التطبيق             │
├─────────────────────────────────────┤
│           طبقة الشبكة              │
├─────────────────────────────────────┤
│         طبقة قاعدة البيانات        │
├─────────────────────────────────────┤
│        طبقة نظام التشغيل           │
├─────────────────────────────────────┤
│          طبقة الأجهزة              │
└─────────────────────────────────────┘
```

## معايير الامتثال

### HIPAA (Health Insurance Portability and Accountability Act)

#### المتطلبات الأساسية
- **الحماية الإدارية**: سياسات وإجراءات الأمان
- **الحماية الفيزيائية**: أمان المرافق والأجهزة
- **الحماية التقنية**: أمان أنظمة المعلومات

#### تطبيق HIPAA في النظام
```javascript
// مثال على تسجيل الوصول للبيانات الطبية
const auditLog = {
  userId: 'doctor123',
  action: 'VIEW_PATIENT_RECORD',
  patientId: 'patient456',
  timestamp: new Date().toISOString(),
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  dataAccessed: ['demographics', 'medical_history'],
  justification: 'Patient consultation'
};

await logAuditEvent(auditLog);
```

### ISO 27001

#### نظام إدارة أمان المعلومات (ISMS)
- تقييم المخاطر المنتظم
- سياسات الأمان الموثقة
- التحسين المستمر

#### ضوابط الأمان
```yaml
# مثال على ضوابط الوصول
access_controls:
  authentication:
    - multi_factor_authentication: required
    - password_policy: strong
    - session_timeout: 30_minutes
  
  authorization:
    - role_based_access: enabled
    - principle_of_least_privilege: enforced
    - regular_access_review: quarterly
```

### GDPR (General Data Protection Regulation)

#### حقوق المرضى
- **الحق في الوصول**: عرض البيانات الشخصية
- **الحق في التصحيح**: تعديل البيانات غير الصحيحة
- **الحق في المحو**: حذف البيانات الشخصية
- **الحق في النقل**: تصدير البيانات

#### تطبيق GDPR
```javascript
// API لتصدير بيانات المريض
app.get('/api/patients/:id/export', async (req, res) => {
  const patientId = req.params.id;
  
  // التحقق من الصلاحيات
  if (!canAccessPatientData(req.user, patientId)) {
    return res.status(403).json({ error: 'غير مصرح' });
  }
  
  // تسجيل طلب التصدير
  await logDataExport(req.user.id, patientId);
  
  // تصدير البيانات
  const patientData = await exportPatientData(patientId);
  
  res.json({
    exportDate: new Date().toISOString(),
    dataSubject: patientId,
    data: patientData
  });
});
```

## أمان البيانات

### تشفير البيانات

#### التشفير أثناء التخزين
```javascript
const crypto = require('crypto');

// تشفير البيانات الحساسة
const encryptSensitiveData = (data, key) => {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
};

// مثال على تشفير رقم الهوية
const encryptedNationalId = encryptSensitiveData(
  patient.nationalId, 
  process.env.ENCRYPTION_KEY
);
```

#### التشفير أثناء النقل
```nginx
# إعدادات SSL/TLS في Nginx
server {
    listen 443 ssl http2;
    
    # شهادات SSL
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # إعدادات التشفير القوية
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # إعدادات إضافية
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
}
```

### حماية قاعدة البيانات

#### تشفير MongoDB
```javascript
// إعدادات تشفير MongoDB
const mongoOptions = {
  ssl: true,
  sslValidate: true,
  sslCA: fs.readFileSync('/path/to/ca.pem'),
  authSource: 'admin',
  authMechanism: 'SCRAM-SHA-256'
};

// اتصال آمن
mongoose.connect(process.env.MONGODB_URI, mongoOptions);
```

#### النسخ الاحتياطية المشفرة
```bash
#!/bin/bash
# سكريبت النسخ الاحتياطي المشفر

BACKUP_DIR="/secure/backups"
DATE=$(date +%Y%m%d_%H%M%S)
ENCRYPTION_KEY="/secure/keys/backup.key"

# إنشاء النسخة الاحتياطية
mongodump --host localhost --port 27017 --db hospital_erp --out /tmp/backup_$DATE

# تشفير النسخة الاحتياطية
tar -czf - /tmp/backup_$DATE | openssl enc -aes-256-cbc -salt -k $(cat $ENCRYPTION_KEY) > $BACKUP_DIR/backup_$DATE.tar.gz.enc

# حذف النسخة غير المشفرة
rm -rf /tmp/backup_$DATE

echo "تم إنشاء نسخة احتياطية مشفرة: backup_$DATE.tar.gz.enc"
```

### إخفاء الهوية (Data Anonymization)

```javascript
// إخفاء هوية البيانات للأبحاث
const anonymizePatientData = (patient) => {
  return {
    id: hashId(patient.id),
    age: calculateAgeGroup(patient.dateOfBirth),
    gender: patient.gender,
    diagnosis: patient.diagnosis,
    treatment: patient.treatment,
    // إزالة المعرفات الشخصية
    // name, nationalId, phone, email محذوفة
  };
};

const hashId = (id) => {
  return crypto.createHash('sha256')
    .update(id + process.env.ANONYMIZATION_SALT)
    .digest('hex')
    .substring(0, 16);
};
```

## المصادقة والتفويض

### المصادقة متعددة العوامل (MFA)

#### تطبيق MFA
```javascript
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// إنشاء سر TOTP للمستخدم
const generateMFASecret = async (userId) => {
  const secret = speakeasy.generateSecret({
    name: `Hospital ERP (${userId})`,
    issuer: 'Hospital Management System'
  });
  
  // حفظ السر في قاعدة البيانات (مشفر)
  await User.findByIdAndUpdate(userId, {
    mfaSecret: encrypt(secret.base32),
    mfaEnabled: false // سيتم تفعيله بعد التحقق
  });
  
  // إنشاء QR Code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
  
  return {
    secret: secret.base32,
    qrCode: qrCodeUrl
  };
};

// التحقق من رمز MFA
const verifyMFA = (token, secret) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2 // السماح بـ ±2 فترات زمنية
  });
};
```

#### تسجيل الدخول مع MFA
```javascript
app.post('/api/auth/login', async (req, res) => {
  const { email, password, mfaToken } = req.body;
  
  try {
    // التحقق من البيانات الأساسية
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'بيانات دخول غير صحيحة' });
    }
    
    // التحقق من MFA إذا كان مفعل
    if (user.mfaEnabled) {
      if (!mfaToken) {
        return res.status(200).json({ 
          requiresMFA: true,
          message: 'يرجى إدخال رمز التحقق' 
        });
      }
      
      const secret = decrypt(user.mfaSecret);
      if (!verifyMFA(mfaToken, secret)) {
        return res.status(401).json({ error: 'رمز التحقق غير صحيح' });
      }
    }
    
    // إنشاء JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    // تسجيل تسجيل الدخول
    await logSecurityEvent({
      type: 'LOGIN_SUCCESS',
      userId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ token, user: sanitizeUser(user) });
    
  } catch (error) {
    await logSecurityEvent({
      type: 'LOGIN_ERROR',
      email,
      error: error.message,
      ipAddress: req.ip
    });
    
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});
```

### التحكم في الوصول القائم على الأدوار (RBAC)

#### تعريف الأدوار والصلاحيات
```javascript
const roles = {
  admin: {
    permissions: ['*'] // جميع الصلاحيات
  },
  doctor: {
    permissions: [
      'patients:read',
      'patients:write',
      'medical_records:read',
      'medical_records:write',
      'prescriptions:write',
      'appointments:read',
      'appointments:write'
    ]
  },
  nurse: {
    permissions: [
      'patients:read',
      'patients:update_vitals',
      'medical_records:read',
      'appointments:read',
      'medications:administer'
    ]
  },
  pharmacist: {
    permissions: [
      'prescriptions:read',
      'prescriptions:dispense',
      'inventory:read',
      'inventory:update'
    ]
  }
};

// middleware للتحقق من الصلاحيات
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    const userPermissions = roles[userRole]?.permissions || [];
    
    // التحقق من الصلاحية الشاملة
    if (userPermissions.includes('*')) {
      return next();
    }
    
    // التحقق من الصلاحية المحددة
    if (userPermissions.includes(requiredPermission)) {
      return next();
    }
    
    // تسجيل محاولة الوصول غير المصرح
    logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      userId: req.user.id,
      requiredPermission,
      userRole,
      endpoint: req.path,
      ipAddress: req.ip
    });
    
    res.status(403).json({ error: 'غير مصرح لك بهذا الإجراء' });
  };
};
```

#### التحكم في الوصول للبيانات
```javascript
// التحكم في وصول الأطباء لبيانات المرضى
const canAccessPatient = async (doctorId, patientId) => {
  // التحقق من وجود علاقة طبيب-مريض نشطة
  const relationship = await DoctorPatientRelationship.findOne({
    doctorId,
    patientId,
    status: 'active'
  });
  
  if (relationship) return true;
  
  // التحقق من وجود موعد مجدول
  const appointment = await Appointment.findOne({
    doctorId,
    patientId,
    date: { $gte: new Date() },
    status: { $in: ['scheduled', 'in_progress'] }
  });
  
  return !!appointment;
};

// middleware للتحقق من الوصول للمريض
const checkPatientAccess = async (req, res, next) => {
  const { patientId } = req.params;
  const { userId, role } = req.user;
  
  // المديرون لديهم وصول كامل
  if (role === 'admin') return next();
  
  // الأطباء يحتاجون علاقة مع المريض
  if (role === 'doctor') {
    const hasAccess = await canAccessPatient(userId, patientId);
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'غير مصرح لك بالوصول لبيانات هذا المريض' 
      });
    }
  }
  
  next();
};
```

## أمان الشبكة

### جدار الحماية (Firewall)

#### إعدادات UFW
```bash
# السماح بالخدمات الأساسية فقط
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (مع تقييد IP إذا أمكن)
sudo ufw allow from 192.168.1.0/24 to any port 22

# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# قواعد البيانات (محلي فقط)
sudo ufw deny 27017  # MongoDB
sudo ufw deny 6379   # Redis

# تفعيل الجدار
sudo ufw enable
```

#### إعدادات iptables المتقدمة
```bash
#!/bin/bash
# سكريبت جدار الحماية المتقدم

# مسح القواعد الحالية
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X

# السياسة الافتراضية
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# السماح بالاتصالات المحلية
iptables -A INPUT -i lo -j ACCEPT

# السماح بالاتصالات المؤسسة
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# حماية من DDoS
iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT

# منع port scanning
iptables -A INPUT -m conntrack --ctstate NEW -m recent --set
iptables -A INPUT -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 10 -j DROP
```

### شبكة VPN

#### إعداد OpenVPN للوصول الآمن
```bash
# تثبيت OpenVPN
sudo apt install openvpn easy-rsa -y

# إعداد CA
make-cadir ~/openvpn-ca
cd ~/openvpn-ca
source vars
./clean-all
./build-ca

# إنشاء شهادة الخادم
./build-key-server server

# إنشاء مفاتيح العملاء
./build-key client1
./build-key client2
```

### مراقبة الشبكة

#### استخدام Fail2Ban
```ini
# /etc/fail2ban/jail.local
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[hospital-erp-auth]
enabled = true
filter = hospital-erp-auth
logpath = /var/log/hospital-erp/security.log
maxretry = 5
```

## أمان التطبيق

### حماية من الثغرات الشائعة

#### حماية من SQL Injection
```javascript
// استخدام Mongoose مع التحقق من المدخلات
const mongoose = require('mongoose');

// تعريف Schema مع التحقق
const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    validate: {
      validator: (v) => /^[a-zA-Zأ-ي\s]+$/.test(v),
      message: 'الاسم يجب أن يحتوي على أحرف فقط'
    }
  },
  nationalId: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (v) => /^\d{10}$/.test(v),
      message: 'رقم الهوية يجب أن يكون 10 أرقام'
    }
  }
});

// استخدام parameterized queries
const findPatientByNationalId = async (nationalId) => {
  // التحقق من صحة المدخل
  if (!/^\d{10}$/.test(nationalId)) {
    throw new Error('رقم هوية غير صحيح');
  }
  
  return await Patient.findOne({ nationalId });
};
```

#### حماية من XSS
```javascript
const helmet = require('helmet');
const xss = require('xss');

// استخدام Helmet للحماية
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));

// تنظيف المدخلات
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return xss(input, {
      whiteList: {}, // لا توجد علامات HTML مسموحة
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    });
  }
  return input;
};

// middleware لتنظيف جميع المدخلات
app.use((req, res, next) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  next();
});
```

#### حماية من CSRF
```javascript
const csrf = require('csurf');

// إعداد CSRF protection
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// تطبيق الحماية على الطرق المهمة
app.use('/api/patients', csrfProtection);
app.use('/api/medical-records', csrfProtection);
app.use('/api/prescriptions', csrfProtection);

// إرسال CSRF token للعميل
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

### التحقق من صحة المدخلات

```javascript
const Joi = require('joi');

// تعريف schemas للتحقق
const patientSchema = Joi.object({
  name: Joi.string().min(2).max(100).pattern(/^[a-zA-Zأ-ي\s]+$/).required(),
  dateOfBirth: Joi.date().max('now').required(),
  gender: Joi.string().valid('male', 'female').required(),
  nationalId: Joi.string().pattern(/^\d{10}$/).required(),
  phone: Joi.string().pattern(/^\+966[0-9]{9}$/).required(),
  email: Joi.string().email().optional(),
  address: Joi.object({
    street: Joi.string().max(200).required(),
    city: Joi.string().max(50).required(),
    zipCode: Joi.string().pattern(/^\d{5}$/).required()
  }).required()
});

// middleware للتحقق
const validatePatient = (req, res, next) => {
  const { error, value } = patientSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'بيانات غير صحيحة',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  req.body = value;
  next();
};
```

## مراقبة الأمان

### تسجيل الأحداث الأمنية

```javascript
const winston = require('winston');

// إعداد logger للأمان
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: '/var/log/hospital-erp/security.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    new winston.transports.Console()
  ]
});

// تسجيل الأحداث الأمنية
const logSecurityEvent = async (event) => {
  const securityEvent = {
    timestamp: new Date().toISOString(),
    type: event.type,
    severity: getSeverity(event.type),
    userId: event.userId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    details: event.details,
    sessionId: event.sessionId
  };
  
  securityLogger.info(securityEvent);
  
  // إرسال تنبيه للأحداث الحرجة
  if (securityEvent.severity === 'critical') {
    await sendSecurityAlert(securityEvent);
  }
};

// تحديد مستوى الخطورة
const getSeverity = (eventType) => {
  const severityMap = {
    'LOGIN_SUCCESS': 'info',
    'LOGIN_FAILURE': 'warning',
    'MULTIPLE_LOGIN_FAILURES': 'high',
    'UNAUTHORIZED_ACCESS': 'high',
    'DATA_BREACH_ATTEMPT': 'critical',
    'PRIVILEGE_ESCALATION': 'critical',
    'SUSPICIOUS_ACTIVITY': 'high'
  };
  
  return severityMap[eventType] || 'medium';
};
```

### مراقبة الأنشطة المشبوهة

```javascript
// كشف محاولات الدخول المتعددة
const detectBruteForce = async (email, ipAddress) => {
  const key = `login_attempts:${email}:${ipAddress}`;
  const attempts = await redis.incr(key);
  
  if (attempts === 1) {
    await redis.expire(key, 900); // 15 دقيقة
  }
  
  if (attempts >= 5) {
    await logSecurityEvent({
      type: 'MULTIPLE_LOGIN_FAILURES',
      email,
      ipAddress,
      attempts
    });
    
    // حظر IP مؤقتاً
    await redis.setex(`blocked_ip:${ipAddress}`, 3600, 'true');
    
    return true; // محظور
  }
  
  return false;
};

// كشف الأنشطة غير العادية
const detectAnomalousActivity = async (userId, activity) => {
  const userProfile = await getUserActivityProfile(userId);
  
  // فحص الوقت غير العادي
  const currentHour = new Date().getHours();
  if (currentHour < 6 || currentHour > 22) {
    if (!userProfile.nightShiftWorker) {
      await logSecurityEvent({
        type: 'UNUSUAL_TIME_ACCESS',
        userId,
        time: currentHour,
        activity
      });
    }
  }
  
  // فحص الموقع غير العادي
  const userLocation = await getUserLocation(userId);
  const currentLocation = await getLocationFromIP(activity.ipAddress);
  
  if (calculateDistance(userLocation, currentLocation) > 100) {
    await logSecurityEvent({
      type: 'UNUSUAL_LOCATION_ACCESS',
      userId,
      expectedLocation: userLocation,
      actualLocation: currentLocation,
      activity
    });
  }
};
```

### تنبيهات الأمان في الوقت الفعلي

```javascript
// إرسال تنبيهات الأمان
const sendSecurityAlert = async (event) => {
  const alert = {
    id: generateAlertId(),
    timestamp: event.timestamp,
    type: event.type,
    severity: event.severity,
    description: getEventDescription(event),
    affectedUser: event.userId,
    sourceIP: event.ipAddress,
    recommendedActions: getRecommendedActions(event.type)
  };
  
  // إرسال للفريق الأمني
  await notifySecurityTeam(alert);
  
  // إرسال عبر WebSocket للمديرين المتصلين
  io.to('security_admins').emit('security_alert', alert);
  
  // حفظ في قاعدة البيانات
  await SecurityAlert.create(alert);
};

// الإجراءات الموصى بها
const getRecommendedActions = (eventType) => {
  const actions = {
    'MULTIPLE_LOGIN_FAILURES': [
      'حظر عنوان IP مؤقتاً',
      'إعادة تعيين كلمة مرور المستخدم',
      'تفعيل المصادقة متعددة العوامل'
    ],
    'UNAUTHORIZED_ACCESS': [
      'مراجعة صلاحيات المستخدم',
      'تسجيل خروج جميع جلسات المستخدم',
      'تحقيق أمني فوري'
    ],
    'DATA_BREACH_ATTEMPT': [
      'عزل النظام المتأثر',
      'إشعار إدارة المستشفى',
      'تفعيل خطة الاستجابة للحوادث'
    ]
  };
  
  return actions[eventType] || ['مراجعة يدوية مطلوبة'];
};
```

## النسخ الاحتياطية والاستعادة

### استراتيجية النسخ الاحتياطية

#### قاعدة 3-2-1
- **3** نسخ من البيانات المهمة
- **2** وسائط تخزين مختلفة
- **1** نسخة خارج الموقع

#### جدولة النسخ الاحتياطية
```bash
# /etc/crontab
# نسخ احتياطية يومية للبيانات الحرجة
0 2 * * * root /usr/local/bin/backup-critical-data.sh

# نسخ احتياطية أسبوعية كاملة
0 1 * * 0 root /usr/local/bin/backup-full-system.sh

# نسخ احتياطية شهرية للأرشيف
0 0 1 * * root /usr/local/bin/backup-archive.sh
```

#### سكريبت النسخ الاحتياطي المتقدم
```bash
#!/bin/bash
# backup-critical-data.sh

set -e

# المتغيرات
BACKUP_DIR="/secure/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
ENCRYPTION_KEY="/secure/keys/backup.key"
LOG_FILE="/var/log/backup.log"

# دالة التسجيل
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# دالة التشفير
encrypt_backup() {
    local source=$1
    local destination=$2
    
    tar -czf - "$source" | openssl enc -aes-256-cbc -salt -k $(cat $ENCRYPTION_KEY) > "$destination"
}

# دالة التحقق من التكامل
verify_backup() {
    local backup_file=$1
    
    # حساب checksum
    sha256sum "$backup_file" > "${backup_file}.sha256"
    
    # التحقق من إمكانية فك التشفير
    openssl enc -aes-256-cbc -d -k $(cat $ENCRYPTION_KEY) -in "$backup_file" | tar -tzf - > /dev/null
    
    if [ $? -eq 0 ]; then
        log "تم التحقق من سلامة النسخة الاحتياطية: $backup_file"
        return 0
    else
        log "خطأ في التحقق من النسخة الاحتياطية: $backup_file"
        return 1
    fi
}

# النسخ الاحتياطي الرئيسي
main() {
    log "بدء النسخ الاحتياطي اليومي"
    
    # إنشاء مجلد النسخ الاحتياطية
    mkdir -p "$BACKUP_DIR/daily"
    
    # نسخ احتياطي لقاعدة البيانات
    log "نسخ احتياطي لقاعدة البيانات"
    mongodump --host localhost --port 27017 --db hospital_erp --out "/tmp/db_backup_$DATE"
    encrypt_backup "/tmp/db_backup_$DATE" "$BACKUP_DIR/daily/db_backup_$DATE.tar.gz.enc"
    verify_backup "$BACKUP_DIR/daily/db_backup_$DATE.tar.gz.enc"
    rm -rf "/tmp/db_backup_$DATE"
    
    # نسخ احتياطي للملفات المرفوعة
    log "نسخ احتياطي للملفات"
    encrypt_backup "/var/hospital-erp/uploads" "$BACKUP_DIR/daily/files_backup_$DATE.tar.gz.enc"
    verify_backup "$BACKUP_DIR/daily/files_backup_$DATE.tar.gz.enc"
    
    # نسخ احتياطي للإعدادات
    log "نسخ احتياطي للإعدادات"
    encrypt_backup "/etc/hospital-erp" "$BACKUP_DIR/daily/config_backup_$DATE.tar.gz.enc"
    verify_backup "$BACKUP_DIR/daily/config_backup_$DATE.tar.gz.enc"
    
    # حذف النسخ القديمة
    log "حذف النسخ الاحتياطية القديمة"
    find "$BACKUP_DIR/daily" -name "*.tar.gz.enc" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR/daily" -name "*.sha256" -mtime +$RETENTION_DAYS -delete
    
    # رفع للتخزين السحابي (اختياري)
    if [ -n "$CLOUD_BACKUP_ENABLED" ]; then
        log "رفع للتخزين السحابي"
        aws s3 sync "$BACKUP_DIR/daily" s3://hospital-erp-backups/daily/ --delete
    fi
    
    log "انتهاء النسخ الاحتياطي اليومي"
}

# تنفيذ السكريبت
main
```

### خطة الاستعادة من الكوارث

#### إجراءات الاستعادة السريعة
```bash
#!/bin/bash
# disaster-recovery.sh

# متغيرات الاستعادة
BACKUP_DIR="/secure/backups"
RECOVERY_DIR="/tmp/recovery"
ENCRYPTION_KEY="/secure/keys/backup.key"

# دالة الاستعادة
restore_from_backup() {
    local backup_file=$1
    local restore_path=$2
    
    echo "استعادة من: $backup_file"
    echo "إلى: $restore_path"
    
    # فك التشفير والاستخراج
    openssl enc -aes-256-cbc -d -k $(cat $ENCRYPTION_KEY) -in "$backup_file" | tar -xzf - -C "$restore_path"
    
    if [ $? -eq 0 ]; then
        echo "تمت الاستعادة بنجاح"
        return 0
    else
        echo "فشل في الاستعادة"
        return 1
    fi
}

# استعادة قاعدة البيانات
restore_database() {
    local backup_date=$1
    
    echo "استعادة قاعدة البيانات للتاريخ: $backup_date"
    
    # إيقاف الخدمة
    systemctl stop hospital-erp
    
    # استعادة قاعدة البيانات
    restore_from_backup "$BACKUP_DIR/daily/db_backup_$backup_date.tar.gz.enc" "$RECOVERY_DIR"
    
    # استيراد البيانات
    mongorestore --host localhost --port 27017 --db hospital_erp --drop "$RECOVERY_DIR/db_backup_$backup_date/hospital_erp"
    
    # تشغيل الخدمة
    systemctl start hospital-erp
    
    echo "تمت استعادة قاعدة البيانات"
}

# استعادة كاملة للنظام
full_system_restore() {
    local backup_date=$1
    
    echo "بدء الاستعادة الكاملة للنظام"
    
    # إيقاف جميع الخدمات
    systemctl stop hospital-erp nginx mongod redis
    
    # استعادة قاعدة البيانات
    restore_database $backup_date
    
    # استعادة الملفات
    restore_from_backup "$BACKUP_DIR/daily/files_backup_$backup_date.tar.gz.enc" "/var/hospital-erp"
    
    # استعادة الإعدادات
    restore_from_backup "$BACKUP_DIR/daily/config_backup_$backup_date.tar.gz.enc" "/etc"
    
    # تشغيل الخدمات
    systemctl start mongod redis nginx hospital-erp
    
    echo "تمت الاستعادة الكاملة للنظام"
}
```

## إدارة الحوادث الأمنية

### خطة الاستجابة للحوادث

#### مراحل الاستجابة
1. **الكشف والتحليل**
2. **الاحتواء والقضاء**
3. **الاستعادة**
4. **الدروس المستفادة**

#### إجراءات الطوارئ
```javascript
// نظام الاستجابة التلقائية للحوادث
const incidentResponse = {
  // كشف الحادث
  detectIncident: async (event) => {
    const incident = {
      id: generateIncidentId(),
      type: classifyIncident(event),
      severity: assessSeverity(event),
      timestamp: new Date(),
      status: 'detected',
      events: [event]
    };
    
    await Incident.create(incident);
    await triggerResponse(incident);
    
    return incident;
  },
  
  // تصنيف الحادث
  classifyIncident: (event) => {
    const classifications = {
      'MULTIPLE_LOGIN_FAILURES': 'brute_force_attack',
      'UNAUTHORIZED_ACCESS': 'access_violation',
      'DATA_BREACH_ATTEMPT': 'data_breach',
      'MALWARE_DETECTED': 'malware_infection',
      'SYSTEM_COMPROMISE': 'system_breach'
    };
    
    return classifications[event.type] || 'unknown';
  },
  
  // تقييم الخطورة
  assessSeverity: (event) => {
    const severityMatrix = {
      'brute_force_attack': 'medium',
      'access_violation': 'high',
      'data_breach': 'critical',
      'malware_infection': 'high',
      'system_breach': 'critical'
    };
    
    return severityMatrix[event.type] || 'low';
  },
  
  // تفعيل الاستجابة
  triggerResponse: async (incident) => {
    // إشعار فوري للفريق الأمني
    await notifySecurityTeam(incident);
    
    // تفعيل الإجراءات التلقائية
    await executeAutomatedResponse(incident);
    
    // تسجيل الحادث
    await logIncident(incident);
  }
};
```

#### الإجراءات التلقائية
```javascript
const executeAutomatedResponse = async (incident) => {
  switch (incident.type) {
    case 'brute_force_attack':
      // حظر IP المهاجم
      await blockAttackerIP(incident.events[0].ipAddress);
      
      // تفعيل MFA للمستخدم المستهدف
      await enforceUserMFA(incident.events[0].targetUser);
      break;
      
    case 'data_breach':
      // عزل النظام المتأثر
      await isolateAffectedSystem(incident.events[0].systemId);
      
      // تفعيل تشفير إضافي
      await enableEmergencyEncryption();
      
      // إشعار الإدارة العليا
      await notifyExecutiveTeam(incident);
      break;
      
    case 'system_breach':
      // إيقاف جميع الجلسات النشطة
      await terminateAllSessions();
      
      // تفعيل وضع الطوارئ
      await enableEmergencyMode();
      
      // بدء النسخ الاحتياطي الطارئ
      await initiateEmergencyBackup();
      break;
  }
};
```

### التحقيق الرقمي

#### جمع الأدلة
```javascript
const collectDigitalEvidence = async (incidentId) => {
  const evidence = {
    incidentId,
    collectionTime: new Date(),
    collector: 'automated_system',
    items: []
  };
  
  // جمع سجلات النظام
  const systemLogs = await collectSystemLogs(incidentId);
  evidence.items.push({
    type: 'system_logs',
    data: systemLogs,
    hash: calculateHash(systemLogs)
  });
  
  // جمع سجلات قاعدة البيانات
  const dbLogs = await collectDatabaseLogs(incidentId);
  evidence.items.push({
    type: 'database_logs',
    data: dbLogs,
    hash: calculateHash(dbLogs)
  });
  
  // جمع سجلات الشبكة
  const networkLogs = await collectNetworkLogs(incidentId);
  evidence.items.push({
    type: 'network_logs',
    data: networkLogs,
    hash: calculateHash(networkLogs)
  });
  
  // حفظ الأدلة بشكل آمن
  await storeEvidence(evidence);
  
  return evidence;
};

// حفظ الأدلة مع ضمان التكامل
const storeEvidence = async (evidence) => {
  // تشفير الأدلة
  const encryptedEvidence = encrypt(JSON.stringify(evidence));
  
  // حساب التوقيع الرقمي
  const signature = digitalSign(encryptedEvidence);
  
  // حفظ في مخزن آمن
  await EvidenceStore.create({
    incidentId: evidence.incidentId,
    data: encryptedEvidence,
    signature,
    timestamp: new Date(),
    chainOfCustody: [
      {
        handler: 'automated_system',
        action: 'collected',
        timestamp: new Date()
      }
    ]
  });
};
```

## التدريب والتوعية

### برنامج التوعية الأمنية

#### موضوعات التدريب
1. **أساسيات الأمان السيبراني**
2. **حماية كلمات المرور**
3. **التعرف على التصيد الإلكتروني**
4. **أمان البيانات الطبية**
5. **الاستجابة للحوادث**

#### اختبارات التصيد المحاكاة
```javascript
// نظام اختبار التصيد
const phishingSimulation = {
  // إنشاء حملة اختبار
  createCampaign: async (targetUsers, template) => {
    const campaign = {
      id: generateCampaignId(),
      name: template.name,
      targetUsers,
      startDate: new Date(),
      status: 'active',
      results: []
    };
    
    // إرسال رسائل اختبار
    for (const user of targetUsers) {
      await sendPhishingTest(user, template, campaign.id);
    }
    
    return campaign;
  },
  
  // تتبع النتائج
  trackResult: async (campaignId, userId, action) => {
    const result = {
      campaignId,
      userId,
      action, // 'clicked', 'reported', 'ignored'
      timestamp: new Date()
    };
    
    await PhishingResult.create(result);
    
    // إرسال تدريب إضافي للمستخدمين الذين نقروا
    if (action === 'clicked') {
      await scheduleSecurityTraining(userId);
    }
  },
  
  // تحليل النتائج
  analyzeResults: async (campaignId) => {
    const results = await PhishingResult.find({ campaignId });
    
    const analysis = {
      totalTargets: results.length,
      clickedCount: results.filter(r => r.action === 'clicked').length,
      reportedCount: results.filter(r => r.action === 'reported').length,
      ignoredCount: results.filter(r => r.action === 'ignored').length
    };
    
    analysis.clickRate = (analysis.clickedCount / analysis.totalTargets) * 100;
    analysis.reportRate = (analysis.reportedCount / analysis.totalTargets) * 100;
    
    return analysis;
  }
};
```

### مقاييس الأمان

#### مؤشرات الأداء الرئيسية (KPIs)
```javascript
const securityMetrics = {
  // معدل الحوادث الأمنية
  calculateIncidentRate: async (period) => {
    const incidents = await Incident.find({
      timestamp: { $gte: period.start, $lte: period.end }
    });
    
    return {
      total: incidents.length,
      critical: incidents.filter(i => i.severity === 'critical').length,
      high: incidents.filter(i => i.severity === 'high').length,
      medium: incidents.filter(i => i.severity === 'medium').length,
      low: incidents.filter(i => i.severity === 'low').length
    };
  },
  
  // وقت الاستجابة للحوادث
  calculateResponseTime: async (period) => {
    const incidents = await Incident.find({
      timestamp: { $gte: period.start, $lte: period.end },
      status: 'resolved'
    });
    
    const responseTimes = incidents.map(incident => {
      const detectionTime = new Date(incident.timestamp);
      const responseTime = new Date(incident.responseTimestamp);
      return responseTime - detectionTime;
    });
    
    return {
      average: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      median: responseTimes.sort()[Math.floor(responseTimes.length / 2)],
      max: Math.max(...responseTimes),
      min: Math.min(...responseTimes)
    };
  },
  
  // معدل نجاح اختبارات التصيد
  calculatePhishingSuccessRate: async (period) => {
    const campaigns = await PhishingCampaign.find({
      startDate: { $gte: period.start, $lte: period.end }
    });
    
    let totalTargets = 0;
    let totalClicks = 0;
    let totalReports = 0;
    
    for (const campaign of campaigns) {
      const results = await PhishingResult.find({ campaignId: campaign.id });
      totalTargets += results.length;
      totalClicks += results.filter(r => r.action === 'clicked').length;
      totalReports += results.filter(r => r.action === 'reported').length;
    }
    
    return {
      clickRate: (totalClicks / totalTargets) * 100,
      reportRate: (totalReports / totalTargets) * 100,
      awarenessScore: ((totalReports - totalClicks) / totalTargets) * 100
    };
  }
};
```

---

**هذا الدليل يوفر إطار عمل شامل لضمان أمان نظام إدارة المستشفيات. يجب مراجعة وتحديث هذه الإجراءات بانتظام للتأكد من فعاليتها ضد التهديدات المتطورة.**