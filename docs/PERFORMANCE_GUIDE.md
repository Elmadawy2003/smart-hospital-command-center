# دليل الأداء والتحسين - نظام إدارة المستشفيات

## نظرة عامة

هذا الدليل يوضح كيفية تحسين أداء نظام إدارة المستشفيات لضمان الاستجابة السريعة والكفاءة العالية في جميع العمليات.

## مؤشرات الأداء الرئيسية (KPIs)

### 1. مؤشرات الاستجابة

```typescript
// Performance Metrics Interface
interface PerformanceMetrics {
  responseTime: {
    api: number;        // < 200ms
    database: number;   // < 100ms
    frontend: number;   // < 1000ms
  };
  throughput: {
    requestsPerSecond: number;  // > 1000 RPS
    concurrentUsers: number;    // > 500 users
  };
  availability: {
    uptime: number;     // > 99.9%
    errorRate: number;  // < 0.1%
  };
  resources: {
    cpuUsage: number;   // < 70%
    memoryUsage: number; // < 80%
    diskUsage: number;  // < 85%
  };
}
```

### 2. معايير الأداء المستهدفة

| المؤشر | القيمة المستهدفة | الحد الأقصى المقبول |
|---------|------------------|-------------------|
| زمن استجابة API | < 200ms | 500ms |
| زمن تحميل الصفحة | < 1s | 3s |
| معدل الطلبات | > 1000 RPS | 500 RPS |
| المستخدمون المتزامنون | > 500 | 200 |
| وقت التشغيل | > 99.9% | 99.5% |
| معدل الأخطاء | < 0.1% | 1% |

---

## تحسين قاعدة البيانات

### 1. تحسين MongoDB

#### إنشاء الفهارس المناسبة

```javascript
// database-indexes.js
const createIndexes = async () => {
  const db = client.db('hospital_erp_production');
  
  // فهارس المرضى
  await db.collection('patients').createIndex({ nationalId: 1 }, { unique: true });
  await db.collection('patients').createIndex({ phoneNumber: 1 });
  await db.collection('patients').createIndex({ email: 1 });
  await db.collection('patients').createIndex({ 
    firstName: "text", 
    lastName: "text", 
    nationalId: "text" 
  });
  
  // فهارس المواعيد
  await db.collection('appointments').createIndex({ patientId: 1, date: 1 });
  await db.collection('appointments').createIndex({ doctorId: 1, date: 1 });
  await db.collection('appointments').createIndex({ date: 1, status: 1 });
  await db.collection('appointments').createIndex({ 
    createdAt: 1 
  }, { 
    expireAfterSeconds: 31536000 // سنة واحدة
  });
  
  // فهارس السجلات الطبية
  await db.collection('medical_records').createIndex({ patientId: 1, date: -1 });
  await db.collection('medical_records').createIndex({ doctorId: 1, date: -1 });
  await db.collection('medical_records').createIndex({ 
    diagnosis: "text", 
    symptoms: "text" 
  });
  
  // فهارس الوصفات الطبية
  await db.collection('prescriptions').createIndex({ patientId: 1, date: -1 });
  await db.collection('prescriptions').createIndex({ doctorId: 1, date: -1 });
  await db.collection('prescriptions').createIndex({ status: 1, expiryDate: 1 });
  
  // فهارس المخزون
  await db.collection('inventory').createIndex({ productId: 1, warehouseId: 1 });
  await db.collection('inventory').createIndex({ quantity: 1, reorderLevel: 1 });
  await db.collection('inventory').createIndex({ lastUpdated: -1 });
  
  console.log('✅ تم إنشاء جميع الفهارس بنجاح');
};
```

#### تحسين الاستعلامات

