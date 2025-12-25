import { query, queryOne, queryMany, buildSelectQuery, buildInsertQuery, buildUpdateQuery, buildDeleteQuery } from '@/utils/database';
import { INVENTORY_STATUS, INVENTORY_CATEGORIES } from '@/utils/constants';

export interface InventoryItem {
  id: string;
  item_code: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  barcode?: string;
  unit_of_measure: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price?: number;
  location: string;
  storage_conditions?: string;
  expiry_date?: Date;
  batch_number?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_contact?: string;
  last_restocked_date?: Date;
  last_used_date?: Date;
  status: string;
  is_active: boolean;
  is_critical: boolean;
  requires_prescription: boolean;
  side_effects?: string[];
  contraindications?: string[];
  dosage_forms?: string[];
  strength?: string;
  composition?: string;
  usage_instructions?: string;
  storage_temperature?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface StockMovement {
  id: string;
  item_id: string;
  movement_type: string; // IN, OUT, ADJUSTMENT, TRANSFER, EXPIRED, DAMAGED
  quantity: number;
  unit_cost?: number;
  total_cost?: number;
  reference_type?: string; // PURCHASE, SALE, PRESCRIPTION, ADJUSTMENT, TRANSFER
  reference_id?: string;
  from_location?: string;
  to_location?: string;
  batch_number?: string;
  expiry_date?: Date;
  reason?: string;
  notes?: string;
  performed_by?: string;
  created_at: Date;
}

export interface CreateInventoryItemData {
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  barcode?: string;
  unit_of_measure: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price?: number;
  location: string;
  storage_conditions?: string;
  expiry_date?: Date;
  batch_number?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_contact?: string;
  is_critical?: boolean;
  requires_prescription?: boolean;
  side_effects?: string[];
  contraindications?: string[];
  dosage_forms?: string[];
  strength?: string;
  composition?: string;
  usage_instructions?: string;
  storage_temperature?: string;
  notes?: string;
  created_by?: string;
}

export interface UpdateInventoryItemData {
  name?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  barcode?: string;
  unit_of_measure?: string;
  minimum_stock?: number;
  maximum_stock?: number;
  reorder_point?: number;
  reorder_quantity?: number;
  unit_cost?: number;
  selling_price?: number;
  location?: string;
  storage_conditions?: string;
  expiry_date?: Date;
  batch_number?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_contact?: string;
  status?: string;
  is_active?: boolean;
  is_critical?: boolean;
  requires_prescription?: boolean;
  side_effects?: string[];
  contraindications?: string[];
  dosage_forms?: string[];
  strength?: string;
  composition?: string;
  usage_instructions?: string;
  storage_temperature?: string;
  notes?: string;
  updated_by?: string;
}

export interface CreateStockMovementData {
  item_id: string;
  movement_type: string;
  quantity: number;
  unit_cost?: number;
  reference_type?: string;
  reference_id?: string;
  from_location?: string;
  to_location?: string;
  batch_number?: string;
  expiry_date?: Date;
  reason?: string;
  notes?: string;
  performed_by?: string;
}

export interface InventoryFilters {
  category?: string;
  subcategory?: string;
  location?: string;
  status?: string;
  is_critical?: boolean;
  low_stock?: boolean;
  expired?: boolean;
  expiring_soon?: number; // days
  supplier_id?: string;
  search?: string;
}

export interface StockMovementFilters {
  item_id?: string;
  movement_type?: string;
  reference_type?: string;
  date_from?: Date;
  date_to?: Date;
  performed_by?: string;
  search?: string;
}

export class InventoryModel {
  private static itemTableName = 'inventory_items';
  private static movementTableName = 'stock_movements';

