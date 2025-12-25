import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import SupplyChainService from '../services/supplyChainService';

const router = express.Router();
const supplyChainService = new SupplyChainService();

// Supplier Management Routes
router.get('/suppliers', authenticateToken, async (req, res) => {
  try {
    const { category, status, rating } = req.query;
    const filters = {
      category: category as string,
      status: status as string,
      rating: rating ? parseFloat(rating as string) : undefined
    };

    const suppliers = await supplyChainService.getSuppliers(filters);
    res.json({
      success: true,
      data: suppliers,
      total: suppliers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching suppliers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    const supplier = await supplyChainService.getSupplierById(req.params.id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/suppliers', authenticateToken, requireRole(['admin', 'procurement_manager']), async (req, res) => {
  try {
    const supplier = await supplyChainService.createSupplier(req.body);
    res.status(201).json({
      success: true,
      data: supplier,
      message: 'Supplier created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating supplier',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/suppliers/:id', authenticateToken, requireRole(['admin', 'procurement_manager']), async (req, res) => {
  try {
    const supplier = await supplyChainService.updateSupplier(req.params.id, req.body);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: supplier,
      message: 'Supplier updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating supplier',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/suppliers/:id/performance', authenticateToken, async (req, res) => {
  try {
    const performance = await supplyChainService.evaluateSupplierPerformance(req.params.id);
    if (!performance) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error evaluating supplier performance',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Product Management Routes
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const { category, manufacturer, inStock } = req.query;
    const filters = {
      category: category as string,
      manufacturer: manufacturer as string,
      inStock: inStock ? inStock === 'true' : undefined
    };

    const products = await supplyChainService.getProducts(filters);
    res.json({
      success: true,
      data: products,
      total: products.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/products', authenticateToken, requireRole(['admin', 'inventory_manager']), async (req, res) => {
  try {
    const product = await supplyChainService.createProduct(req.body);
    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Inventory Management Routes
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const { locationId, lowStock, category } = req.query;
    const filters = {
      locationId: locationId as string,
      lowStock: lowStock ? lowStock === 'true' : undefined,
      category: category as string
    };

    const inventory = await supplyChainService.getInventory(filters);
    res.json({
      success: true,
      data: inventory,
      total: inventory.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/inventory/stock-movement', authenticateToken, requireRole(['admin', 'inventory_manager', 'warehouse_staff']), async (req, res) => {
  try {
    const { productId, locationId, quantity, type, reason, additionalData } = req.body;
    const userId = (req as any).user.id;

    const movement = await supplyChainService.updateStock(
      productId,
      locationId,
      quantity,
      type,
      reason,
      userId,
      additionalData
    );

    res.status(201).json({
      success: true,
      data: movement,
      message: 'Stock movement recorded successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error recording stock movement',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/inventory/stock-movements', authenticateToken, async (req, res) => {
  try {
    const { productId, locationId, type, startDate, endDate } = req.query;
    const filters = {
      productId: productId as string,
      locationId: locationId as string,
      type: type as string,
      startDate: startDate as string,
      endDate: endDate as string
    };

    const movements = await supplyChainService.getStockMovements(filters);
    res.json({
      success: true,
      data: movements,
      total: movements.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching stock movements',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/inventory/reorder-recommendations', authenticateToken, async (req, res) => {
  try {
    const recommendations = await supplyChainService.generateReorderRecommendations();
    res.json({
      success: true,
      data: recommendations,
      total: recommendations.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating reorder recommendations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Purchase Order Management Routes
router.get('/purchase-orders', authenticateToken, async (req, res) => {
  try {
    const { status, supplierId, startDate, endDate } = req.query;
    const filters = {
      status: status as string,
      supplierId: supplierId as string,
      startDate: startDate as string,
      endDate: endDate as string
    };

    const orders = await supplyChainService.getPurchaseOrders(filters);
    res.json({
      success: true,
      data: orders,
      total: orders.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase orders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/purchase-orders', authenticateToken, requireRole(['admin', 'procurement_manager']), async (req, res) => {
  try {
    const order = await supplyChainService.createPurchaseOrder(req.body);
    res.status(201).json({
      success: true,
      data: order,
      message: 'Purchase order created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating purchase order',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/purchase-orders/:id/status', authenticateToken, requireRole(['admin', 'procurement_manager']), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const order = await supplyChainService.updatePurchaseOrderStatus(req.params.id, status, notes);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.json({
      success: true,
      data: order,
      message: 'Purchase order status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating purchase order status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Purchase Requisition Management Routes
router.get('/requisitions', authenticateToken, async (req, res) => {
  try {
    const { status, requestedBy, department } = req.query;
    const filters = {
      status: status as string,
      requestedBy: requestedBy as string,
      department: department as string
    };

    const requisitions = await supplyChainService.getRequisitions(filters);
    res.json({
      success: true,
      data: requisitions,
      total: requisitions.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching requisitions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/requisitions', authenticateToken, async (req, res) => {
  try {
    const requisition = await supplyChainService.createRequisition(req.body);
    res.status(201).json({
      success: true,
      data: requisition,
      message: 'Requisition created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating requisition',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/requisitions/:id/approve', authenticateToken, requireRole(['admin', 'department_head', 'procurement_manager']), async (req, res) => {
  try {
    const { comments } = req.body;
    const approverId = (req as any).user.id;
    
    const requisition = await supplyChainService.approveRequisition(req.params.id, approverId, comments);
    
    if (!requisition) {
      return res.status(404).json({
        success: false,
        message: 'Requisition not found'
      });
    }

    res.json({
      success: true,
      data: requisition,
      message: 'Requisition approved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving requisition',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Warehouse Management Routes
router.get('/warehouses', authenticateToken, async (req, res) => {
  try {
    const warehouses = await supplyChainService.getWarehouses();
    res.json({
      success: true,
      data: warehouses,
      total: warehouses.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching warehouses',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/warehouses/:id', authenticateToken, async (req, res) => {
  try {
    const warehouse = await supplyChainService.getWarehouseById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse not found'
      });
    }

    res.json({
      success: true,
      data: warehouse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching warehouse',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/warehouses/:warehouseId/zones/:zoneId/utilization', authenticateToken, requireRole(['admin', 'warehouse_manager']), async (req, res) => {
  try {
    const { warehouseId, zoneId } = req.params;
    const { utilization } = req.body;

    const success = await supplyChainService.updateWarehouseUtilization(warehouseId, zoneId, utilization);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Warehouse or zone not found'
      });
    }

    res.json({
      success: true,
      message: 'Warehouse utilization updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating warehouse utilization',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Quality Control Routes
router.get('/quality-controls', authenticateToken, async (req, res) => {
  try {
    const { type, status, referenceId } = req.query;
    const filters = {
      type: type as string,
      status: status as string,
      referenceId: referenceId as string
    };

    const qualityControls = await supplyChainService.getQualityControls(filters);
    res.json({
      success: true,
      data: qualityControls,
      total: qualityControls.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching quality controls',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/quality-controls', authenticateToken, requireRole(['admin', 'quality_inspector']), async (req, res) => {
  try {
    const qualityControl = await supplyChainService.createQualityControl(req.body);
    res.status(201).json({
      success: true,
      data: qualityControl,
      message: 'Quality control record created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating quality control record',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Analytics and Reporting Routes
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const analytics = await supplyChainService.getSupplyChainAnalytics();
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching supply chain analytics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk Operations Routes
router.post('/bulk/stock-movements', authenticateToken, requireRole(['admin', 'inventory_manager']), async (req, res) => {
  try {
    const { movements } = req.body;
    const userId = (req as any).user.id;
    const results = [];

    for (const movement of movements) {
      try {
        const result = await supplyChainService.updateStock(
          movement.productId,
          movement.locationId,
          movement.quantity,
          movement.type,
          movement.reason,
          userId,
          movement.additionalData
        );
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          movement 
        });
      }
    }

    res.json({
      success: true,
      data: results,
      message: 'Bulk stock movements processed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing bulk stock movements',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export Routes
router.get('/export/inventory', authenticateToken, async (req, res) => {
  try {
    const inventory = await supplyChainService.getInventory();
    
    // Convert to CSV format
    const csvHeaders = 'Product ID,Location ID,Current Stock,Available Stock,Minimum Stock,Reorder Point,Total Value\n';
    const csvData = inventory.map(inv => 
      `${inv.productId},${inv.locationId},${inv.currentStock},${inv.availableStock},${inv.minimumStock},${inv.reorderPoint},${inv.totalValue}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory_export.csv');
    res.send(csvHeaders + csvData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting inventory data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/export/suppliers', authenticateToken, async (req, res) => {
  try {
    const suppliers = await supplyChainService.getSuppliers();
    
    // Convert to CSV format
    const csvHeaders = 'ID,Name,Category,Status,Rating,Contact Person,Email,Phone\n';
    const csvData = suppliers.map(supplier => 
      `${supplier.id},${supplier.name},${supplier.category},${supplier.status},${supplier.rating},${supplier.contactPerson},${supplier.email},${supplier.phone}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=suppliers_export.csv');
    res.send(csvHeaders + csvData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error exporting suppliers data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health Check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Supply Chain service is healthy',
    timestamp: new Date().toISOString(),
    service: 'supply-chain'
  });
});

export default router;