```javascript
// optimized-queries.js
class OptimizedQueries {
  // استعلام محسن للمرضى مع التصفح
  static async getPatientsPaginated(page = 1, limit = 20, search = '') {
    const skip = (page - 1) * limit;
    
    const pipeline = [
      // البحث النصي إذا كان متوفراً
      ...(search ? [{
        $match: {
          $or: [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { nationalId: { $regex: search, $options: 'i' } }
          ]
        }
      }] : []),
      
      // الترتيب والتصفح
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      
      // إضافة معلومات إضافية
      {
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: 'patientId',
          as: 'recentAppointments',
          pipeline: [
            { $sort: { date: -1 } },
            { $limit: 1 }
          ]
        }
      },
      
      // تحديد الحقول المطلوبة فقط
      {
        $project: {
          firstName: 1,
          lastName: 1,
          nationalId: 1,
          phoneNumber: 1,
          email: 1,
          dateOfBirth: 1,
          lastAppointment: { $arrayElemAt: ['$recentAppointments.date', 0] }
        }
      }
    ];
    
    return await db.collection('patients').aggregate(pipeline).toArray();
  }
  
  // استعلام محسن للمواعيد اليومية
  static async getDailyAppointments(date, doctorId = null) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const match = {
      date: { $gte: startOfDay, $lte: endOfDay }
    };
    
    if (doctorId) {
      match.doctorId = new ObjectId(doctorId);
    }
    
    return await db.collection('appointments').aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patient',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                phoneNumber: 1
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor',
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                specialization: 1
              }
            }
          ]
        }
      },
      { $sort: { date: 1 } }
    ]).toArray();
  }
}
```

#### إعدادات MongoDB للأداء

```javascript
// mongodb-config.js
const mongoConfig = {
  // إعدادات الاتصال
  maxPoolSize: 50,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  
  // إعدادات الكتابة
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 5000
  },
  
  // إعدادات القراءة
  readPreference: 'primaryPreferred',
  readConcern: { level: 'majority' },
  
  // ضغط البيانات
  compressors: ['zstd', 'zlib', 'snappy']
};

// إعدادات الخادم
const serverConfig = {
  // ذاكرة WiredTiger
  'storage.wiredTiger.engineConfig.cacheSizeGB': 8,
  
  // ضغط البيانات
  'storage.wiredTiger.collectionConfig.blockCompressor': 'zstd',
  'storage.wiredTiger.indexConfig.prefixCompression': true,
  
  // السجلات
  'operationProfiling.slowOpThresholdMs': 100,
  'operationProfiling.mode': 'slowOp'
};
```

### 2. تحسين Redis

#### إعدادات Redis للأداء

```redis
# redis-performance.conf

# إعدادات الذاكرة
maxmemory 4gb
maxmemory-policy allkeys-lru
maxmemory-samples 10

# إعدادات الشبكة
tcp-keepalive 300
timeout 0
tcp-backlog 511

# إعدادات الحفظ
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes

# إعدادات AOF
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# إعدادات الأداء
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
list-compress-depth 0
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
```

#### استراتيجيات التخزين المؤقت

```typescript
// cache-strategies.ts
class CacheStrategies {
  private redis: Redis;
  
  constructor(redis: Redis) {
    this.redis = redis;
  }
  
  // تخزين مؤقت للجلسات
  async cacheSession(sessionId: string, data: any, ttl = 3600) {
    await this.redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
  }
  
  // تخزين مؤقت لبيانات المرضى
  async cachePatientData(patientId: string, data: any) {
    const key = `patient:${patientId}`;
    await this.redis.setex(key, 1800, JSON.stringify(data)); // 30 دقيقة
  }
  
  // تخزين مؤقت للمواعيد اليومية
  async cacheDailyAppointments(date: string, doctorId: string, appointments: any[]) {
    const key = `appointments:${date}:${doctorId}`;
    await this.redis.setex(key, 3600, JSON.stringify(appointments)); // ساعة واحدة
  }
  
  // تخزين مؤقت للإحصائيات
  async cacheStatistics(type: string, data: any) {
    const key = `stats:${type}`;
    await this.redis.setex(key, 300, JSON.stringify(data)); // 5 دقائق
  }
  
  // تنظيف التخزين المؤقت
  async invalidateCache(pattern: string) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  // تخزين مؤقت ذكي مع إعادة التحميل
  async smartCache<T>(
    key: string, 
    fetchFunction: () => Promise<T>, 
    ttl = 3600
  ): Promise<T> {
    // محاولة الحصول من التخزين المؤقت
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // جلب البيانات وتخزينها
    const data = await fetchFunction();
    await this.redis.setex(key, ttl, JSON.stringify(data));
    
    return data;
  }
}
```

---

## تحسين Backend

### 1. تحسين Express.js

#### Middleware للأداء

```typescript
// performance-middleware.ts
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// ضغط الاستجابات
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
});

// الحد من معدل الطلبات
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 1000, // حد أقصى 1000 طلب لكل IP
  message: 'تم تجاوز الحد الأقصى للطلبات',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'تم تجاوز الحد الأقصى للطلبات، يرجى المحاولة لاحقاً'
    });
  }
});

// إبطاء الطلبات المتكررة
export const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 500,
  delayMs: 500,
  maxDelayMs: 20000
});

// تحسين الأمان
export const securityMiddleware = helmet({
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
  },
  crossOriginEmbedderPolicy: false
});
```