  /**
   * Create a new inventory item
   */
  static async createItem(itemData: CreateInventoryItemData): Promise<InventoryItem> {
    const itemCode = await this.generateItemCode(itemData.category);
    
    const data = {
      item_code: itemCode,
      name: itemData.name,
      description: itemData.description,
      category: itemData.category,
      subcategory: itemData.subcategory,
      brand: itemData.brand,
      manufacturer: itemData.manufacturer,
      model_number: itemData.model_number,
      serial_number: itemData.serial_number,
      barcode: itemData.barcode,
      unit_of_measure: itemData.unit_of_measure,
      current_stock: itemData.current_stock,
      minimum_stock: itemData.minimum_stock,
      maximum_stock: itemData.maximum_stock,
      reorder_point: itemData.reorder_point,
      reorder_quantity: itemData.reorder_quantity,
      unit_cost: itemData.unit_cost,
      selling_price: itemData.selling_price,
      location: itemData.location,
      storage_conditions: itemData.storage_conditions,
      expiry_date: itemData.expiry_date,
      batch_number: itemData.batch_number,
      supplier_id: itemData.supplier_id,
      supplier_name: itemData.supplier_name,
      supplier_contact: itemData.supplier_contact,
      last_restocked_date: new Date(),
      status: INVENTORY_STATUS.AVAILABLE,
      is_active: true,
      is_critical: itemData.is_critical || false,
      requires_prescription: itemData.requires_prescription || false,
      side_effects: JSON.stringify(itemData.side_effects || []),
      contraindications: JSON.stringify(itemData.contraindications || []),
      dosage_forms: JSON.stringify(itemData.dosage_forms || []),
      strength: itemData.strength,
      composition: itemData.composition,
      usage_instructions: itemData.usage_instructions,
      storage_temperature: itemData.storage_temperature,
      notes: itemData.notes,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: itemData.created_by,
    };

    const { query: insertQuery, values } = buildInsertQuery(this.itemTableName, data);
    const result = await queryOne<InventoryItem>(insertQuery, values);
    
    if (!result) {
      throw new Error('Failed to create inventory item');
    }

    // Record initial stock movement
    if (itemData.current_stock > 0) {
      await this.createStockMovement({
        item_id: result.id,
        movement_type: 'IN',
        quantity: itemData.current_stock,
        unit_cost: itemData.unit_cost,
        reference_type: 'INITIAL_STOCK',
        reason: 'Initial stock entry',
        performed_by: itemData.created_by,
      });
    }

    return this.parseItemJsonFields(result);
  }

  /**
   * Find inventory item by ID
   */
  static async findItemById(id: string): Promise<InventoryItem | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.itemTableName,
      ['*'],
      { id }
    );
    
