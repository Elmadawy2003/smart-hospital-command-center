import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

let mongoServer: MongoMemoryServer;
let redisClient: any;

// Setup before all tests
beforeAll(async () => {
  try {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as any);

    // Setup Redis client for testing
    redisClient = createClient({
      url: process.env.REDIS_TEST_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err: any) => {
      console.log('Redis Client Error (Test)', err);
    });

    await redisClient.connect();

    console.log('Test database setup completed');
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    // Close MongoDB connection
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    // Stop MongoDB Memory Server
    if (mongoServer) {
      await mongoServer.stop();
    }

    // Close Redis connection
    if (redisClient) {
      await redisClient.quit();
    }

    console.log('Test database cleanup completed');
  } catch (error) {
    console.error('Test cleanup failed:', error);
  }
});

// Clean up after each test
afterEach(async () => {
  try {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      if (collection) {
        await collection.deleteMany({});
      }
    }

    // Clear Redis cache
    if (redisClient) {
      await redisClient.flushAll();
    }
  } catch (error) {
    console.error('Test cleanup after each test failed:', error);
  }
});

// Global test utilities
global.testUtils = {
  createTestUser: async (userData: any = {}) => {
    const defaultUser = {
      email: 'test@hospital.com',
      password: 'TestPassword123!',
      first_name: 'Test',
      last_name: 'User',
      role: 'doctor',
      phone: '+1234567890',
      ...userData
    };
    
    // Import User model dynamically to avoid circular dependencies
    const { UserModel } = await import('../src/models/User');
    return await UserModel.create(defaultUser);
  },

  createTestPatient: async (patientData: any = {}) => {
    const defaultPatient = {
      first_name: 'Test',
      last_name: 'Patient',
      date_of_birth: new Date('1990-01-01'),
      gender: 'male',
      phone: '+1234567890',
      email: 'patient@test.com',
      address: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      zip_code: '12345',
      country: 'Test Country',
      emergency_contact_name: 'Emergency Contact',
      emergency_contact_phone: '+1234567891',
      emergency_contact_relationship: 'spouse',
      ...patientData
    };

    const { PatientModel } = await import('../src/models/Patient');
    return await PatientModel.create(defaultPatient);
  },

  generateAuthToken: async (userId: string) => {
    const jwt = await import('jsonwebtoken');
    return jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  },

  mockRequest: (overrides: any = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),

  mockResponse: () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },

  mockNext: () => jest.fn()
};

// Extend Jest matchers
expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      };
    }
  },
});

// Declare global types for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidObjectId(): R;
    }
  }
  
  var testUtils: {
    createTestUser: (userData?: any) => Promise<any>;
    createTestPatient: (patientData?: any) => Promise<any>;
    generateAuthToken: (userId: string) => Promise<string>;
    mockRequest: (overrides?: any) => any;
    mockResponse: () => any;
    mockNext: () => jest.Mock;
  };
}

// Export helper functions for integration tests
export const connectTestDB = async () => {
  // Connection is already established in beforeAll
};

export const closeTestDB = async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    if (redisClient) {
      await redisClient.quit();
    }
  } catch (error) {
    console.error('Error closing test database:', error);
  }
};

export const clearTestDB = async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      if (collection) {
        await collection.deleteMany({});
      }
    }
    
    if (redisClient) {
      await redisClient.flushAll();
    }
  } catch (error) {
    console.error('Error clearing test database:', error);
  }
};

export const createTestUser = global.testUtils?.createTestUser;
export const createTestPatient = global.testUtils?.createTestPatient;
export const generateAuthToken = global.testUtils?.generateAuthToken;