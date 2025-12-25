# دليل المطورين - نظام إدارة المستشفيات

## نظرة عامة

هذا الدليل مخصص للمطورين الذين يعملون على تطوير وصيانة نظام إدارة المستشفيات. يغطي الدليل البنية التقنية، أفضل الممارسات، وإرشادات التطوير.

---

## البنية التقنية

### 1. هيكل المشروع

```
Hospital_ERP/
├── backend/                    # خادم Node.js
│   ├── src/
│   │   ├── controllers/        # وحدات التحكم
│   │   ├── models/            # نماذج قاعدة البيانات
│   │   ├── routes/            # مسارات API
│   │   ├── middleware/        # البرمجيات الوسطية
│   │   ├── services/          # خدمات الأعمال
│   │   ├── utils/             # أدوات مساعدة
│   │   ├── config/            # إعدادات النظام
│   │   └── types/             # تعريفات TypeScript
│   ├── tests/                 # اختبارات الوحدة والتكامل
│   ├── uploads/               # ملفات المرفوعة
│   └── logs/                  # ملفات السجلات
├── frontend/                  # تطبيق React
│   ├── src/
│   │   ├── components/        # مكونات React
│   │   ├── pages/            # صفحات التطبيق
│   │   ├── hooks/            # React Hooks مخصصة
│   │   ├── services/         # خدمات API
│   │   ├── store/            # إدارة الحالة
│   │   ├── utils/            # أدوات مساعدة
│   │   ├── types/            # تعريفات TypeScript
│   │   └── assets/           # الموارد الثابتة
│   ├── public/               # ملفات عامة
│   └── build/                # ملفات البناء
├── docs/                     # التوثيق
├── scripts/                  # سكريبتات التشغيل
└── docker/                   # إعدادات Docker
```

### 2. التقنيات المستخدمة

#### Backend
- **Node.js**: بيئة تشغيل JavaScript
- **TypeScript**: لغة البرمجة مع الأنواع الثابتة
- **Express.js**: إطار عمل الخادم
- **MongoDB**: قاعدة البيانات الرئيسية
- **Mongoose**: ODM لـ MongoDB
- **Redis**: قاعدة بيانات التخزين المؤقت
- **Socket.IO**: التواصل في الوقت الفعلي
- **JWT**: المصادقة والترخيص
- **Multer**: رفع الملفات
- **Sharp**: معالجة الصور
- **Nodemailer**: إرسال البريد الإلكتروني
- **Winston**: تسجيل الأحداث

#### Frontend
- **React**: مكتبة واجهة المستخدم
- **TypeScript**: لغة البرمجة
- **Material-UI**: مكتبة المكونات
- **React Router**: التنقل
- **Axios**: طلبات HTTP
- **React Query**: إدارة حالة الخادم
- **Zustand**: إدارة الحالة المحلية
- **React Hook Form**: إدارة النماذج
- **Recharts**: الرسوم البيانية
- **React Virtuoso**: القوائم الافتراضية

---

## إعداد بيئة التطوير

### 1. المتطلبات الأساسية

```bash
# Node.js (الإصدار 18 أو أحدث)
node --version

# npm أو yarn
npm --version

# Git
git --version

# MongoDB (محلي أو Atlas)
mongod --version

# Redis (اختياري للتطوير)
redis-server --version
```

### 2. إعداد المشروع

```bash
# استنساخ المستودع
git clone <repository-url>
cd Hospital_ERP

# تثبيت تبعيات Backend
cd backend
npm install

# تثبيت تبعيات Frontend
cd ../frontend
npm install

# العودة إلى المجلد الرئيسي
cd ..
```

### 3. إعداد متغيرات البيئة

```bash
# إنشاء ملف .env في مجلد backend
cp backend/.env.example backend/.env

# تحرير المتغيرات
nano backend/.env
```

```env
# متغيرات قاعدة البيانات
MONGODB_URI=mongodb://localhost:27017/hospital_erp_dev
REDIS_URL=redis://localhost:6379

# متغيرات المصادقة
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# متغيرات الخادم
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# متغيرات البريد الإلكتروني
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# متغيرات التخزين
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# متغيرات الأمان
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### 4. تشغيل النظام

```bash
# تشغيل Backend (في terminal منفصل)
cd backend
npm run dev

# تشغيل Frontend (في terminal منفصل)
cd frontend
npm start

# أو تشغيل كلاهما معاً
npm run dev:all
```

---

## أفضل الممارسات في التطوير

### 1. معايير الكود

#### TypeScript
```typescript
// استخدام أنواع صريحة
interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

