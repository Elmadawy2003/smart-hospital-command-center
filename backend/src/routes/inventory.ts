import { Router } from 'express';
import {
  createInventoryItem,
  getInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
  updateStock,
  getStockMovements,
  getLowStockItems,
  getExpiringItems,
  getInventoryStats
} from '../controllers/inventoryController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { inventorySchemas } from '../middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   POST /api/inventory
 * @desc    Create a new inventory item
 * @access  Private (Admin, Inventory Manager)
 */
router.post(
  '/',
  authorize(['admin', 'inventory_manager']),
  validate(inventorySchemas.createItem),
  createInventoryItem
);

/**
 * @route   GET /api/inventory
 * @desc    Get all inventory items with pagination and filtering
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  getInventoryItems
);

/**
 * @route   GET /api/inventory/stats
 * @desc    Get inventory statistics
 * @access  Private (Admin, Inventory Manager)
 */
router.get(
  '/stats',
  authorize(['admin', 'inventory_manager']),
  getInventoryStats
);

/**
 * @route   GET /api/inventory/low-stock
 * @desc    Get items with low stock
 * @access  Private (Admin, Inventory Manager)
 */
router.get(
  '/low-stock',
  authorize(['admin', 'inventory_manager']),
  getLowStockItems
);

/**
 * @route   GET /api/inventory/expiring
 * @desc    Get items expiring soon
 * @access  Private (Admin, Inventory Manager)
 */
router.get(
  '/expiring',
  authorize(['admin', 'inventory_manager']),
  getExpiringItems
);

/**
 * @route   GET /api/inventory/:id
 * @desc    Get inventory item by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  getInventoryItemById
);

/**
 * @route   PUT /api/inventory/:id
 * @desc    Update inventory item
 * @access  Private (Admin, Inventory Manager)
 */
router.put(
  '/:id',
  authorize(['admin', 'inventory_manager']),
  updateInventoryItem
);

/**
 * @route   DELETE /api/inventory/:id
 * @desc    Delete inventory item (soft delete)
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authorize(['admin']),
  deleteInventoryItem
);

/**
 * @route   POST /api/inventory/:id/stock
 * @desc    Update stock quantity
 * @access  Private (Admin, Inventory Manager)
 */
router.post(
  '/:id/stock',
  authorize(['admin', 'inventory_manager']),
  validate(inventorySchemas.updateStock),
  updateStock
);

/**
 * @route   GET /api/inventory/:id/movements
 * @desc    Get stock movement history
 * @access  Private (Admin, Inventory Manager)
 */
router.get(
  '/:id/movements',
  authorize(['admin', 'inventory_manager']),
  getStockMovements
);

export default router;