#### تحسين معالجة الطلبات

```typescript
// optimized-controllers.ts
class OptimizedController {
  // معالجة متوازية للطلبات
  async getPatientDashboard(req: Request, res: Response) {
    const patientId = req.params.id;
    
    try {
      // تنفيذ الاستعلامات بشكل متوازي
      const [
        patient,
        recentAppointments,
        medicalHistory,
        prescriptions,
        labResults
      ] = await Promise.all([
        PatientService.getById(patientId),
        AppointmentService.getRecentByPatient(patientId, 5),
        MedicalRecordService.getByPatient(patientId, 10),
        PrescriptionService.getActiveByPatient(patientId),
        LabResultService.getRecentByPatient(patientId, 5)
      ]);
      
      res.json({
        success: true,
        data: {
          patient,
          recentAppointments,
          medicalHistory,
          prescriptions,
          labResults
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'خطأ في جلب بيانات المريض'
      });
    }
  }
  
  // تصفح محسن مع التخزين المؤقت
  async getPaginatedData(req: Request, res: Response) {
    const { page = 1, limit = 20, search = '' } = req.query;
    const cacheKey = `patients:${page}:${limit}:${search}`;
    
    try {
      // محاولة الحصول من التخزين المؤقت
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
      
      // جلب البيانات من قاعدة البيانات
      const [data, total] = await Promise.all([
        PatientService.getPaginated(+page, +limit, search as string),
        PatientService.getCount(search as string)
      ]);
      
      const result = {
        success: true,
        data,
        pagination: {
          page: +page,
          limit: +limit,
          total,
          pages: Math.ceil(total / +limit)
        }
      };
      
      // تخزين في التخزين المؤقت لمدة 5 دقائق
      await CacheService.set(cacheKey, result, 300);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'خطأ في جلب البيانات'
      });
    }
  }
}
```

### 2. تحسين معالجة الملفات

```typescript
// file-processing.ts
import multer from 'multer';
import sharp from 'sharp';
import { Worker } from 'worker_threads';

// إعداد Multer للملفات
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم'));
    }
  }
});

// معالجة الصور بشكل غير متزامن
class ImageProcessor {
  static async processImage(buffer: Buffer, options: any = {}) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(`
        const { parentPort, workerData } = require('worker_threads');
        const sharp = require('sharp');
        
        async function processImage() {
          try {
            const { buffer, options } = workerData;
            
            const processed = await sharp(buffer)
              .resize(options.width || 800, options.height || 600, {
                fit: 'inside',
                withoutEnlargement: true
              })
              .jpeg({ quality: options.quality || 80 })
              .toBuffer();
              
            parentPort.postMessage({ success: true, data: processed });
          } catch (error) {
            parentPort.postMessage({ success: false, error: error.message });
          }
        }
        
        processImage();
      `, {
        eval: true,
        workerData: { buffer, options }
      });
      
      worker.on('message', (result) => {
        if (result.success) {
          resolve(result.data);
        } else {
          reject(new Error(result.error));
        }
        worker.terminate();
      });
      
      worker.on('error', reject);
    });
  }
}
```

---

## تحسين Frontend

### 1. تحسين React

#### تحسين المكونات