// استخدام enums للثوابت
enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  NURSE = 'nurse',
  RECEPTIONIST = 'receptionist'
}

// استخدام generic types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}
```

#### تسمية الملفات والمجلدات
```
# Controllers
user.controller.ts
patient.controller.ts

# Models
User.model.ts
Patient.model.ts

# Services
user.service.ts
email.service.ts

# Types
user.types.ts
api.types.ts

# Components (React)
UserProfile.tsx
PatientList.tsx

# Hooks
useAuth.ts
usePatients.ts
```

### 2. هيكل Controller

```typescript
// user.controller.ts
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { ApiResponse } from '../types/api.types';
import { CreateUserDto, UpdateUserDto } from '../types/user.types';

export class UserController {
  // إنشاء مستخدم جديد
  static async createUser(
    req: Request<{}, ApiResponse<User>, CreateUserDto>,
    res: Response<ApiResponse<User>>,
    next: NextFunction
  ) {
    try {
      const userData = req.body;
      const user = await UserService.createUser(userData);
      
      res.status(201).json({
        success: true,
        data: user,
        message: 'تم إنشاء المستخدم بنجاح'
      });
    } catch (error) {
      next(error);
    }
  }

  // الحصول على جميع المستخدمين
  static async getUsers(
    req: Request,
    res: Response<ApiResponse<User[]>>,
    next: NextFunction
  ) {
    try {
      const { page = 1, limit = 10, search, role } = req.query;
      
      const result = await UserService.getUsers({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        role: role as UserRole
      });
      
      res.json({
        success: true,
        data: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  // تحديث مستخدم
  static async updateUser(
    req: Request<{ id: string }, ApiResponse<User>, UpdateUserDto>,
    res: Response<ApiResponse<User>>,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const user = await UserService.updateUser(id, updateData);
      
      res.json({
        success: true,
        data: user,
        message: 'تم تحديث المستخدم بنجاح'
      });
    } catch (error) {
      next(error);
    }
  }

  // حذف مستخدم
  static async deleteUser(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      
      await UserService.deleteUser(id);
      
      res.json({
        success: true,
        data: null,
        message: 'تم حذف المستخدم بنجاح'
      });
    } catch (error) {
      next(error);
    }
  }
}
```

### 3. هيكل Service

```typescript
// user.service.ts
import { User } from '../models/User.model';
import { CreateUserDto, UpdateUserDto, UserFilters } from '../types/user.types';
import { hashPassword } from '../utils/password.utils';
import { AppError } from '../utils/AppError';

export class UserService {
  // إنشاء مستخدم جديد
  static async createUser(userData: CreateUserDto): Promise<User> {
    // التحقق من وجود المستخدم
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new AppError('البريد الإلكتروني مستخدم بالفعل', 400);
    }

    // تشفير كلمة المرور
    const hashedPassword = await hashPassword(userData.password);

    // إنشاء المستخدم
    const user = new User({
      ...userData,
      password: hashedPassword
    });

    await user.save();
    
    // إزالة كلمة المرور من النتيجة
    const userObject = user.toObject();
    delete userObject.password;
    
    return userObject;
  }

  // الحصول على المستخدمين مع الفلترة والبحث
  static async getUsers(filters: UserFilters) {
    const { page, limit, search, role } = filters;
    
    // بناء استعلام البحث
    const query: any = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      query.role = role;
    }

    // حساب التصفح
    const skip = (page - 1) * limit;
    
    // تنفيذ الاستعلام
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // تحديث مستخدم
  static async updateUser(id: string, updateData: UpdateUserDto): Promise<User> {
    // التحقق من وجود المستخدم
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('المستخدم غير موجود', 404);
    }

    // تشفير كلمة المرور إذا تم تحديثها
    if (updateData.password) {
      updateData.password = await hashPassword(updateData.password);
    }

    // تحديث المستخدم
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      throw new AppError('فشل في تحديث المستخدم', 500);
    }

    return updatedUser;
  }

  // حذف مستخدم
  static async deleteUser(id: string): Promise<void> {
    const user = await User.findById(id);
    if (!user) {
      throw new AppError('المستخدم غير موجود', 404);
    }

    await User.findByIdAndDelete(id);
  }
}
```

### 4. هيكل Model

```typescript
// User.model.ts
import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../types/user.types';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true,
    maxlength: [100, 'الاسم لا يمكن أن يزيد عن 100 حرف']
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'البريد الإلكتروني غير صحيح']
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل']
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: [true, 'الدور مطلوب']
  },
  phone: {
    type: String,
    match: [/^[0-9+\-\s()]+$/, 'رقم الهاتف غير صحيح']
  },
  avatar: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// إنشاء فهارس
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ name: 'text', email: 'text' });