    const result = await queryOne<InventoryItem>(selectQuery, values);
    return result ? this.parseItemJsonFields(result) : null;
  }

  /**
   * Find inventory item by item code
   */
  static async findItemByCode(itemCode: string): Promise<InventoryItem | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.itemTableName,
      ['*'],
      { item_code: itemCode }
    );
    
    const result = await queryOne<InventoryItem>(selectQuery, values);
    return result ? this.parseItemJsonFields(result) : null;
  }

  /**
   * Find inventory items with filters and pagination
   */
  static async findItems(
    filters: InventoryFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'name',
    sortOrder: 'ASC' | 'DESC' = 'ASC'
  ): Promise<{ items: InventoryItem[]; total: number }> {
    let whereClause = 'WHERE is_active = true';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.category) {
      whereClause += ` AND category = $${paramIndex++}`;
      values.push(filters.category);
    }

    if (filters.subcategory) {
      whereClause += ` AND subcategory = $${paramIndex++}`;
      values.push(filters.subcategory);
    }

    if (filters.location) {
      whereClause += ` AND location = $${paramIndex++}`;
      values.push(filters.location);
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.is_critical !== undefined) {
      whereClause += ` AND is_critical = $${paramIndex++}`;
      values.push(filters.is_critical);
    }

    if (filters.low_stock) {
      whereClause += ` AND current_stock <= reorder_point`;
    }

    if (filters.expired) {
      whereClause += ` AND expiry_date < CURRENT_DATE`;
    }

    if (filters.expiring_soon) {
      whereClause += ` AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${filters.expiring_soon} days'`;
    }

    if (filters.supplier_id) {
      whereClause += ` AND supplier_id = $${paramIndex++}`;
      values.push(filters.supplier_id);
    }

    if (filters.search) {
      whereClause += ` AND (
        name ILIKE $${paramIndex} OR 
        item_code ILIKE $${paramIndex} OR
        description ILIKE $${paramIndex} OR
        brand ILIKE $${paramIndex} OR
        manufacturer ILIKE $${paramIndex} OR
        barcode ILIKE $${paramIndex}
      )`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const orderBy = `ORDER BY ${sortBy} ${sortOrder}`;
    const limitClause = `LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const selectQuery = `
      SELECT * FROM ${this.itemTableName}
      ${whereClause}
      ${orderBy}
      ${limitClause}
    `;

    const items = await queryMany<InventoryItem>(selectQuery, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.itemTableName}
      ${whereClause}
    `;
    
    const countResult = await queryOne<{ total: string }>(countQuery, values.slice(0, -2));
    const total = parseInt(countResult?.total || '0', 10);

    return {
      items: items.map(item => this.parseItemJsonFields(item)),
      total
    };
  }

  /**
   * Update inventory item
   */
  static async updateItem(id: string, updateData: UpdateInventoryItemData): Promise<InventoryItem | null> {
    const data: Record<string, any> = {
      ...updateData,
      updated_at: new Date(),
    };

    // Handle JSON fields
    if (updateData.side_effects) {
      data.side_effects = JSON.stringify(updateData.side_effects);
    }

    if (updateData.contraindications) {
      data.contraindications = JSON.stringify(updateData.contraindications);
    }

    if (updateData.dosage_forms) {
      data.dosage_forms = JSON.stringify(updateData.dosage_forms);
    }

    const { query: updateQuery, values } = buildUpdateQuery(
      this.itemTableName,
      data,
      { id }
    );

    const result = await queryOne<InventoryItem>(updateQuery, values);
    return result ? this.parseItemJsonFields(result) : null;
  }

  /**
   * Update stock quantity
   */
  static async updateStock(
    itemId: string,
    quantity: number,
    movementType: string,
    movementData: Partial<CreateStockMovementData> = {}
  ): Promise<InventoryItem | null> {
    const item = await this.findItemById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    let newStock: number;
    if (movementType === 'IN') {
      newStock = item.current_stock + quantity;
    } else if (movementType === 'OUT') {
      if (item.current_stock < quantity) {
        throw new Error('Insufficient stock');
      }
      newStock = item.current_stock - quantity;
    } else {
      // ADJUSTMENT
      newStock = quantity;
    }

    // Update item stock
    const updateData: Record<string, any> = {
      current_stock: newStock,
      updated_at: new Date(),
    };

    if (movementType === 'IN') {
      updateData.last_restocked_date = new Date();
    } else if (movementType === 'OUT') {
      updateData.last_used_date = new Date();
    }

    // Update status based on stock level
    if (newStock <= 0) {
      updateData.status = INVENTORY_STATUS.OUT_OF_STOCK;
    } else if (newStock <= item.reorder_point) {
      updateData.status = INVENTORY_STATUS.LOW_STOCK;
    } else {
      updateData.status = INVENTORY_STATUS.AVAILABLE;
    }

    const { query: updateQuery, values } = buildUpdateQuery(
      this.itemTableName,
      updateData,
      { id: itemId }
    );

    const updatedItem = await queryOne<InventoryItem>(updateQuery, values);

    // Record stock movement
    await this.createStockMovement({
      item_id: itemId,
      movement_type: movementType,
      quantity: movementType === 'ADJUSTMENT' ? newStock - item.current_stock : quantity,
      ...movementData,
    });

    return updatedItem ? this.parseItemJsonFields(updatedItem) : null;
  }

  /**
   * Create stock movement record
   */
  static async createStockMovement(movementData: CreateStockMovementData): Promise<StockMovement> {
    const data = {
      item_id: movementData.item_id,
      movement_type: movementData.movement_type,
      quantity: movementData.quantity,
      unit_cost: movementData.unit_cost,
      total_cost: movementData.unit_cost ? movementData.unit_cost * Math.abs(movementData.quantity) : null,
      reference_type: movementData.reference_type,
      reference_id: movementData.reference_id,
      from_location: movementData.from_location,
      to_location: movementData.to_location,
      batch_number: movementData.batch_number,
      expiry_date: movementData.expiry_date,
      reason: movementData.reason,
      notes: movementData.notes,
      performed_by: movementData.performed_by,
      created_at: new Date(),
    };

    const { query: insertQuery, values } = buildInsertQuery(this.movementTableName, data);
    const result = await queryOne<StockMovement>(insertQuery, values);
    
    if (!result) {
      throw new Error('Failed to create stock movement');
    }

    return result;
  }

  /**
   * Find stock movements with filters and pagination
   */
  static async findStockMovements(
    filters: StockMovementFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ movements: StockMovement[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.item_id) {
      whereClause += ` AND item_id = $${paramIndex++}`;
      values.push(filters.item_id);
    }

    if (filters.movement_type) {
      whereClause += ` AND movement_type = $${paramIndex++}`;
      values.push(filters.movement_type);
    }

    if (filters.reference_type) {
      whereClause += ` AND reference_type = $${paramIndex++}`;
      values.push(filters.reference_type);
    }

    if (filters.date_from) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      values.push(filters.date_to);
    }

    if (filters.performed_by) {
      whereClause += ` AND performed_by = $${paramIndex++}`;
      values.push(filters.performed_by);
    }

    if (filters.search) {
      whereClause += ` AND (
        reason ILIKE $${paramIndex} OR 
        notes ILIKE $${paramIndex} OR
        batch_number ILIKE $${paramIndex} OR
        reference_id ILIKE $${paramIndex}
      )`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const orderBy = `ORDER BY ${sortBy} ${sortOrder}`;
    const limitClause = `LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const selectQuery = `
      SELECT sm.*, ii.name as item_name, ii.item_code
      FROM ${this.movementTableName} sm
      LEFT JOIN ${this.itemTableName} ii ON sm.item_id = ii.id
      ${whereClause}
      ${orderBy}
      ${limitClause}
    `;

    const movements = await queryMany<StockMovement & { item_name: string; item_code: string }>(selectQuery, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.movementTableName}
      ${whereClause}
    `;
    
    const countResult = await queryOne<{ total: string }>(countQuery, values.slice(0, -2));
    const total = parseInt(countResult?.total || '0', 10);

    return {
      movements,
      total
    };
  }

  /**
   * Get low stock items
   */
  static async getLowStockItems(): Promise<InventoryItem[]> {
    const selectQuery = `
      SELECT * FROM ${this.itemTableName}
      WHERE current_stock <= reorder_point 
        AND is_active = true
        AND status != '${INVENTORY_STATUS.DISCONTINUED}'
      ORDER BY (current_stock::float / NULLIF(reorder_point, 0)) ASC
    `;

    const items = await queryMany<InventoryItem>(selectQuery);
    return items.map(item => this.parseItemJsonFields(item));
  }

  /**
   * Get expired items
   */
  static async getExpiredItems(): Promise<InventoryItem[]> {
    const selectQuery = `
      SELECT * FROM ${this.itemTableName}
      WHERE expiry_date < CURRENT_DATE 
        AND is_active = true
        AND current_stock > 0
      ORDER BY expiry_date ASC
    `;

    const items = await queryMany<InventoryItem>(selectQuery);
    return items.map(item => this.parseItemJsonFields(item));
  }

  /**
   * Get items expiring soon
   */
  static async getExpiringItems(days: number = 30): Promise<InventoryItem[]> {
    const selectQuery = `
      SELECT * FROM ${this.itemTableName}
      WHERE expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
        AND is_active = true
        AND current_stock > 0
      ORDER BY expiry_date ASC
    `;

    const items = await queryMany<InventoryItem>(selectQuery);
    return items.map(item => this.parseItemJsonFields(item));
  }

  /**
   * Get items by category
   */
  static async getItemsByCategory(category: string): Promise<InventoryItem[]> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.itemTableName,
      ['*'],
      { category, is_active: true }
    );

    const items = await queryMany<InventoryItem>(selectQuery, values);
    return items.map(item => this.parseItemJsonFields(item));
  }

  /**
   * Search items
   */
  static async searchItems(searchTerm: string, limit: number = 10): Promise<InventoryItem[]> {
    const searchQuery = `
      SELECT * FROM ${this.itemTableName}
      WHERE (
        name ILIKE $1 OR 
        item_code ILIKE $1 OR
        description ILIKE $1 OR
        brand ILIKE $1 OR
        manufacturer ILIKE $1 OR
        barcode = $2
      )
      AND is_active = true
      ORDER BY 
        CASE 
          WHEN item_code ILIKE $1 THEN 1
          WHEN name ILIKE $1 THEN 2
          WHEN barcode = $2 THEN 3
          ELSE 4
        END,
        name
      LIMIT $3
    `;

    const items = await queryMany<InventoryItem>(searchQuery, [
      `%${searchTerm}%`,
      searchTerm,
      limit
    ]);

    return items.map(item => this.parseItemJsonFields(item));
  }

  /**
   * Get inventory statistics
   */
  static async getInventoryStatistics(): Promise<{
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    expiredItems: number;
    expiringItems: number;
    byCategory: Record<string, { count: number; value: number }>;
    byLocation: Record<string, { count: number; value: number }>;
    topMovingItems: { item_name: string; item_code: string; total_movement: number }[];
  }> {
    const itemStatsQuery = `
      SELECT 
        COUNT(*) as total_items,
        SUM(current_stock * unit_cost) as total_value,
        COUNT(CASE WHEN current_stock <= reorder_point THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_items,
        COUNT(CASE WHEN expiry_date < CURRENT_DATE AND current_stock > 0 THEN 1 END) as expired_items,
        COUNT(CASE WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' AND current_stock > 0 THEN 1 END) as expiring_items
      FROM ${this.itemTableName}
      WHERE is_active = true
    `;

    const categoryStatsQuery = `
      SELECT 
        category,
        COUNT(*) as count,
        SUM(current_stock * unit_cost) as value
      FROM ${this.itemTableName}
      WHERE is_active = true
      GROUP BY category
    `;

    const locationStatsQuery = `
      SELECT 
        location,
        COUNT(*) as count,
        SUM(current_stock * unit_cost) as value
      FROM ${this.itemTableName}
      WHERE is_active = true
      GROUP BY location
    `;

    const topMovingItemsQuery = `
      SELECT 
        ii.name as item_name,
        ii.item_code,
        SUM(ABS(sm.quantity)) as total_movement
      FROM ${this.movementTableName} sm
      JOIN ${this.itemTableName} ii ON sm.item_id = ii.id
      WHERE sm.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY ii.id, ii.name, ii.item_code
      ORDER BY total_movement DESC
      LIMIT 10
    `;

    const [itemStats, categoryStats, locationStats, topMovingItems] = await Promise.all([
      queryOne<{
        total_items: string;
        total_value: string;
        low_stock_items: string;
        out_of_stock_items: string;
        expired_items: string;
        expiring_items: string;
      }>(itemStatsQuery),
      queryMany<{ category: string; count: string; value: string }>(categoryStatsQuery),
      queryMany<{ location: string; count: string; value: string }>(locationStatsQuery),
      queryMany<{ item_name: string; item_code: string; total_movement: string }>(topMovingItemsQuery),
    ]);

    const byCategory = categoryStats.reduce((acc, item) => {
      acc[item.category] = {
        count: parseInt(item.count, 10),
        value: parseFloat(item.value || '0'),
      };
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    const byLocation = locationStats.reduce((acc, item) => {
      acc[item.location] = {
        count: parseInt(item.count, 10),
        value: parseFloat(item.value || '0'),
      };
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    const topMovingItemsData = topMovingItems.map(item => ({
      item_name: item.item_name,
      item_code: item.item_code,
      total_movement: parseInt(item.total_movement, 10),
    }));

    return {
      totalItems: parseInt(itemStats?.total_items || '0', 10),
      totalValue: parseFloat(itemStats?.total_value || '0'),
      lowStockItems: parseInt(itemStats?.low_stock_items || '0', 10),
      outOfStockItems: parseInt(itemStats?.out_of_stock_items || '0', 10),
      expiredItems: parseInt(itemStats?.expired_items || '0', 10),
      expiringItems: parseInt(itemStats?.expiring_items || '0', 10),
      byCategory,
      byLocation,
      topMovingItems: topMovingItemsData,
    };
  }

  /**
   * Generate item code
   */
  private static async generateItemCode(category: string): Promise<string> {
    const categoryPrefix = category.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 3).toUpperCase();
    
    return `${categoryPrefix}-${timestamp}-${random}`;
  }

  /**
   * Check if item code exists
   */
  static async itemCodeExists(itemCode: string, excludeId?: string): Promise<boolean> {
    const conditions: Record<string, any> = { item_code: itemCode };

    if (excludeId) {
      conditions.id = { operator: '!=', value: excludeId };
    }

    const { query: selectQuery, values } = buildSelectQuery(
      this.itemTableName,
      ['id'],
      conditions
    );

    const result = await queryOne(selectQuery, values);
    return !!result;
  }

  /**
   * Delete item (soft delete by setting is_active to false)
   */
  static async deleteItem(id: string): Promise<boolean> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.itemTableName,
      {
        is_active: false,
        status: INVENTORY_STATUS.DISCONTINUED,
        updated_at: new Date(),
      },
      { id }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Hard delete item (permanent deletion)
   */
  static async hardDeleteItem(id: string): Promise<boolean> {
    const { query: deleteQuery, values } = buildDeleteQuery(
      this.itemTableName,
      { id }
    );

    const result = await query(deleteQuery, values);
    return result.rowCount > 0;
  }

  /**
   * Parse JSON fields from item database result
   */
  private static parseItemJsonFields(item: InventoryItem): InventoryItem {
    return {
      ...item,
      side_effects: this.parseJsonField(item.side_effects),
      contraindications: this.parseJsonField(item.contraindications),
      dosage_forms: this.parseJsonField(item.dosage_forms),
    };
  }

  /**
   * Parse individual JSON field
   */
  private static parseJsonField(field: any): string[] {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return [];
      }
    }
    return Array.isArray(field) ? field : [];
  }
}