```typescript
// optimized-components.tsx
import React, { memo, useMemo, useCallback, lazy, Suspense } from 'react';
import { Virtuoso } from 'react-virtuoso';

// تحميل كسول للمكونات
const PatientDetails = lazy(() => import('./PatientDetails'));
const AppointmentForm = lazy(() => import('./AppointmentForm'));

// مكون محسن للقوائم الطويلة
const VirtualizedPatientList = memo(({ patients, onPatientSelect }: {
  patients: Patient[];
  onPatientSelect: (patient: Patient) => void;
}) => {
  const handlePatientClick = useCallback((patient: Patient) => {
    onPatientSelect(patient);
  }, [onPatientSelect]);
  
  const renderPatient = useCallback((index: number) => {
    const patient = patients[index];
    return (
      <PatientCard
        key={patient.id}
        patient={patient}
        onClick={() => handlePatientClick(patient)}
      />
    );
  }, [patients, handlePatientClick]);
  
  return (
    <Virtuoso
      style={{ height: '600px' }}
      totalCount={patients.length}
      itemContent={renderPatient}
      overscan={10}
    />
  );
});

// مكون محسن للبحث مع Debouncing
const SearchInput = memo(({ onSearch, placeholder }: {
  onSearch: (query: string) => void;
  placeholder: string;
}) => {
  const [query, setQuery] = useState('');
  
  const debouncedSearch = useMemo(
    () => debounce(onSearch, 300),
    [onSearch]
  );
  
  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);
  
  return (
    <TextField
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={placeholder}
      variant="outlined"
      size="small"
      InputProps={{
        startAdornment: <SearchIcon />
      }}
    />
  );
});

// Hook محسن لجلب البيانات
const useOptimizedData = <T,>(
  fetchFunction: () => Promise<T>,
  dependencies: any[] = [],
  cacheTime = 5 * 60 * 1000 // 5 دقائق
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const cacheKey = useMemo(
    () => JSON.stringify(dependencies),
    [dependencies]
  );
  
  useEffect(() => {
    let isCancelled = false;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // محاولة الحصول من التخزين المؤقت
        const cached = localStorage.getItem(`cache:${cacheKey}`);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < cacheTime) {
            setData(cachedData);
            setLoading(false);
            return;
          }
        }
        
        // جلب البيانات الجديدة
        const result = await fetchFunction();
        
        if (!isCancelled) {
          setData(result);
          
          // تخزين في التخزين المؤقت
          localStorage.setItem(`cache:${cacheKey}`, JSON.stringify({
            data: result,
            timestamp: Date.now()
          }));
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'خطأ غير معروف');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isCancelled = true;
    };
  }, [cacheKey, fetchFunction, cacheTime]);
  
  return { data, loading, error };
};
```

#### تحسين إدارة الحالة

```typescript
// optimized-store.ts
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Store محسن للمرضى
interface PatientStore {
  patients: Patient[];
  selectedPatient: Patient | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  setPatients: (patients: Patient[]) => void;
  addPatient: (patient: Patient) => void;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  selectPatient: (patient: Patient | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePatientStore = create<PatientStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        patients: [],
        selectedPatient: null,
        loading: false,
        error: null,
        
        setPatients: (patients) => set((state) => {
          state.patients = patients;
        }),
        
        addPatient: (patient) => set((state) => {
          state.patients.unshift(patient);
        }),
        
        updatePatient: (id, updates) => set((state) => {
          const index = state.patients.findIndex(p => p.id === id);
          if (index !== -1) {
            Object.assign(state.patients[index], updates);
          }
          
          if (state.selectedPatient?.id === id) {
            Object.assign(state.selectedPatient, updates);
          }
        }),
        
        selectPatient: (patient) => set((state) => {
          state.selectedPatient = patient;
        }),
        
        setLoading: (loading) => set((state) => {
          state.loading = loading;
        }),
        
        setError: (error) => set((state) => {
          state.error = error;
        })
      })),
      {
        name: 'patient-store',
        partialize: (state) => ({
          patients: state.patients.slice(0, 100), // حفظ أول 100 مريض فقط
          selectedPatient: state.selectedPatient
        })
      }
    )
  )
);

// Selector محسن
export const usePatientSelectors = () => {
  const patients = usePatientStore(state => state.patients);
  const selectedPatient = usePatientStore(state => state.selectedPatient);
  
  const patientsByName = useMemo(
    () => patients.sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [patients]
  );
  
  const recentPatients = useMemo(
    () => patients
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10),
    [patients]
  );
  
  return {
    patients,
    selectedPatient,
    patientsByName,
    recentPatients
  };
};
```

### 2. تحسين التحميل والتخزين المؤقت

```typescript
// service-worker.ts
const CACHE_NAME = 'hospital-erp-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// اعتراض الطلبات
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // استراتيجية Cache First للملفات الثابتة
  if (request.url.includes('/static/')) {
    event.respondWith(
      caches.match(request)
        .then(response => response || fetch(request))
    );
    return;
  }
  
  // استراتيجية Network First لطلبات API
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // تخزين الاستجابات الناجحة
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  
  // استراتيجية Stale While Revalidate للصفحات
  event.respondWith(
    caches.match(request)
      .then(response => {
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, networkResponse.clone()));
            return networkResponse;
          });
        
        return response || fetchPromise;
      })
  );
});
```