export const User = mongoose.model<IUser>('User', UserSchema);
```

### 5. معالجة الأخطاء

```typescript
// utils/AppError.ts
export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // خطأ MongoDB CastError
  if (err.name === 'CastError') {
    const message = 'المورد غير موجود';
    error = new AppError(message, 404);
  }

  // خطأ MongoDB Duplicate Key
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const message = 'البيانات مكررة';
    error = new AppError(message, 400);
  }

  // خطأ MongoDB Validation
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message);
    error = new AppError(message.join(', '), 400);
  }

  res.status((error as AppError).statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'خطأ في الخادم'
    }
  });
};
```

---

## إرشادات Frontend

### 1. هيكل Component

```typescript
// components/UserProfile.tsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Avatar,
  Button,
  TextField,
  Grid,
  Alert
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { useUpdateUser } from '../hooks/useUsers';
import { User } from '../types/user.types';

interface UserProfileProps {
  user: User;
  onUpdate?: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdate }) => {
  const { user: currentUser } = useAuth();
  const updateUserMutation = useUpdateUser();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // التحقق من الصلاحيات
  const canEdit = currentUser?.id === user.id || currentUser?.role === 'admin';

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // إزالة الخطأ عند التعديل
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'الاسم مطلوب';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'البريد الإلكتروني مطلوب';
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      newErrors.email = 'البريد الإلكتروني غير صحيح';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const updatedUser = await updateUserMutation.mutateAsync({
        id: user.id,
        data: formData
      });
      
      setIsEditing(false);
      onUpdate?.(updatedUser);
    } catch (error) {
      console.error('خطأ في تحديث المستخدم:', error);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || ''
    });
    setErrors({});
    setIsEditing(false);
  };

  return (
    <Card>
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Avatar
              src={user.avatar}
              sx={{ width: 120, height: 120, mx: 'auto' }}
            >
              {user.name.charAt(0)}
            </Avatar>
          </Grid>
          
          <Grid item xs={12} md={8}>
            {updateUserMutation.isError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                حدث خطأ في تحديث البيانات
              </Alert>
            )}
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="الاسم"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={!isEditing}
                  error={!!errors.name}
                  helperText={errors.name}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="البريد الإلكتروني"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={!isEditing}
                  error={!!errors.email}
                  helperText={errors.email}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="رقم الهاتف"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={!isEditing}
                />
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  الدور: {user.role}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  تاريخ الإنشاء: {new Date(user.createdAt).toLocaleDateString('ar')}
                </Typography>
              </Grid>
              
              {canEdit && (
                <Grid item xs={12}>
                  {isEditing ? (
                    <>
                      <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={updateUserMutation.isLoading}
                        sx={{ mr: 1 }}
                      >
                        حفظ
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleCancel}
                        disabled={updateUserMutation.isLoading}
                      >
                        إلغاء
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="contained"
                      onClick={() => setIsEditing(true)}
                    >
                      تعديل
                    </Button>
                  )}
                </Grid>
              )}
            </Grid>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
```

### 2. Custom Hooks

```typescript
// hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { userService } from '../services/user.service';
import { User, CreateUserDto, UpdateUserDto, UserFilters } from '../types/user.types';

// Hook للحصول على المستخدمين
export const useUsers = (filters: UserFilters) => {
  return useQuery(
    ['users', filters],
    () => userService.getUsers(filters),
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 دقائق
    }
  );
};

// Hook للحصول على مستخدم واحد
export const useUser = (id: string) => {
  return useQuery(
    ['user', id],
    () => userService.getUser(id),
    {
      enabled: !!id,
    }
  );
};

// Hook لإنشاء مستخدم
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    (userData: CreateUserDto) => userService.createUser(userData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
      },
    }
  );
};

// Hook لتحديث مستخدم
export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, data }: { id: string; data: UpdateUserDto }) => 
      userService.updateUser(id, data),
    {
      onSuccess: (updatedUser) => {
        queryClient.invalidateQueries('users');
        queryClient.setQueryData(['user', updatedUser.id], updatedUser);
      },
    }
  );
};

// Hook لحذف مستخدم
export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    (id: string) => userService.deleteUser(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
      },
    }
  );
};
```

### 3. خدمات API

```typescript
// services/user.service.ts
import { apiClient } from './api.client';
import { User, CreateUserDto, UpdateUserDto, UserFilters } from '../types/user.types';
import { ApiResponse, PaginatedResponse } from '../types/api.types';

