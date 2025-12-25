import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '@/config/database';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { CustomError, validationErrorHandler } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { InventoryItem, APIResponse, PaginatedResponse, InventoryStatus } from '@/types';

export const createInventoryItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const {
    name,
    description,
    category,
    sku,
    quantity,
    unitPrice,
    reorderLevel,
    maxLevel,
    supplier,
    expiryDate,
    batchNumber,
    location,
    notes
  } = req.body;

  try {
    const db = getDatabase();
    const itemId = uuidv4();

    // Check if SKU already exists
    const skuCheck = await db.query(
      'SELECT id FROM inventory_items WHERE sku = $1',
      [sku]
    );
    if (skuCheck.rows.length > 0) {
      throw new CustomError('SKU already exists', 409);
    }

    // Determine status based on quantity and reorder level
    let status = InventoryStatus.IN_STOCK;
    if (quantity === 0) {
      status = InventoryStatus.OUT_OF_STOCK;
    } else if (quantity <= reorderLevel) {
      status = InventoryStatus.LOW_STOCK;
    }

    const insertQuery = `
      INSERT INTO inventory_items (
        id, name, description, category, sku, quantity, unit_price, 
        reorder_level, max_level, supplier, expiry_date, batch_number, 
        location, status, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      itemId,
      name,
      description,
      category,
      sku,
      quantity,
      unitPrice,
      reorderLevel,
      maxLevel,
      supplier,
      expiryDate ? new Date(expiryDate) : null,
      batchNumber,
      location,
      status,
      notes,
      req.user?.id,
      new Date(),
      new Date()
    ];

    const result = await db.query(insertQuery, values);
    const inventoryItem = result.rows[0];

    // Cache the inventory item
    await setCache(`inventory_item:${itemId}`, inventoryItem, 3600);

    // Clear inventory list cache
    await deleteCache('inventory_items_list');

    logger.info('Inventory item created successfully', {
      itemId,
      name,
      sku,
      quantity,
      createdBy: req.user?.id
    });

    const response: APIResponse<InventoryItem> = {
      success: true,
      data: inventoryItem,
      message: 'Inventory item created successfully',
      timestamp: new Date()
    };

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating inventory item:', error);
    throw error;
  }
};

export const getInventoryItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const category = req.query.category as string;
    const status = req.query.status as string;
    const supplier = req.query.supplier as string;
    const search = req.query.search as string;
    const lowStock = req.query.lowStock === 'true';
    const expiringSoon = req.query.expiringSoon === 'true';
    const offset = (page - 1) * limit;

    const db = getDatabase();
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      whereClause += ` AND category = $${paramCount}`;
      queryParams.push(category);
    }

    if (status) {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      queryParams.push(status);
    }

    if (supplier) {
      paramCount++;
      whereClause += ` AND supplier ILIKE $${paramCount}`;
      queryParams.push(`%${supplier}%`);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount} OR sku ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    if (lowStock) {
      whereClause += ` AND quantity <= reorder_level`;
    }

    if (expiringSoon) {
      whereClause += ` AND expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'`;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM inventory_items 
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get inventory items
    const itemsQuery = `
      SELECT * FROM inventory_items
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    queryParams.push(limit, offset);
    const itemsResult = await db.query(itemsQuery, queryParams);

    const response: PaginatedResponse<InventoryItem> = {
      success: true,
      data: itemsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching inventory items:', error);
    throw error;
  }
};

export const getInventoryItemById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Try to get from cache first
    const cachedItem = await getCache<InventoryItem>(`inventory_item:${id}`);
    if (cachedItem) {
      const response: APIResponse<InventoryItem> = {
        success: true,
        data: cachedItem,
        timestamp: new Date()
      };
      res.json(response);
      return;
    }

    const db = getDatabase();
    const query = 'SELECT * FROM inventory_items WHERE id = $1';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new CustomError('Inventory item not found', 404);
    }

    const item = result.rows[0];

    // Get stock movement history
    const movementsQuery = `
      SELECT * FROM inventory_movements 
      WHERE item_id = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    const movementsResult = await db.query(movementsQuery, [id]);
    item.recentMovements = movementsResult.rows;
    
    // Cache the item
    await setCache(`inventory_item:${id}`, item, 3600);

    const response: APIResponse<InventoryItem> = {
      success: true,
      data: item,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching inventory item:', error);
    throw error;
  }
};