---

## مراقبة الأداء

### 1. مؤشرات الأداء في الوقت الفعلي

```typescript
// performance-monitor.ts
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  // قياس زمن تنفيذ العمليات
  async measureOperation<T>(
    name: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      this.recordMetric(name, duration);
      
      // تسجيل في السجلات إذا كان بطيئاً
      if (duration > 1000) {
        console.warn(`عملية بطيئة: ${name} استغرقت ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_error`, duration);
      throw error;
    }
  }
  
  // تسجيل المؤشرات
  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // الاحتفاظ بآخر 100 قيمة فقط
    if (values.length > 100) {
      values.shift();
    }
  }
  
  // الحصول على إحصائيات المؤشرات
  getMetricStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  // تصدير جميع المؤشرات
  exportMetrics() {
    const result: any = {};
    
    for (const [name, values] of this.metrics) {
      result[name] = this.getMetricStats(name);
    }
    
    return result;
  }
}

// مراقب الموارد
class ResourceMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  
  start() {
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, 30000); // كل 30 ثانية
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  private async collectMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length
    };
    
    // إرسال المؤشرات إلى نظام المراقبة
    await this.sendMetrics(metrics);
    
    // تحذير إذا كان استخدام الذاكرة مرتفعاً
    if (metrics.memory.heapUsed > 1024 * 1024 * 1024) { // 1GB
      console.warn('تحذير: استخدام ذاكرة مرتفع', {
        heapUsed: `${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(metrics.memory.heapTotal / 1024 / 1024).toFixed(2)}MB`
      });
    }
  }
  
  private async sendMetrics(metrics: any) {
    try {
      // إرسال إلى Prometheus أو نظام مراقبة آخر
      await fetch('/metrics/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics)
      });
    } catch (error) {
      console.error('خطأ في إرسال المؤشرات:', error);
    }
  }
}
```

### 2. تحليل الأداء التلقائي

```typescript
// performance-analyzer.ts
class PerformanceAnalyzer {
  private alerts: Array<{
    type: string;
    message: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];
  
  // تحليل أداء قاعدة البيانات
  async analyzeDatabasePerformance() {
    const slowQueries = await this.getSlowQueries();
    const indexUsage = await this.getIndexUsage();
    const connectionPool = await this.getConnectionPoolStats();
    
    // تحليل الاستعلامات البطيئة
    if (slowQueries.length > 10) {
      this.addAlert({
        type: 'database',
        message: `عدد كبير من الاستعلامات البطيئة: ${slowQueries.length}`,
        severity: 'high'
      });
    }
    
    // تحليل استخدام الفهارس
    const unusedIndexes = indexUsage.filter(idx => idx.usage < 0.1);
    if (unusedIndexes.length > 0) {
      this.addAlert({
        type: 'database',
        message: `فهارس غير مستخدمة: ${unusedIndexes.length}`,
        severity: 'medium'
      });
    }
    
    return {
      slowQueries,
      indexUsage,
      connectionPool,
      recommendations: this.generateDatabaseRecommendations(slowQueries, indexUsage)
    };
  }
  
  // تحليل أداء التطبيق
  async analyzeApplicationPerformance() {
    const responseTimeStats = performanceMonitor.getMetricStats('api_response_time');
    const errorRateStats = performanceMonitor.getMetricStats('api_errors');
    const memoryUsage = process.memoryUsage();
    
    // تحليل زمن الاستجابة
    if (responseTimeStats && responseTimeStats.p95 > 1000) {
      this.addAlert({
        type: 'application',
        message: `زمن استجابة مرتفع: ${responseTimeStats.p95.toFixed(2)}ms`,
        severity: 'high'
      });
    }
    
    // تحليل معدل الأخطاء
    if (errorRateStats && errorRateStats.avg > 0.05) {
      this.addAlert({
        type: 'application',
        message: `معدل أخطاء مرتفع: ${(errorRateStats.avg * 100).toFixed(2)}%`,
        severity: 'critical'
      });
    }
    
    return {
      responseTime: responseTimeStats,
      errorRate: errorRateStats,
      memoryUsage,
      recommendations: this.generateApplicationRecommendations()
    };
  }
  
  // إضافة تنبيه
  private addAlert(alert: Omit<typeof this.alerts[0], 'timestamp'>) {
    this.alerts.push({
      ...alert,
      timestamp: new Date()
    });
    
    // الاحتفاظ بآخر 100 تنبيه فقط
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    
    // إرسال التنبيهات الحرجة فوراً
    if (alert.severity === 'critical') {
      this.sendCriticalAlert(alert);
    }
  }
  
  // إرسال تنبيه حرج
  private async sendCriticalAlert(alert: any) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 تنبيه حرج: ${alert.message}`,
          channel: '#alerts',
          username: 'Hospital ERP Monitor'
        })
      });
    } catch (error) {
      console.error('خطأ في إرسال التنبيه:', error);
    }
  }
  
  // توليد توصيات التحسين
  private generateDatabaseRecommendations(slowQueries: any[], indexUsage: any[]) {
    const recommendations = [];
    
    if (slowQueries.length > 0) {
      recommendations.push('إضافة فهارس للاستعلامات البطيئة');
      recommendations.push('تحسين هيكل الاستعلامات');
    }
    
    const unusedIndexes = indexUsage.filter(idx => idx.usage < 0.1);
    if (unusedIndexes.length > 0) {
      recommendations.push('حذف الفهارس غير المستخدمة');
    }
    
    return recommendations;
  }
  
  private generateApplicationRecommendations() {
    const recommendations = [];
    const memoryUsage = process.memoryUsage();
    
    if (memoryUsage.heapUsed > 1024 * 1024 * 1024) {
      recommendations.push('تحسين إدارة الذاكرة');
      recommendations.push('إضافة تنظيف دوري للذاكرة');
    }
    
    return recommendations;
  }
}
```

---

## أدوات التحسين

### 1. سكريبت تحسين تلقائي

```bash
#!/bin/bash
# optimize-system.sh