export const userService = {
  // الحصول على المستخدمين
  async getUsers(filters: UserFilters): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.role) params.append('role', filters.role);
    
    const response = await apiClient.get<ApiResponse<User[]>>(`/users?${params}`);
    return response.data;
  },

  // الحصول على مستخدم واحد
  async getUser(id: string): Promise<User> {
    const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data;
  },

  // إنشاء مستخدم
  async createUser(userData: CreateUserDto): Promise<User> {
    const response = await apiClient.post<ApiResponse<User>>('/users', userData);
    return response.data.data;
  },

  // تحديث مستخدم
  async updateUser(id: string, userData: UpdateUserDto): Promise<User> {
    const response = await apiClient.put<ApiResponse<User>>(`/users/${id}`, userData);
    return response.data.data;
  },

  // حذف مستخدم
  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  }
};
```

---

## إدارة الحالة

### 1. Zustand Store

```typescript
// store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types/user.types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ 
        user, 
        isAuthenticated: true 
      }),

      setToken: (token) => set({ token }),

      logout: () => set({ 
        user: null, 
        token: null, 
        isAuthenticated: false 
      }),

      setLoading: (isLoading) => set({ isLoading })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);
```

### 2. React Query Configuration

```typescript
// config/queryClient.ts
import { QueryClient } from 'react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 دقائق
      cacheTime: 10 * 60 * 1000, // 10 دقائق
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

---

## الاختبارات

### 1. اختبارات Backend

```typescript
// tests/unit/user.service.test.ts
import { UserService } from '../../src/services/user.service';
import { User } from '../../src/models/User.model';
import { AppError } from '../../src/utils/AppError';

// Mock MongoDB
jest.mock('../../src/models/User.model');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        name: 'أحمد محمد',
        email: 'ahmed@example.com',
        password: 'password123',
        role: 'doctor'
      };

      const mockUser = {
        ...userData,
        _id: 'user123',
        toObject: () => ({ ...userData, _id: 'user123' })
      };

      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User.prototype.save as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.createUser(userData);

      expect(User.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(result).toEqual(expect.objectContaining({
        name: userData.name,
        email: userData.email
      }));
      expect(result.password).toBeUndefined();
    });

    it('should throw error if email already exists', async () => {
      const userData = {
        name: 'أحمد محمد',
        email: 'ahmed@example.com',
        password: 'password123',
        role: 'doctor'
      };

      (User.findOne as jest.Mock).mockResolvedValue({ email: userData.email });

      await expect(UserService.createUser(userData))
        .rejects
        .toThrow(new AppError('البريد الإلكتروني مستخدم بالفعل', 400));
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const filters = { page: 1, limit: 10 };
      const mockUsers = [
        { name: 'أحمد', email: 'ahmed@example.com' },
        { name: 'فاطمة', email: 'fatima@example.com' }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers)
      };

      (User.find as jest.Mock).mockReturnValue(mockQuery);
      (User.countDocuments as jest.Mock).mockResolvedValue(2);

      const result = await UserService.getUsers(filters);

      expect(result.users).toEqual(mockUsers);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        pages: 1
      });
    });
  });
});
```

### 2. اختبارات Frontend

```typescript
// tests/components/UserProfile.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { UserProfile } from '../../src/components/UserProfile';
import { useAuth } from '../../src/hooks/useAuth';
import { useUpdateUser } from '../../src/hooks/useUsers';

// Mock hooks
jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/hooks/useUsers');

const mockUser = {
  id: 'user123',
  name: 'أحمد محمد',
  email: 'ahmed@example.com',
  role: 'doctor',
  phone: '123456789',
  createdAt: new Date().toISOString()
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('UserProfile', () => {
  const mockUpdateUser = {
    mutateAsync: jest.fn(),
    isLoading: false,
    isError: false
  };

  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user123', role: 'admin' }
    });
    (useUpdateUser as jest.Mock).mockReturnValue(mockUpdateUser);
  });

  it('should render user information', () => {
    renderWithQueryClient(<UserProfile user={mockUser} />);

    expect(screen.getByDisplayValue('أحمد محمد')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ahmed@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123456789')).toBeInTheDocument();
  });

  it('should enable editing when edit button is clicked', () => {
    renderWithQueryClient(<UserProfile user={mockUser} />);

    const editButton = screen.getByText('تعديل');
    fireEvent.click(editButton);

    expect(screen.getByText('حفظ')).toBeInTheDocument();
    expect(screen.getByText('إلغاء')).toBeInTheDocument();
  });

  it('should update user when save button is clicked', async () => {
    mockUpdateUser.mutateAsync.mockResolvedValue({
      ...mockUser,
      name: 'أحمد علي'
    });

    renderWithQueryClient(<UserProfile user={mockUser} />);

    // تفعيل وضع التعديل
    fireEvent.click(screen.getByText('تعديل'));

    // تغيير الاسم
    const nameInput = screen.getByDisplayValue('أحمد محمد');
    fireEvent.change(nameInput, { target: { value: 'أحمد علي' } });

    // حفظ التغييرات
    fireEvent.click(screen.getByText('حفظ'));

    await waitFor(() => {
      expect(mockUpdateUser.mutateAsync).toHaveBeenCalledWith({
        id: 'user123',
        data: {
          name: 'أحمد علي',
          email: 'ahmed@example.com',
          phone: '123456789'
        }
      });
    });
  });

  it('should show validation errors for invalid input', async () => {
    renderWithQueryClient(<UserProfile user={mockUser} />);

    // تفعيل وضع التعديل
    fireEvent.click(screen.getByText('تعديل'));

    // مسح الاسم
    const nameInput = screen.getByDisplayValue('أحمد محمد');
    fireEvent.change(nameInput, { target: { value: '' } });

    // محاولة الحفظ
    fireEvent.click(screen.getByText('حفظ'));

    await waitFor(() => {
      expect(screen.getByText('الاسم مطلوب')).toBeInTheDocument();
    });

    expect(mockUpdateUser.mutateAsync).not.toHaveBeenCalled();
  });
});
```

