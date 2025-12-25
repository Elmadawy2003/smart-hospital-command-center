import request from 'supertest';
import { app } from '../../src/index';
import { UserModel } from '../../src/models/User';
import { connectTestDB, closeTestDB, clearTestDB } from '../setup';

describe('Authentication Integration Tests', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@hospital.com',
      password: 'SecurePassword123!',
      role: 'doctor',
      department: 'cardiology',
      phone: '+1234567890'
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(validUserData.email);
      expect(response.body.data.user.role).toBe(validUserData.role);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).not.toHaveProperty('password');

      // Verify user was created in database
      const user = await UserModel.findByEmail(validUserData.email);
      expect(user).toBeTruthy();
      expect(user?.status).toBe('active');
    });

    it('should not register user with duplicate email', async () => {
      // Create user first
      await UserModel.create(validUserData);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        firstName: 'John',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...validUserData,
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        ...validUserData,
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate role', async () => {
      const invalidRoleData = {
        ...validUserData,
        role: 'invalid-role'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidRoleData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    const userData = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@hospital.com',
      password: 'SecurePassword123!',
      role: 'doctor',
      department: 'cardiology',
      phone: '+1234567890'
    };

    beforeEach(async () => {
      // Create a user for login tests
      await UserModel.create(userData);
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: userData.email,
        password: userData.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).not.toHaveProperty('password');

      // Verify lastLogin was updated
      const user = await UserModel.findByEmail(userData.email);
      expect(user?.last_login).toBeTruthy();
    });

    it('should not login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@hospital.com',
        password: userData.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should not login with invalid password', async () => {
      const loginData = {
        email: userData.email,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should not login inactive user', async () => {
      // Deactivate user
      const user = await UserModel.findByEmail(userData.email);
      if (user) {
        await UserModel.update(user.id, { status: 'inactive' });
      }

      const loginData = {
        email: userData.email,
        password: userData.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Account is deactivated');
    });

    it('should validate required fields for login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create and login user to get token
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'SecurePassword123!',
        role: 'doctor',
        department: 'cardiology',
        phone: '+1234567890'
      };

      const user = await UserModel.create(userData);
      userId = user.id;

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      authToken = loginResponse.body.data.token;
    });

    it('should get current user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(userId);
      expect(response.body.data.user.email).toBe('john.doe@hospital.com');
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });

    it('should not get profile for deactivated user', async () => {
      // Deactivate user
      await UserModel.update(userId, { status: 'inactive' });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('User not found or inactive');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      // Create and login user to get token
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'SecurePassword123!',
        role: 'doctor',
        department: 'cardiology',
        phone: '+1234567890'
      };

      await UserModel.create(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      authToken = loginResponse.body.data.token;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out successfully');
    });

    it('should handle logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/change-password', () => {
    let authToken: string;
    let userId: string;
    const originalPassword = 'SecurePassword123!';

    beforeEach(async () => {
      // Create and login user to get token
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: originalPassword,
        role: 'doctor',
        department: 'cardiology',
        phone: '+1234567890'
      };

      const user = await UserModel.create(userData);
      userId = user.id;

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: originalPassword
        });

      authToken = loginResponse.body.data.token;
    });

    it('should change password successfully', async () => {
      const changePasswordData = {
        currentPassword: originalPassword,
        newPassword: 'NewSecurePassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(changePasswordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed successfully');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@hospital.com',
          password: changePasswordData.newPassword
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should not change password with wrong current password', async () => {
      const changePasswordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'NewSecurePassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(changePasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      const changePasswordData = {
        currentPassword: originalPassword,
        newPassword: '123'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(changePasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication for password change', async () => {
      const changePasswordData = {
        currentPassword: originalPassword,
        newPassword: 'NewSecurePassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .send(changePasswordData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});