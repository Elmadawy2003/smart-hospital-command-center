import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';

export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour in seconds
  private static readonly USER_CACHE_PREFIX = 'user:';
  private static readonly PATIENT_CACHE_PREFIX = 'patient:';
  private static readonly APPOINTMENT_CACHE_PREFIX = 'appointment:';
  private static readonly DASHBOARD_CACHE_PREFIX = 'dashboard:';

  /**
   * Set cache with TTL
   */
  static async set(key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await redis.setex(key, ttl, serializedValue);
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Get cache value
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cache key
   */
  static async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  /**
   * Delete multiple cache keys
   */
  static async delMultiple(keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache delete multiple error:', error);
    }
  }

  /**
   * Delete cache keys by pattern
   */
  static async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache delete by pattern error:', error);
    }
  }

  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set cache with expiration time
   */
  static async setWithExpiry(key: string, value: any, expiryDate: Date): Promise<void> {
    try {
      const ttl = Math.floor((expiryDate.getTime() - Date.now()) / 1000);
      if (ttl > 0) {
        await this.set(key, value, ttl);
      }
    } catch (error) {
      logger.error('Cache set with expiry error:', error);
    }
  }

  /**
   * Increment counter
   */
  static async increment(key: string, ttl: number = this.DEFAULT_TTL): Promise<number> {
    try {
      const value = await redis.incr(key);
      if (value === 1) {
        await redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      logger.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * User cache methods
   */
  static async setUser(userId: string, userData: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    await this.set(`${this.USER_CACHE_PREFIX}${userId}`, userData, ttl);
  }

  static async getUser<T>(userId: string): Promise<T | null> {
    return this.get<T>(`${this.USER_CACHE_PREFIX}${userId}`);
  }

  static async delUser(userId: string): Promise<void> {
    await this.del(`${this.USER_CACHE_PREFIX}${userId}`);
  }

  /**
   * Patient cache methods
   */
  static async setPatient(patientId: string, patientData: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    await this.set(`${this.PATIENT_CACHE_PREFIX}${patientId}`, patientData, ttl);
  }

  static async getPatient<T>(patientId: string): Promise<T | null> {
    return this.get<T>(`${this.PATIENT_CACHE_PREFIX}${patientId}`);
  }

  static async delPatient(patientId: string): Promise<void> {
    await this.del(`${this.PATIENT_CACHE_PREFIX}${patientId}`);
  }

  /**
   * Appointment cache methods
   */
  static async setAppointment(appointmentId: string, appointmentData: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    await this.set(`${this.APPOINTMENT_CACHE_PREFIX}${appointmentId}`, appointmentData, ttl);
  }

  static async getAppointment<T>(appointmentId: string): Promise<T | null> {
    return this.get<T>(`${this.APPOINTMENT_CACHE_PREFIX}${appointmentId}`);
  }

  static async delAppointment(appointmentId: string): Promise<void> {
    await this.del(`${this.APPOINTMENT_CACHE_PREFIX}${appointmentId}`);
  }

  /**
   * Dashboard cache methods
   */
  static async setDashboardData(key: string, data: any, ttl: number = 300): Promise<void> { // 5 minutes for dashboard
    await this.set(`${this.DASHBOARD_CACHE_PREFIX}${key}`, data, ttl);
  }

  static async getDashboardData<T>(key: string): Promise<T | null> {
    return this.get<T>(`${this.DASHBOARD_CACHE_PREFIX}${key}`);
  }

  static async delDashboardData(key: string): Promise<void> {
    await this.del(`${this.DASHBOARD_CACHE_PREFIX}${key}`);
  }

  static async clearDashboardCache(): Promise<void> {
    await this.delByPattern(`${this.DASHBOARD_CACHE_PREFIX}*`);
  }

  /**
   * Session management
   */
  static async setSession(sessionId: string, sessionData: any, ttl: number = 86400): Promise<void> { // 24 hours
    await this.set(`session:${sessionId}`, sessionData, ttl);
  }

  static async getSession<T>(sessionId: string): Promise<T | null> {
    return this.get<T>(`session:${sessionId}`);
  }

  static async delSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  /**
   * Rate limiting
   */
  static async checkRateLimit(identifier: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const key = `rate_limit:${identifier}`;
      const current = await this.increment(key, window);
      const remaining = Math.max(0, limit - current);
      const resetTime = Date.now() + (window * 1000);

      return {
        allowed: current <= limit,
        remaining,
        resetTime,
      };
    } catch (error) {
      logger.error('Rate limit check error:', error);
      return { allowed: true, remaining: limit, resetTime: Date.now() + (window * 1000) };
    }
  }

  /**
   * Cache warming - preload frequently accessed data
   */
  static async warmCache(): Promise<void> {
    try {
      logger.info('Starting cache warming...');
      
      // This could be expanded to preload:
      // - Active users
      // - Today's appointments
      // - Critical patients
      // - Dashboard KPIs
      
      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Cache warming error:', error);
    }
  }

  /**
   * Cache statistics
   */
  static async getCacheStats(): Promise<any> {
    try {
      const info = await redis.info('memory');
      const keyspace = await redis.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return null;
    }
  }

  /**
   * Clear all cache
   */
  static async clearAll(): Promise<void> {
    try {
      await redis.flushdb();
      logger.info('All cache cleared');
    } catch (error) {
      logger.error('Clear all cache error:', error);
    }
  }
}