---

## النشر والإنتاج

### 1. Docker Configuration

```dockerfile
# Dockerfile.backend
FROM node:18-alpine

WORKDIR /app

# تثبيت التبعيات
COPY package*.json ./
RUN npm ci --only=production

# نسخ الكود
COPY . .

# بناء التطبيق
RUN npm run build

# إنشاء مستخدم غير root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

USER nodejs

EXPOSE 5000

CMD ["npm", "start"]
```

```dockerfile
# Dockerfile.frontend
FROM node:18-alpine as builder

WORKDIR /app

# تثبيت التبعيات
COPY package*.json ./
RUN npm ci

# نسخ الكود وبناء التطبيق
COPY . .
RUN npm run build

# مرحلة الإنتاج
FROM nginx:alpine

# نسخ ملفات البناء
COPY --from=builder /app/build /usr/share/nginx/html

# نسخ إعدادات nginx
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 2. Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    restart: always
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
    volumes:
      - mongodb_data:/data/db
    networks:
      - hospital_network

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - hospital_network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    environment:
      NODE_ENV: production
      MONGODB_URI: mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@mongodb:27017/hospital_erp?authSource=admin
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      - mongodb
      - redis
    volumes:
      - ./uploads:/app/uploads
    networks:
      - hospital_network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    volumes:
      - ./ssl:/etc/nginx/ssl
    networks:
      - hospital_network

volumes:
  mongodb_data:
  redis_data:

networks:
  hospital_network:
    driver: bridge
```

### 3. CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install Backend Dependencies
      run: |
        cd backend
        npm ci
    
    - name: Run Backend Tests
      run: |
        cd backend
        npm test
    
    - name: Install Frontend Dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Run Frontend Tests
      run: |
        cd frontend
        npm test -- --coverage --watchAll=false
    
    - name: Build Frontend
      run: |
        cd frontend
        npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /opt/hospital-erp
          git pull origin main
          docker-compose -f docker-compose.prod.yml down
          docker-compose -f docker-compose.prod.yml build
          docker-compose -f docker-compose.prod.yml up -d
          
          # تنظيف الصور القديمة
          docker image prune -f
```

---

## الخلاصة والنقاط المهمة

### أفضل الممارسات

1. **الأمان**: استخدام HTTPS، تشفير البيانات، التحقق من المدخلات
2. **الأداء**: تحسين الاستعلامات، استخدام التخزين المؤقت، ضغط الملفات
3. **الصيانة**: كود نظيف، توثيق شامل، اختبارات شاملة
4. **المراقبة**: تسجيل الأحداث، مراقبة الأداء، تنبيهات الأخطاء

### أدوات التطوير المفيدة

- **VS Code Extensions**: TypeScript, ESLint, Prettier, MongoDB
- **Database Tools**: MongoDB Compass, Redis Commander
- **API Testing**: Postman, Insomnia
- **Monitoring**: PM2, New Relic, Sentry

### الموارد المفيدة

- [Node.js Documentation](https://nodejs.org/docs/)
- [React Documentation](https://reactjs.org/docs/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

*هذا الدليل يوفر إطار عمل شامل للمطورين للعمل بكفاءة على نظام إدارة المستشفيات.*