export const updateInventoryItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { id } = req.params;
  const updateData = req.body;

  try {
    const db = getDatabase();

    // Check if item exists
    const existingItem = await db.query(
      'SELECT * FROM inventory_items WHERE id = $1',
      [id]
    );

    if (existingItem.rows.length === 0) {
      throw new CustomError('Inventory item not found', 404);
    }

    const currentItem = existingItem.rows[0];

    // Check if SKU is being updated and if it conflicts
    if (updateData.sku && updateData.sku !== currentItem.sku) {
      const skuCheck = await db.query(
        'SELECT id FROM inventory_items WHERE sku = $1 AND id != $2',
        [updateData.sku, id]
      );
      if (skuCheck.rows.length > 0) {
        throw new CustomError('SKU already exists', 409);
      }
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'id') {
        paramCount++;
        
        if (key === 'expiryDate') {
          updateFields.push(`expiry_date = $${paramCount}`);
          values.push(updateData[key] ? new Date(updateData[key]) : null);
        } else if (key === 'unitPrice') {
          updateFields.push(`unit_price = $${paramCount}`);
          values.push(updateData[key]);
        } else if (key === 'reorderLevel') {
          updateFields.push(`reorder_level = $${paramCount}`);
          values.push(updateData[key]);
        } else if (key === 'maxLevel') {
          updateFields.push(`max_level = $${paramCount}`);
          values.push(updateData[key]);
        } else if (key === 'batchNumber') {
          updateFields.push(`batch_number = $${paramCount}`);
          values.push(updateData[key]);
        } else {
          updateFields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramCount}`);
          values.push(updateData[key]);
        }
      }
    });

    if (updateFields.length === 0) {
      throw new CustomError('No valid fields to update', 400);
    }

    // Update status if quantity changed
    if (updateData.quantity !== undefined) {
      const newQuantity = updateData.quantity;
      const reorderLevel = updateData.reorderLevel || currentItem.reorder_level;
      
      let newStatus = InventoryStatus.IN_STOCK;
      if (newQuantity === 0) {
        newStatus = InventoryStatus.OUT_OF_STOCK;
      } else if (newQuantity <= reorderLevel) {
        newStatus = InventoryStatus.LOW_STOCK;
      }
      
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      values.push(newStatus);
    }

    // Add updated_at
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add id for WHERE clause
    paramCount++;
    values.push(id);

    const updateQuery = `
      UPDATE inventory_items 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);
    const updatedItem = result.rows[0];

    // Update cache
    await setCache(`inventory_item:${id}`, updatedItem, 3600);
    await deleteCache('inventory_items_list');

    logger.info('Inventory item updated successfully', {
      itemId: id,
      updatedBy: req.user?.id,
      updatedFields: Object.keys(updateData)
    });

    const response: APIResponse<InventoryItem> = {
      success: true,
      data: updatedItem,
      message: 'Inventory item updated successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error updating inventory item:', error);
    throw error;
  }
};

export const deleteInventoryItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const db = getDatabase();

    // Check if item exists
    const existingItem = await db.query(
      'SELECT * FROM inventory_items WHERE id = $1',
      [id]
    );

    if (existingItem.rows.length === 0) {
      throw new CustomError('Inventory item not found', 404);
    }

    // Check permissions - only admin can delete inventory items
    if (req.user?.role !== 'admin') {
      throw new CustomError('Only administrators can delete inventory items', 403);
    }

    // Soft delete - mark as deleted instead of actually deleting
    await db.query(
      'UPDATE inventory_items SET is_deleted = true, updated_at = $1 WHERE id = $2',
      [new Date(), id]
    );

    // Remove from cache
    await deleteCache(`inventory_item:${id}`);
    await deleteCache('inventory_items_list');

    logger.info('Inventory item deleted successfully', {
      itemId: id,
      deletedBy: req.user?.id
    });

    const response: APIResponse = {
      success: true,
      message: 'Inventory item deleted successfully',
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error deleting inventory item:', error);
    throw error;
  }
};