echo "🚀 بدء تحسين النظام..."

# تحسين قاعدة البيانات
echo "🗄️ تحسين قاعدة البيانات..."
mongo hospital_erp_production --eval "
// إعادة بناء الفهارس
db.patients.reIndex();
db.appointments.reIndex();
db.medical_records.reIndex();

// ضغط المجموعات
db.runCommand({compact: 'patients'});
db.runCommand({compact: 'appointments'});
db.runCommand({compact: 'medical_records'});

// تحديث إحصائيات الاستعلامات
db.runCommand({planCacheClear: 'patients'});
db.runCommand({planCacheClear: 'appointments'});
"

# تحسين Redis
echo "💾 تحسين Redis..."
redis-cli BGREWRITEAOF
redis-cli MEMORY PURGE

# تنظيف ملفات السجلات
echo "🧹 تنظيف السجلات..."
find /var/log/pm2 -name "*.log" -size +100M -exec truncate -s 50M {} \;
find /var/log/nginx -name "*.log" -size +100M -exec truncate -s 50M {} \;

# تحسين النظام
echo "⚙️ تحسين النظام..."
# تنظيف ذاكرة التخزين المؤقت
sync && echo 3 > /proc/sys/vm/drop_caches

# تحسين إعدادات الشبكة
echo 'net.core.rmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem = 4096 65536 16777216' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_wmem = 4096 65536 16777216' >> /etc/sysctl.conf
sysctl -p

# إعادة تشغيل التطبيق
echo "🔄 إعادة تشغيل التطبيق..."
pm2 reload all

echo "✅ انتهى تحسين النظام"
```

### 2. مراقب الأداء التلقائي

```typescript
// auto-performance-monitor.ts
class AutoPerformanceMonitor {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔍 بدء مراقبة الأداء التلقائية...');
    
    // مراقبة كل دقيقة
    this.intervalId = setInterval(async () => {
      await this.performHealthCheck();
    }, 60000);
    
