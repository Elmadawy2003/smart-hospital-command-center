import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '@/utils/logger';

let pool: Pool;

/**
 * Initialize database connection pool
 */
export const connectDatabase = async (): Promise<Pool> => {
  try {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'hospital_erp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connected successfully');
    return pool;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

/**
 * Get database pool instance
 */
export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call connectDatabase() first.');
  }
  return pool;
};

/**
 * Execute a query with parameters
 */
export const query = async <T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Query executed', {
      query: text,
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.error('Query failed', {
      query: text,
      params,
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw error;
  }
};

/**
 * Execute a query and return the first row
 */
export const queryOne = async <T = any>(
  text: string,
  params?: any[]
): Promise<T | null> => {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
};

/**
 * Execute a query and return all rows
 */
export const queryMany = async <T = any>(
  text: string,
  params?: any[]
): Promise<T[]> => {
  const result = await query<T>(text, params);
  return result.rows;
};

/**
 * Execute multiple queries in a transaction
 */
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    
    logger.debug('Transaction completed successfully');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    
    logger.error('Transaction failed, rolled back', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Build WHERE clause from filters
 */
export const buildWhereClause = (
  filters: Record<string, any>,
  startIndex: number = 1
): { whereClause: string; values: any[]; nextIndex: number } => {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = startIndex;

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        // Handle array values (IN clause)
        const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`${key} IN (${placeholders})`);
        values.push(...value);
      } else if (typeof value === 'string' && value.includes('%')) {
        // Handle LIKE queries
        conditions.push(`${key} ILIKE $${paramIndex++}`);
        values.push(value);
      } else if (typeof value === 'object' && value.operator) {
        // Handle custom operators
        conditions.push(`${key} ${value.operator} $${paramIndex++}`);
        values.push(value.value);
      } else {
        // Handle exact matches
        conditions.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return {
    whereClause,
    values,
    nextIndex: paramIndex,
  };
};

/**
 * Build ORDER BY clause
 */
export const buildOrderByClause = (
  sortBy?: string,
  sortOrder?: 'ASC' | 'DESC'
): string => {
  if (!sortBy) return '';
  
  const order = sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return `ORDER BY ${sortBy} ${order}`;
};

/**
 * Build LIMIT and OFFSET clause for pagination
 */
export const buildPaginationClause = (
  page: number = 1,
  limit: number = 10
): { limitClause: string; offset: number } => {
  const offset = (page - 1) * limit;
  const limitClause = `LIMIT ${limit} OFFSET ${offset}`;
  
  return { limitClause, offset };
};

/**
 * Build a complete SELECT query with filters, sorting, and pagination
 */
export const buildSelectQuery = (
  table: string,
  columns: string[] = ['*'],
  filters: Record<string, any> = {},
  sortBy?: string,
  sortOrder?: 'ASC' | 'DESC',
  page?: number,
  limit?: number
): { query: string; values: any[] } => {
  const selectClause = `SELECT ${columns.join(', ')} FROM ${table}`;
  
  const { whereClause, values } = buildWhereClause(filters);
  const orderByClause = buildOrderByClause(sortBy, sortOrder);
  const { limitClause } = page && limit ? buildPaginationClause(page, limit) : { limitClause: '' };
  
  const query = [selectClause, whereClause, orderByClause, limitClause]
    .filter(Boolean)
    .join(' ');
  
  return { query, values };
};

/**
 * Build INSERT query
 */
export const buildInsertQuery = (
  table: string,
  data: Record<string, any>,
  returning: string[] = ['*']
): { query: string; values: any[] } => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  
  const columns = keys.join(', ');
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
  const returningClause = returning.length > 0 ? `RETURNING ${returning.join(', ')}` : '';
  
  const query = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) ${returningClause}`.trim();
  
  return { query, values };
};

/**
 * Build UPDATE query
 */
export const buildUpdateQuery = (
  table: string,
  data: Record<string, any>,
  whereConditions: Record<string, any>,
  returning: string[] = ['*']
): { query: string; values: any[] } => {
  const dataKeys = Object.keys(data);
  const dataValues = Object.values(data);
  
  const setClause = dataKeys
    .map((key, index) => `${key} = $${index + 1}`)
    .join(', ');
  
  const { whereClause, values: whereValues } = buildWhereClause(
    whereConditions,
    dataKeys.length + 1
  );
  
  const returningClause = returning.length > 0 ? `RETURNING ${returning.join(', ')}` : '';
  
  const query = `UPDATE ${table} SET ${setClause} ${whereClause} ${returningClause}`.trim();
  const values = [...dataValues, ...whereValues];
  
  return { query, values };
};

/**
 * Build DELETE query
 */
export const buildDeleteQuery = (
  table: string,
  whereConditions: Record<string, any>,
  returning: string[] = []
): { query: string; values: any[] } => {
  const { whereClause, values } = buildWhereClause(whereConditions);
  
  if (!whereClause) {
    throw new Error('DELETE query requires WHERE conditions for safety');
  }
  
  const returningClause = returning.length > 0 ? `RETURNING ${returning.join(', ')}` : '';
  
  const query = `DELETE FROM ${table} ${whereClause} ${returningClause}`.trim();
  
  return { query, values };
};

/**
 * Check if a record exists
 */
export const exists = async (
  table: string,
  conditions: Record<string, any>
): Promise<boolean> => {
  const { whereClause, values } = buildWhereClause(conditions);
  const query = `SELECT 1 FROM ${table} ${whereClause} LIMIT 1`;
  
  const result = await queryOne(query, values);
  return !!result;
};

/**
 * Count records
 */
export const count = async (
  table: string,
  conditions: Record<string, any> = {}
): Promise<number> => {
  const { whereClause, values } = buildWhereClause(conditions);
  const query = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`;
  
  const result = await queryOne<{ count: string }>(query, values);
  return parseInt(result?.count || '0', 10);
};

/**
 * Get database statistics
 */
export const getDatabaseStats = async () => {
  try {
    const stats = await query(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation
      FROM pg_stats 
      WHERE schemaname = 'public'
      ORDER BY tablename, attname
    `);
    
    const tableStats = await query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    return {
      columnStats: stats.rows,
      tableStats: tableStats.rows,
    };
  } catch (error) {
    logger.error('Failed to get database statistics:', error);
    throw error;
  }
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
};

/**
 * Health check for database
 */
export const healthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> => {
  try {
    const start = Date.now();
    await query('SELECT 1');
    const responseTime = Date.now() - start;
    
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
    
    return {
      status: 'healthy',
      details: {
        responseTime: `${responseTime}ms`,
        pool: poolStats,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
};