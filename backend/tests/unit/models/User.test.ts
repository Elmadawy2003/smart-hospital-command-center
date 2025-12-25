import { User, UserModel } from '../../../src/models/User';
import { testHelper } from '../../setup';

describe('User Model', () => {
  beforeEach(async () => {
    await testHelper.clearDatabase();
  });

  describe('User Interface', () => {
    it('should define correct user interface structure', () => {
      const userData: User = {
        id: 'user123',
        employee_id: 'EMP-001',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'hashedpassword',
        role: 'doctor',
        department: 'cardiology',
        phone: '+1234567890',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      expect(userData).toBeDefined();
      expect(userData.first_name).toBe('John');
      expect(userData.last_name).toBe('Doe');
      expect(userData.email).toBe('john.doe@hospital.com');
      expect(userData.role).toBe('doctor');
      expect(userData.status).toBe('active');
    });
  });

  describe('UserModel.create', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      const user = await UserModel.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.employee_id).toBeDefined();
      expect(user.first_name).toBe(userData.first_name);
      expect(user.last_name).toBe(userData.last_name);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.department).toBe(userData.department);
      expect(user.status).toBe('active');
      expect(user.created_at).toBeDefined();
      expect(user.updated_at).toBeDefined();
      expect(user.password).not.toBe(userData.password); // Should be hashed
    });

    it('should generate unique employee ID for each user', async () => {
      const userData1 = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      const userData2 = {
        ...userData1,
        email: 'jane.doe@hospital.com',
        first_name: 'Jane'
      };

      const user1 = await UserModel.create(userData1);
      const user2 = await UserModel.create(userData2);

      expect(user1.employee_id).toBeDefined();
      expect(user2.employee_id).toBeDefined();
      expect(user1.employee_id).not.toBe(user2.employee_id);
    });

    it('should hash password before saving', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      const user = await UserModel.create(userData);

      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      await UserModel.create(userData);

      await expect(UserModel.create(userData)).rejects.toThrow();
    });
  });

  describe('UserModel.findById', () => {
    it('should find user by id', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      const createdUser = await UserModel.create(userData);
      const foundUser = await UserModel.findById(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.first_name).toBe(userData.first_name);
      expect(foundUser?.email).toBe(userData.email);
    });

    it('should return null for non-existent id', async () => {
      const foundUser = await UserModel.findById('nonexistent-id');
      expect(foundUser).toBeNull();
    });
  });

  describe('UserModel.findByEmail', () => {
    it('should find user by email', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      const createdUser = await UserModel.create(userData);
      const foundUser = await UserModel.findByEmail(userData.email);

      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.email).toBe(userData.email);
    });

    it('should return null for non-existent email', async () => {
      const foundUser = await UserModel.findByEmail('nonexistent@hospital.com');
      expect(foundUser).toBeNull();
    });
  });

  describe('UserModel.findByEmployeeId', () => {
    it('should find user by employee ID', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      const createdUser = await UserModel.create(userData);
      const foundUser = await UserModel.findByEmployeeId(createdUser.employee_id);

      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.employee_id).toBe(createdUser.employee_id);
    });

    it('should return null for non-existent employee ID', async () => {
      const foundUser = await UserModel.findByEmployeeId('EMP-NONEXISTENT');
      expect(foundUser).toBeNull();
    });
  });

  describe('UserModel.authenticate', () => {
    let testUser: User;

    beforeEach(async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      testUser = await UserModel.create(userData);
    });

    it('should authenticate user with correct credentials', async () => {
      const authenticatedUser = await UserModel.authenticate(testUser.email, 'password123');

      expect(authenticatedUser).toBeDefined();
      expect(authenticatedUser?.id).toBe(testUser.id);
      expect(authenticatedUser?.email).toBe(testUser.email);
    });

    it('should return null for incorrect password', async () => {
      const authenticatedUser = await UserModel.authenticate(testUser.email, 'wrongpassword');
      expect(authenticatedUser).toBeNull();
    });

    it('should return null for non-existent email', async () => {
      const authenticatedUser = await UserModel.authenticate('nonexistent@hospital.com', 'password123');
      expect(authenticatedUser).toBeNull();
    });

    it('should return null for inactive user', async () => {
      // Deactivate user
      await UserModel.update(testUser.id, { status: 'inactive' });

      const authenticatedUser = await UserModel.authenticate(testUser.email, 'password123');
      expect(authenticatedUser).toBeNull();
    });
  });

  describe('UserModel.update', () => {
    it('should update user successfully', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      const createdUser = await UserModel.create(userData);
      const updateData = {
        first_name: 'Jane',
        department: 'neurology'
      };

      const updatedUser = await UserModel.update(createdUser.id, updateData);

      expect(updatedUser).toBeDefined();
      expect(updatedUser?.first_name).toBe(updateData.first_name);
      expect(updatedUser?.department).toBe(updateData.department);
      expect(updatedUser?.last_name).toBe(userData.last_name); // unchanged
      expect(updatedUser?.updated_at).toBeDefined();
    });

    it('should hash password when updating', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      const createdUser = await UserModel.create(userData);
      const newPassword = 'newpassword123';

      const updatedUser = await UserModel.update(createdUser.id, { password: newPassword });

      expect(updatedUser?.password).not.toBe(newPassword);
      expect(updatedUser?.password).not.toBe(createdUser.password);
      expect(updatedUser?.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    it('should return null when updating non-existent user', async () => {
      const updateData = { first_name: 'Jane' };
      const updatedUser = await UserModel.update('nonexistent-id', updateData);
      expect(updatedUser).toBeNull();
    });
  });

  describe('UserModel.delete', () => {
    it('should soft delete user', async () => {
      const userData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        password: 'password123',
        role: 'doctor' as const,
        department: 'cardiology',
        phone: '+1234567890'
      };

      const createdUser = await UserModel.create(userData);
      const deleteResult = await UserModel.delete(createdUser.id);

      expect(deleteResult).toBe(true);

      // Verify user is soft deleted
      const foundUser = await UserModel.findById(createdUser.id);
      expect(foundUser?.status).toBe('inactive');
    });

    it('should return false when deleting non-existent user', async () => {
      const deleteResult = await UserModel.delete('nonexistent-id');
      expect(deleteResult).toBe(false);
    });
  });

  describe('UserModel.findByRole', () => {
    beforeEach(async () => {
      const users = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@hospital.com',
          password: 'password123',
          role: 'doctor' as const,
          department: 'cardiology',
          phone: '+1234567890'
        },
        {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@hospital.com',
          password: 'password123',
          role: 'nurse' as const,
          department: 'emergency',
          phone: '+1234567891'
        },
        {
          first_name: 'Bob',
          last_name: 'Johnson',
          email: 'bob.johnson@hospital.com',
          password: 'password123',
          role: 'doctor' as const,
          department: 'neurology',
          phone: '+1234567892'
        }
      ];

      for (const userData of users) {
        await UserModel.create(userData);
      }
    });

    it('should find users by role', async () => {
      const doctors = await UserModel.findByRole('doctor');

      expect(doctors).toHaveLength(2);
      expect(doctors[0].role).toBe('doctor');
      expect(doctors[1].role).toBe('doctor');
    });

    it('should return empty array for non-existent role', async () => {
      const admins = await UserModel.findByRole('admin');
      expect(admins).toHaveLength(0);
    });
  });

  describe('UserModel.findAll', () => {
    beforeEach(async () => {
      const users = [
        {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@hospital.com',
          password: 'password123',
          role: 'doctor' as const,
          department: 'cardiology',
          phone: '+1234567890'
        },
        {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@hospital.com',
          password: 'password123',
          role: 'nurse' as const,
          department: 'emergency',
          phone: '+1234567891'
        }
      ];

      for (const userData of users) {
        await UserModel.create(userData);
      }
    });

    it('should return all active users', async () => {
      const result = await UserModel.findAll({}, 10, 0);

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.users[0].status).toBe('active');
      expect(result.users[1].status).toBe('active');
    });

    it('should support pagination', async () => {
      const result = await UserModel.findAll({}, 1, 0);

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('should support search by name', async () => {
      const result = await UserModel.findAll({ search: 'John' }, 10, 0);

      expect(result.users).toHaveLength(1);
      expect(result.users[0].first_name).toBe('John');
    });

    it('should support filtering by role', async () => {
      const result = await UserModel.findAll({ role: 'nurse' }, 10, 0);

      expect(result.users).toHaveLength(1);
      expect(result.users[0].role).toBe('nurse');
    });

    it('should support filtering by department', async () => {
      const result = await UserModel.findAll({ department: 'cardiology' }, 10, 0);

      expect(result.users).toHaveLength(1);
      expect(result.users[0].department).toBe('cardiology');
    });
  });

  describe('UserModel.validateToken', () => {
    it('should validate correct token format', () => {
      const validToken = 'valid.jwt.token';
      const result = UserModel.validateToken(validToken);
      
      // This is a basic validation - in real implementation, 
      // this would verify JWT signature and expiration
      expect(result).toBeDefined();
    });

    it('should reject invalid token format', () => {
      const invalidToken = 'invalid-token';
      
      expect(() => {
        UserModel.validateToken(invalidToken);
      }).toThrow();
    });
  });
});