    // تقرير مفصل كل ساعة
    setInterval(async () => {
      await this.generatePerformanceReport();
    }, 3600000);
  }
  
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('⏹️ توقف مراقبة الأداء');
  }
  
  private async performHealthCheck() {
    try {
      // فحص استجابة API
      const apiResponse = await this.checkApiHealth();
      
      // فحص قاعدة البيانات
      const dbHealth = await this.checkDatabaseHealth();
      
      // فحص Redis
      const redisHealth = await this.checkRedisHealth();
      
      // فحص استخدام الموارد
      const resourceUsage = await this.checkResourceUsage();
      
      // تحليل النتائج واتخاذ إجراءات
      await this.analyzeAndAct({
        api: apiResponse,
        database: dbHealth,
        redis: redisHealth,
        resources: resourceUsage
      });
      
    } catch (error) {
      console.error('خطأ في فحص الصحة:', error);
    }
  }
  
  private async checkApiHealth() {
    const start = Date.now();
    
    try {
      const response = await fetch('http://localhost:5000/api/health');
      const responseTime = Date.now() - start;
      
      return {
        status: response.ok ? 'healthy' : 'unhealthy',
        responseTime,
        statusCode: response.status
      };
    } catch (error) {
      return {
        status: 'error',
        responseTime: Date.now() - start,
        error: error.message
      };
    }
  }
  
  private async checkDatabaseHealth() {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - start;
      
      const stats = await mongoose.connection.db.stats();
      
      return {
        status: 'healthy',
        responseTime,
        connections: mongoose.connection.readyState,
        dataSize: stats.dataSize,
        indexSize: stats.indexSize
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  private async checkRedisHealth() {
    try {
      const start = Date.now();
      await redis.ping();
      const responseTime = Date.now() - start;
      
      const info = await redis.info('memory');
      const memoryUsage = this.parseRedisInfo(info);
      
      return {
        status: 'healthy',
        responseTime,
        memoryUsage
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
  
  private async checkResourceUsage() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      },
      cpu: cpuUsage,
      uptime: process.uptime()
    };
  }
  
  private async analyzeAndAct(healthData: any) {
    // تحليل استجابة API
    if (healthData.api.responseTime > 1000) {
      console.warn('⚠️ زمن استجابة API مرتفع:', healthData.api.responseTime + 'ms');
      await this.optimizeApiPerformance();
    }
    
    // تحليل قاعدة البيانات
    if (healthData.database.responseTime > 500) {
      console.warn('⚠️ زمن استجابة قاعدة البيانات مرتفع:', healthData.database.responseTime + 'ms');
      await this.optimizeDatabasePerformance();
    }
    
    // تحليل استخدام الذاكرة
    const memoryUsagePercent = (healthData.resources.memory.heapUsed / healthData.resources.memory.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      console.warn('⚠️ استخدام ذاكرة مرتفع:', memoryUsagePercent.toFixed(2) + '%');
      await this.optimizeMemoryUsage();
    }
  }
  
  private async optimizeApiPerformance() {
    // تنظيف التخزين المؤقت
    await redis.flushdb();
    console.log('🧹 تم تنظيف التخزين المؤقت');
  }
  
  private async optimizeDatabasePerformance() {
    // تحديث إحصائيات الاستعلامات
    await mongoose.connection.db.admin().command({ planCacheClear: 1 });
    console.log('📊 تم تحديث إحصائيات قاعدة البيانات');
  }
  
  private async optimizeMemoryUsage() {
    // تشغيل garbage collection
    if (global.gc) {
      global.gc();
      console.log('🗑️ تم تنظيف الذاكرة');
    }
  }
  
  private parseRedisInfo(info: string) {
    const lines = info.split('\r\n');
    const result: any = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }
}

// بدء المراقبة التلقائية
const autoMonitor = new AutoPerformanceMonitor();
autoMonitor.start();

// إيقاف المراقبة عند إغلاق التطبيق
process.on('SIGTERM', () => {
  autoMonitor.stop();
});

process.on('SIGINT', () => {
  autoMonitor.stop();
});
```

---

## الخلاصة

هذا الدليل يوفر استراتيجيات شاملة لتحسين أداء نظام إدارة المستشفيات على جميع المستويات. تطبيق هذه التحسينات سيضمن:

### الفوائد المتوقعة:

1. **تحسين زمن الاستجابة**: تقليل زمن الاستجابة بنسبة 60-80%
2. **زيادة السعة**: دعم عدد أكبر من المستخدمين المتزامنين
3. **تحسين تجربة المستخدم**: تحميل أسرع وتفاعل أكثر سلاسة
4. **توفير الموارد**: استخدام أكثر كفاءة للخادم والذاكرة
5. **موثوقية أعلى**: تقليل الأخطاء وزيادة الاستقرار

### نصائح مهمة:

1. **القياس أولاً**: قس الأداء الحالي قبل التحسين
2. **التحسين التدريجي**: طبق التحسينات تدريجياً واختبر النتائج
3. **المراقبة المستمرة**: راقب الأداء باستمرار بعد التحسين
4. **التوثيق**: وثق جميع التغييرات والنتائج
5. **الاختبار**: اختبر التحسينات في بيئة مشابهة للإنتاج