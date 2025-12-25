import { UserService } from '../../../src/services/UserService';
import { UserModel } from '../../../src/models/User';
import { AppError } from '../../../src/utils/AppError';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock the User model and dependencies
jest.mock('../../../src/models/User');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockUser = UserModel as jest.Mocked<typeof UserModel>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const userData = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@hospital.com',
      password: 'SecurePassword123!',
      role: 'doctor' as const,
      phone: '+1234567890',
      department: 'Cardiology',
      license_number: 'DOC123456'
    };

    it('should create a user successfully', async () => {
      const hashedPassword = 'hashedPassword123';
      const mockUserResult = {
        id: 'user123',
        ...userData,
        password: hashedPassword,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockUser.findByEmail = jest.fn().mockResolvedValue(null);
      mockBcrypt.hash = jest.fn().mockResolvedValue(hashedPassword);
      mockUser.create = jest.fn().mockResolvedValue(mockUserResult);

      const result = await userService.createUser(userData);

      expect(mockUser.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
      expect(mockUser.create).toHaveBeenCalledWith({
        ...userData,
        password: hashedPassword
      });
      expect(result).toEqual(mockUserResult);
    });

    it('should throw error if user with email already exists', async () => {
      const existingUser = { id: 'existing123', email: userData.email };
      mockUser.findByEmail = jest.fn().mockResolvedValue(existingUser);

      await expect(userService.createUser(userData)).rejects.toThrow(
        new AppError('User with this email already exists', 400)
      );

      expect(mockUser.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockUser.create).not.toHaveBeenCalled();
    });

    it('should handle password hashing errors', async () => {
      mockUser.findByEmail = jest.fn().mockResolvedValue(null);
      mockBcrypt.hash = jest.fn().mockRejectedValue(new Error('Hashing failed'));

      await expect(userService.createUser(userData)).rejects.toThrow(
        new AppError('Failed to create user', 500)
      );
    });
  });

  describe('authenticateUser', () => {
    const credentials = {
      email: 'john.doe@hospital.com',
      password: 'SecurePassword123!'
    };

    it('should authenticate user successfully', async () => {
      const mockUserResult = {
        id: 'user123',
        email: credentials.email,
        password: 'hashedPassword',
        role: 'doctor',
        status: 'active',
        first_name: 'John',
        last_name: 'Doe'
      };
      const token = 'jwt.token.here';

      mockUser.findByEmail = jest.fn().mockResolvedValue(mockUserResult);
      mockBcrypt.compare = jest.fn().mockResolvedValue(true);
      mockJwt.sign = jest.fn().mockReturnValue(token);

      const result = await userService.authenticateUser(credentials.email, credentials.password);

      expect(mockUser.findByEmail).toHaveBeenCalledWith(credentials.email);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(credentials.password, mockUserResult.password);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { userId: mockUserResult.id, email: mockUserResult.email, role: mockUserResult.role },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );
      expect(result).toEqual({
        user: {
          id: mockUserResult.id,
          email: mockUserResult.email,
          role: mockUserResult.role,
          first_name: mockUserResult.first_name,
          last_name: mockUserResult.last_name
        },
        token
      });
    });

    it('should throw error for invalid email', async () => {
      mockUser.findByEmail = jest.fn().mockResolvedValue(null);

      await expect(userService.authenticateUser(credentials.email, credentials.password)).rejects.toThrow(
        new AppError('Invalid email or password', 401)
      );

      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error for invalid password', async () => {
      const mockUserResult = {
        id: 'user123',
        email: credentials.email,
        password: 'hashedPassword',
        status: 'active'
      };

      mockUser.findByEmail = jest.fn().mockResolvedValue(mockUserResult);
      mockBcrypt.compare = jest.fn().mockResolvedValue(false);

      await expect(userService.authenticateUser(credentials.email, credentials.password)).rejects.toThrow(
        new AppError('Invalid email or password', 401)
      );

      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it('should throw error for inactive user', async () => {
      const mockUserResult = {
        id: 'user123',
        email: credentials.email,
        password: 'hashedPassword',
        status: 'inactive'
      };

      mockUser.findByEmail = jest.fn().mockResolvedValue(mockUserResult);
      mockBcrypt.compare = jest.fn().mockResolvedValue(true);

      await expect(userService.authenticateUser(credentials.email, credentials.password)).rejects.toThrow(
        new AppError('User account is inactive', 401)
      );

      expect(mockJwt.sign).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUserResult = {
        id: 'user123',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@hospital.com',
        role: 'doctor'
      };

      mockUser.findById = jest.fn().mockResolvedValue(mockUserResult);

      const result = await userService.getUserById('user123');

      expect(mockUser.findById).toHaveBeenCalledWith('user123');
      expect(result).toEqual(mockUserResult);
    });

    it('should return null when user not found', async () => {
      mockUser.findById = jest.fn().mockResolvedValue(null);

      const result = await userService.getUserById('nonexistent');

      expect(mockUser.findById).toHaveBeenCalledWith('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    const updateData = {
      first_name: 'Jane',
      phone: '+9876543210',
      department: 'Neurology'
    };

    it('should update user successfully', async () => {
      const existingUser = {
        id: 'user123',
        email: 'john.doe@hospital.com',
        first_name: 'John'
      };
      const updatedUser = { ...existingUser, ...updateData };

      mockUser.findById = jest.fn().mockResolvedValue(existingUser);
      mockUser.update = jest.fn().mockResolvedValue(updatedUser);

      const result = await userService.updateUser('user123', updateData);

      expect(mockUser.findById).toHaveBeenCalledWith('user123');
      expect(mockUser.update).toHaveBeenCalledWith('user123', updateData);
      expect(result).toEqual(updatedUser);
    });

    it('should throw error if user not found', async () => {
      mockUser.findById = jest.fn().mockResolvedValue(null);

      await expect(userService.updateUser('nonexistent', updateData)).rejects.toThrow(
        new AppError('User not found', 404)
      );

      expect(mockUser.update).not.toHaveBeenCalled();
    });

    it('should hash password when updating password', async () => {
      const existingUser = { id: 'user123', email: 'john.doe@hospital.com' };
      const updateWithPassword = { password: 'NewPassword123!' };
      const hashedPassword = 'newHashedPassword';
      const updatedUser = { ...existingUser, password: hashedPassword };

      mockUser.findById = jest.fn().mockResolvedValue(existingUser);
      mockBcrypt.hash = jest.fn().mockResolvedValue(hashedPassword);
      mockUser.update = jest.fn().mockResolvedValue(updatedUser);

      const result = await userService.updateUser('user123', updateWithPassword);

      expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
      expect(mockUser.update).toHaveBeenCalledWith('user123', { password: hashedPassword });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user successfully', async () => {
      const existingUser = { id: 'user123', first_name: 'John' };

      mockUser.findById = jest.fn().mockResolvedValue(existingUser);
      mockUser.delete = jest.fn().mockResolvedValue(true);

      const result = await userService.deleteUser('user123');

      expect(mockUser.findById).toHaveBeenCalledWith('user123');
      expect(mockUser.delete).toHaveBeenCalledWith('user123');
      expect(result).toBe(true);
    });

    it('should throw error if user not found', async () => {
      mockUser.findById = jest.fn().mockResolvedValue(null);

      await expect(userService.deleteUser('nonexistent')).rejects.toThrow(
        new AppError('User not found', 404)
      );

      expect(mockUser.delete).not.toHaveBeenCalled();
    });
  });

  describe('getUsersByRole', () => {
    it('should return users by role', async () => {
      const mockUsers = [
        { id: 'user1', first_name: 'John', role: 'doctor' },
        { id: 'user2', first_name: 'Jane', role: 'doctor' }
      ];

      mockUser.findByRole = jest.fn().mockResolvedValue(mockUsers);

      const result = await userService.getUsersByRole('doctor');

      expect(mockUser.findByRole).toHaveBeenCalledWith('doctor');
      expect(result).toEqual(mockUsers);
    });

    it('should return empty array when no users found', async () => {
      mockUser.findByRole = jest.fn().mockResolvedValue([]);

      const result = await userService.getUsersByRole('admin');

      expect(mockUser.findByRole).toHaveBeenCalledWith('admin');
      expect(result).toEqual([]);
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: 'user123', email: 'john.doe@hospital.com', role: 'doctor' };
      const mockUserResult = {
        id: 'user123',
        email: 'john.doe@hospital.com',
        role: 'doctor',
        status: 'active'
      };

      mockJwt.verify = jest.fn().mockReturnValue(decoded);
      mockUser.findById = jest.fn().mockResolvedValue(mockUserResult);

      const result = await userService.validateToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET || 'fallback-secret');
      expect(mockUser.findById).toHaveBeenCalledWith(decoded.userId);
      expect(result).toEqual(mockUserResult);
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid.jwt.token';

      mockJwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(userService.validateToken(token)).rejects.toThrow(
        new AppError('Invalid token', 401)
      );

      expect(mockUser.findById).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: 'user123', email: 'john.doe@hospital.com', role: 'doctor' };

      mockJwt.verify = jest.fn().mockReturnValue(decoded);
      mockUser.findById = jest.fn().mockResolvedValue(null);

      await expect(userService.validateToken(token)).rejects.toThrow(
        new AppError('User not found', 404)
      );
    });

    it('should throw error for inactive user', async () => {
      const token = 'valid.jwt.token';
      const decoded = { userId: 'user123', email: 'john.doe@hospital.com', role: 'doctor' };
      const mockUserResult = {
        id: 'user123',
        email: 'john.doe@hospital.com',
        role: 'doctor',
        status: 'inactive'
      };

      mockJwt.verify = jest.fn().mockReturnValue(decoded);
      mockUser.findById = jest.fn().mockResolvedValue(mockUserResult);

      await expect(userService.validateToken(token)).rejects.toThrow(
        new AppError('User account is inactive', 401)
      );
    });
  });
});