import Redis from 'ioredis';
import { logger } from '@/utils/logger';

let redis: Redis;

/**
 * Initialize Redis connection
 */
export const connectRedis = async (): Promise<Redis> => {
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    // Event listeners
    redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    // Test the connection
    await redis.ping();
    
    return redis;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

/**
 * Get Redis instance
 */
export const getRedis = (): Redis => {
  if (!redis) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redis;
};

/**
 * Set a key-value pair with optional TTL
 */
export const set = async (
  key: string,
  value: any,
  ttl?: number
): Promise<void> => {
  try {
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttl) {
      await redis.setex(key, ttl, serializedValue);
    } else {
      await redis.set(key, serializedValue);
    }
    
    logger.debug(`Redis SET: ${key}`, { ttl });
  } catch (error) {
    logger.error(`Redis SET failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Get a value by key
 */
export const get = async <T = any>(key: string): Promise<T | null> => {
  try {
    const value = await redis.get(key);
    
    if (value === null) {
      return null;
    }
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  } catch (error) {
    logger.error(`Redis GET failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Delete a key
 */
export const del = async (key: string): Promise<number> => {
  try {
    const result = await redis.del(key);
    logger.debug(`Redis DEL: ${key}`, { deleted: result });
    return result;
  } catch (error) {
    logger.error(`Redis DEL failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Check if a key exists
 */
export const exists = async (key: string): Promise<boolean> => {
  try {
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.error(`Redis EXISTS failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Set expiration time for a key
 */
export const expire = async (key: string, ttl: number): Promise<boolean> => {
  try {
    const result = await redis.expire(key, ttl);
    return result === 1;
  } catch (error) {
    logger.error(`Redis EXPIRE failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Get TTL for a key
 */
export const ttl = async (key: string): Promise<number> => {
  try {
    return await redis.ttl(key);
  } catch (error) {
    logger.error(`Redis TTL failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Increment a counter
 */
export const incr = async (key: string): Promise<number> => {
  try {
    return await redis.incr(key);
  } catch (error) {
    logger.error(`Redis INCR failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Increment a counter by a specific amount
 */
export const incrBy = async (key: string, increment: number): Promise<number> => {
  try {
    return await redis.incrby(key, increment);
  } catch (error) {
    logger.error(`Redis INCRBY failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Decrement a counter
 */
export const decr = async (key: string): Promise<number> => {
  try {
    return await redis.decr(key);
  } catch (error) {
    logger.error(`Redis DECR failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Get multiple keys
 */
export const mget = async <T = any>(keys: string[]): Promise<(T | null)[]> => {
  try {
    const values = await redis.mget(...keys);
    return values.map(value => {
      if (value === null) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    });
  } catch (error) {
    logger.error('Redis MGET failed', { keys, error });
    throw error;
  }
};

/**
 * Set multiple key-value pairs
 */
export const mset = async (keyValuePairs: Record<string, any>): Promise<void> => {
  try {
    const serializedPairs: string[] = [];
    
    for (const [key, value] of Object.entries(keyValuePairs)) {
      serializedPairs.push(key);
      serializedPairs.push(typeof value === 'string' ? value : JSON.stringify(value));
    }
    
    await redis.mset(...serializedPairs);
    logger.debug('Redis MSET completed', { keys: Object.keys(keyValuePairs) });
  } catch (error) {
    logger.error('Redis MSET failed', error);
    throw error;
  }
};

/**
 * Get keys matching a pattern
 */
export const keys = async (pattern: string): Promise<string[]> => {
  try {
    return await redis.keys(pattern);
  } catch (error) {
    logger.error(`Redis KEYS failed for pattern: ${pattern}`, error);
    throw error;
  }
};

/**
 * Delete keys matching a pattern
 */
export const deletePattern = async (pattern: string): Promise<number> => {
  try {
    const matchingKeys = await redis.keys(pattern);
    
    if (matchingKeys.length === 0) {
      return 0;
    }
    
    const result = await redis.del(...matchingKeys);
    logger.debug(`Redis deleted ${result} keys matching pattern: ${pattern}`);
    return result;
  } catch (error) {
    logger.error(`Redis delete pattern failed for: ${pattern}`, error);
    throw error;
  }
};

/**
 * Hash operations
 */
export const hset = async (
  key: string,
  field: string,
  value: any
): Promise<number> => {
  try {
    const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
    return await redis.hset(key, field, serializedValue);
  } catch (error) {
    logger.error(`Redis HSET failed for key: ${key}, field: ${field}`, error);
    throw error;
  }
};

export const hget = async <T = any>(
  key: string,
  field: string
): Promise<T | null> => {
  try {
    const value = await redis.hget(key, field);
    
    if (value === null) {
      return null;
    }
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  } catch (error) {
    logger.error(`Redis HGET failed for key: ${key}, field: ${field}`, error);
    throw error;
  }
};

export const hgetall = async <T = any>(key: string): Promise<Record<string, T>> => {
  try {
    const hash = await redis.hgetall(key);
    const result: Record<string, T> = {};
    
    for (const [field, value] of Object.entries(hash)) {
      try {
        result[field] = JSON.parse(value) as T;
      } catch {
        result[field] = value as T;
      }
    }
    
    return result;
  } catch (error) {
    logger.error(`Redis HGETALL failed for key: ${key}`, error);
    throw error;
  }
};

export const hdel = async (key: string, ...fields: string[]): Promise<number> => {
  try {
    return await redis.hdel(key, ...fields);
  } catch (error) {
    logger.error(`Redis HDEL failed for key: ${key}, fields: ${fields}`, error);
    throw error;
  }
};

/**
 * List operations
 */
export const lpush = async (key: string, ...values: any[]): Promise<number> => {
  try {
    const serializedValues = values.map(value =>
      typeof value === 'string' ? value : JSON.stringify(value)
    );
    return await redis.lpush(key, ...serializedValues);
  } catch (error) {
    logger.error(`Redis LPUSH failed for key: ${key}`, error);
    throw error;
  }
};

export const rpush = async (key: string, ...values: any[]): Promise<number> => {
  try {
    const serializedValues = values.map(value =>
      typeof value === 'string' ? value : JSON.stringify(value)
    );
    return await redis.rpush(key, ...serializedValues);
  } catch (error) {
    logger.error(`Redis RPUSH failed for key: ${key}`, error);
    throw error;
  }
};

export const lpop = async <T = any>(key: string): Promise<T | null> => {
  try {
    const value = await redis.lpop(key);
    
    if (value === null) {
      return null;
    }
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  } catch (error) {
    logger.error(`Redis LPOP failed for key: ${key}`, error);
    throw error;
  }
};

export const lrange = async <T = any>(
  key: string,
  start: number,
  stop: number
): Promise<T[]> => {
  try {
    const values = await redis.lrange(key, start, stop);
    return values.map(value => {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    });
  } catch (error) {
    logger.error(`Redis LRANGE failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Set operations
 */
export const sadd = async (key: string, ...members: any[]): Promise<number> => {
  try {
    const serializedMembers = members.map(member =>
      typeof member === 'string' ? member : JSON.stringify(member)
    );
    return await redis.sadd(key, ...serializedMembers);
  } catch (error) {
    logger.error(`Redis SADD failed for key: ${key}`, error);
    throw error;
  }
};

export const smembers = async <T = any>(key: string): Promise<T[]> => {
  try {
    const members = await redis.smembers(key);
    return members.map(member => {
      try {
        return JSON.parse(member) as T;
      } catch {
        return member as T;
      }
    });
  } catch (error) {
    logger.error(`Redis SMEMBERS failed for key: ${key}`, error);
    throw error;
  }
};

export const sismember = async (key: string, member: any): Promise<boolean> => {
  try {
    const serializedMember = typeof member === 'string' ? member : JSON.stringify(member);
    const result = await redis.sismember(key, serializedMember);
    return result === 1;
  } catch (error) {
    logger.error(`Redis SISMEMBER failed for key: ${key}`, error);
    throw error;
  }
};

/**
 * Pub/Sub operations
 */
export const publish = async (channel: string, message: any): Promise<number> => {
  try {
    const serializedMessage = typeof message === 'string' ? message : JSON.stringify(message);
    return await redis.publish(channel, serializedMessage);
  } catch (error) {
    logger.error(`Redis PUBLISH failed for channel: ${channel}`, error);
    throw error;
  }
};

/**
 * Flush all data
 */
export const flushall = async (): Promise<void> => {
  try {
    await redis.flushall();
    logger.warn('Redis FLUSHALL executed - all data cleared');
  } catch (error) {
    logger.error('Redis FLUSHALL failed', error);
    throw error;
  }
};

/**
 * Get Redis info
 */
export const info = async (section?: string): Promise<string> => {
  try {
    return await redis.info(section);
  } catch (error) {
    logger.error('Redis INFO failed', error);
    throw error;
  }
};

/**
 * Health check for Redis
 */
export const healthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> => {
  try {
    const start = Date.now();
    await redis.ping();
    const responseTime = Date.now() - start;
    
    const infoData = await redis.info('memory');
    const memoryInfo = infoData
      .split('\r\n')
      .filter(line => line.includes('used_memory_human'))
      .map(line => line.split(':'))
      .reduce((acc, [key, value]) => {
        if (key && value) acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
    
    return {
      status: 'healthy',
      details: {
        responseTime: `${responseTime}ms`,
        memory: memoryInfo,
        connected: redis.status === 'ready',
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        connected: false,
      },
    };
  }
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redis) {
    await redis.quit();
    logger.info('Redis connection closed');
  }
};