export const updateStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    validationErrorHandler(errors.array());
  }

  const { id } = req.params;
  const { quantity, type, reason, notes } = req.body;

  try {
    const db = getDatabase();

    // Check if item exists
    const existingItem = await db.query(
      'SELECT * FROM inventory_items WHERE id = $1',
      [id]
    );

    if (existingItem.rows.length === 0) {
      throw new CustomError('Inventory item not found', 404);
    }

    const item = existingItem.rows[0];
    let newQuantity = item.quantity;

    // Calculate new quantity based on movement type
    if (type === 'in') {
      newQuantity += quantity;
    } else if (type === 'out') {
      if (quantity > item.quantity) {
        throw new CustomError('Insufficient stock quantity', 400);
      }
      newQuantity -= quantity;
    } else {
      throw new CustomError('Invalid movement type. Must be "in" or "out"', 400);
    }

    // Determine new status
    let newStatus = InventoryStatus.IN_STOCK;
    if (newQuantity === 0) {
      newStatus = InventoryStatus.OUT_OF_STOCK;
    } else if (newQuantity <= item.reorder_level) {
      newStatus = InventoryStatus.LOW_STOCK;
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Update inventory item
      await db.query(
        'UPDATE inventory_items SET quantity = $1, status = $2, updated_at = $3 WHERE id = $4',
        [newQuantity, newStatus, new Date(), id]
      );

      // Record stock movement
      const movementId = uuidv4();
      await db.query(`
        INSERT INTO inventory_movements (
          id, item_id, type, quantity, previous_quantity, new_quantity, 
          reason, notes, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        movementId,
        id,
        type,
        quantity,
        item.quantity,
        newQuantity,
        reason,
        notes,
        req.user?.id,
        new Date()
      ]);

      // Commit transaction
      await db.query('COMMIT');

      // Update cache
      const updatedItem = { ...item, quantity: newQuantity, status: newStatus };
      await setCache(`inventory_item:${id}`, updatedItem, 3600);
      await deleteCache('inventory_items_list');

      logger.info('Stock updated successfully', {
        itemId: id,
        type,
        quantity,
        previousQuantity: item.quantity,
        newQuantity,
        updatedBy: req.user?.id
      });

      const response: APIResponse = {
        success: true,
        data: {
          item: updatedItem,
          movement: {
            id: movementId,
            type,
            quantity,
            previousQuantity: item.quantity,
            newQuantity,
            reason,
            notes
          }
        },
        message: 'Stock updated successfully',
        timestamp: new Date()
      };

      res.json(response);
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('Error updating stock:', error);
    throw error;
  }
};

export const getStockMovements = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const itemId = req.query.itemId as string;
    const type = req.query.type as string;
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    const offset = (page - 1) * limit;

    const db = getDatabase();
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramCount = 0;

    if (itemId) {
      paramCount++;
      whereClause += ` AND m.item_id = $${paramCount}`;
      queryParams.push(itemId);
    }

    if (type) {
      paramCount++;
      whereClause += ` AND m.type = $${paramCount}`;
      queryParams.push(type);
    }

    if (fromDate) {
      paramCount++;
      whereClause += ` AND m.created_at >= $${paramCount}`;
      queryParams.push(new Date(fromDate));
    }

    if (toDate) {
      paramCount++;
      whereClause += ` AND m.created_at <= $${paramCount}`;
      queryParams.push(new Date(toDate));
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM inventory_movements m 
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get movements with item details
    const movementsQuery = `
      SELECT 
        m.*,
        i.name as item_name,
        i.sku as item_sku,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM inventory_movements m
      LEFT JOIN inventory_items i ON m.item_id = i.id
      LEFT JOIN users u ON m.created_by = u.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    queryParams.push(limit, offset);
    const movementsResult = await db.query(movementsQuery, queryParams);

    const response: PaginatedResponse = {
      success: true,
      data: movementsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching stock movements:', error);
    throw error;
  }
};

export const getLowStockItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    
    const query = `
      SELECT * FROM inventory_items 
      WHERE quantity <= reorder_level 
      AND (is_deleted IS NULL OR is_deleted = false)
      ORDER BY (quantity::float / NULLIF(reorder_level, 0)) ASC
    `;
    
    const result = await db.query(query);

    const response: APIResponse = {
      success: true,
      data: result.rows,
      message: `Found ${result.rows.length} items with low stock`,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching low stock items:', error);
    throw error;
  }
};

export const getExpiringItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const db = getDatabase();
    
    const query = `
      SELECT * FROM inventory_items 
      WHERE expiry_date IS NOT NULL 
      AND expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
      AND (is_deleted IS NULL OR is_deleted = false)
      ORDER BY expiry_date ASC
    `;
    
    const result = await db.query(query);

    const response: APIResponse = {
      success: true,
      data: result.rows,
      message: `Found ${result.rows.length} items expiring within ${days} days`,
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching expiring items:', error);
    throw error;
  }
};

export const getInventoryStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDatabase();

    // Get inventory statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN status = 'in_stock' THEN 1 END) as in_stock_items,
        COUNT(CASE WHEN status = 'low_stock' THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN status = 'out_of_stock' THEN 1 END) as out_of_stock_items,
        COALESCE(SUM(quantity * unit_price), 0) as total_value,
        COUNT(CASE WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as expiring_soon
      FROM inventory_items 
      WHERE (is_deleted IS NULL OR is_deleted = false)
    `;

    const statsResult = await db.query(statsQuery);
    const stats = statsResult.rows[0];

    // Get category breakdown
    const categoryQuery = `
      SELECT 
        category,
        COUNT(*) as item_count,
        COALESCE(SUM(quantity * unit_price), 0) as category_value
      FROM inventory_items 
      WHERE (is_deleted IS NULL OR is_deleted = false)
      GROUP BY category
      ORDER BY category_value DESC
    `;

    const categoryResult = await db.query(categoryQuery);

    // Get recent movements
    const recentMovementsQuery = `
      SELECT 
        m.*,
        i.name as item_name,
        i.sku as item_sku
      FROM inventory_movements m
      LEFT JOIN inventory_items i ON m.item_id = i.id
      ORDER BY m.created_at DESC
      LIMIT 10
    `;

    const recentMovementsResult = await db.query(recentMovementsQuery);

    const response: APIResponse = {
      success: true,
      data: {
        overview: {
          totalItems: parseInt(stats.total_items),
          inStockItems: parseInt(stats.in_stock_items),
          lowStockItems: parseInt(stats.low_stock_items),
          outOfStockItems: parseInt(stats.out_of_stock_items),
          totalValue: parseFloat(stats.total_value),
          expiringSoon: parseInt(stats.expiring_soon)
        },
        categoryBreakdown: categoryResult.rows,
        recentMovements: recentMovementsResult.rows
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching inventory stats:', error);
    throw error;
  }
};