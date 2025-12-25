import { v4 as uuidv4 } from 'uuid';

// Interfaces
export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  category: 'pharmaceutical' | 'medical_equipment' | 'consumables' | 'services' | 'other';
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  rating: number;
  certifications: string[];
  paymentTerms: string;
  deliveryTime: number; // in days
  minimumOrderValue: number;
  contractStartDate: string;
  contractEndDate: string;
  performanceMetrics: {
    onTimeDeliveryRate: number;
    qualityScore: number;
    responseTime: number;
    costCompetitiveness: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  sku: string;
  barcode: string;
  manufacturer: string;
  brand: string;
  unitOfMeasure: string;
  specifications: Record<string, any>;
  regulatoryInfo: {
    fdaApproved: boolean;
    ceMarking: boolean;
    isoStandards: string[];
    expirationTracking: boolean;
  };
  storageRequirements: {
    temperature: { min: number; max: number };
    humidity: { min: number; max: number };
    specialConditions: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Inventory {
  id: string;
  productId: string;
  locationId: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  minimumStock: number;
  maximumStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  averageCost: number;
  lastCost: number;
  totalValue: number;
  lastUpdated: string;
  stockMovements: StockMovement[];
}

export interface StockMovement {
  id: string;
  productId: string;
  locationId: string;
  type: 'inbound' | 'outbound' | 'transfer' | 'adjustment' | 'return';
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  referenceNumber: string;
  batchNumber?: string;
  expirationDate?: string;
  userId: string;
  timestamp: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  requestedBy: string;
  approvedBy?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'acknowledged' | 'partially_received' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  orderDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  terms: string;
  notes: string;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;
  pendingQuantity: number;
  specifications: Record<string, any>;
}

export interface PurchaseRequisition {
  id: string;
  requisitionNumber: string;
  requestedBy: string;
  department: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted_to_po' | 'cancelled';
  requestDate: string;
  requiredDate: string;
  justification: string;
  items: RequisitionItem[];
  totalEstimatedCost: number;
  approvalWorkflow: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

export interface RequisitionItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  estimatedUnitPrice: number;
  estimatedTotalPrice: number;
  specifications: Record<string, any>;
  suggestedSupplier?: string;
}

export interface ApprovalStep {
  id: string;
  stepNumber: number;
  approverRole: string;
  approverId?: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  timestamp?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: 'main' | 'satellite' | 'cold_storage' | 'hazardous' | 'quarantine';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  capacity: {
    totalArea: number;
    usedArea: number;
    availableArea: number;
    zones: WarehouseZone[];
  };
  environmentalControls: {
    temperatureControlled: boolean;
    humidityControlled: boolean;
    airFiltration: boolean;
    securityLevel: 'basic' | 'medium' | 'high' | 'maximum';
  };
  operatingHours: {
    monday: { open: string; close: string };
    tuesday: { open: string; close: string };
    wednesday: { open: string; close: string };
    thursday: { open: string; close: string };
    friday: { open: string; close: string };
    saturday: { open: string; close: string };
    sunday: { open: string; close: string };
  };
  managerId: string;
  status: 'active' | 'inactive' | 'maintenance';
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseZone {
  id: string;
  name: string;
  type: 'receiving' | 'storage' | 'picking' | 'packing' | 'shipping' | 'quarantine' | 'returns';
  area: number;
  capacity: number;
  currentUtilization: number;
  environmentalRequirements: {
    temperature: { min: number; max: number };
    humidity: { min: number; max: number };
    specialConditions: string[];
  };
}

export interface DeliverySchedule {
  id: string;
  purchaseOrderId: string;
  supplierId: string;
  warehouseId: string;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDuration: number; // in minutes
  status: 'scheduled' | 'confirmed' | 'in_transit' | 'arrived' | 'unloading' | 'completed' | 'delayed' | 'cancelled';
  trackingNumber?: string;
  carrier?: string;
  vehicleInfo?: {
    type: string;
    plateNumber: string;
    driverName: string;
    driverPhone: string;
  };
  specialInstructions: string;
  actualArrivalTime?: string;
  actualCompletionTime?: string;
  deliveryNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualityControl {
  id: string;
  type: 'incoming_inspection' | 'in_process_inspection' | 'final_inspection' | 'random_audit';
  referenceId: string; // PO ID, Product ID, etc.
  referenceType: 'purchase_order' | 'product' | 'batch' | 'supplier';
  inspectorId: string;
  inspectionDate: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'conditional_pass';
  checkpoints: QualityCheckpoint[];
  overallScore: number;
  notes: string;
  attachments: string[];
  corrective_actions: CorrectiveAction[];
  createdAt: string;
  updatedAt: string;
}

export interface QualityCheckpoint {
  id: string;
  parameter: string;
  expectedValue: string;
  actualValue: string;
  tolerance: string;
  result: 'pass' | 'fail' | 'warning';
  notes?: string;
}

export interface CorrectiveAction {
  id: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  status: 'open' | 'in_progress' | 'completed' | 'overdue';
  completedDate?: string;
  notes?: string;
}

export interface SupplyChainAnalytics {
  inventoryMetrics: {
    totalValue: number;
    turnoverRate: number;
    stockoutEvents: number;
    excessStock: number;
    deadStock: number;
    averageDaysOnHand: number;
  };
  supplierMetrics: {
    totalSuppliers: number;
    activeSuppliers: number;
    averageRating: number;
    onTimeDeliveryRate: number;
    qualityScore: number;
    costSavings: number;
  };
  procurementMetrics: {
    totalPurchaseOrders: number;
    averageOrderValue: number;
    averageProcessingTime: number;
    approvalCycleTime: number;
    emergencyOrders: number;
    costVariance: number;
  };
  warehouseMetrics: {
    utilizationRate: number;
    receivingEfficiency: number;
    pickingAccuracy: number;
    shippingPerformance: number;
    operationalCosts: number;
  };
}

class SupplyChainService {
  private suppliers: Map<string, Supplier> = new Map();
  private products: Map<string, Product> = new Map();
  private inventory: Map<string, Inventory> = new Map();
  private purchaseOrders: Map<string, PurchaseOrder> = new Map();
  private requisitions: Map<string, PurchaseRequisition> = new Map();
  private warehouses: Map<string, Warehouse> = new Map();
  private deliverySchedules: Map<string, DeliverySchedule> = new Map();
  private qualityControls: Map<string, QualityControl> = new Map();
  private stockMovements: StockMovement[] = [];

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData(): void {
    // Initialize default suppliers
    const defaultSuppliers: Supplier[] = [
      {
        id: 'supplier-001',
        name: 'MedSupply Corp',
        contactPerson: 'John Smith',
        email: 'john.smith@medsupply.com',
        phone: '+1-555-0101',
        address: {
          street: '123 Medical Drive',
          city: 'Boston',
          state: 'MA',
          zipCode: '02101',
          country: 'USA'
        },
        category: 'pharmaceutical',
        status: 'active',
        rating: 4.5,
        certifications: ['ISO 9001', 'FDA Registered', 'GMP Certified'],
        paymentTerms: 'Net 30',
        deliveryTime: 5,
        minimumOrderValue: 1000,
        contractStartDate: '2024-01-01',
        contractEndDate: '2024-12-31',
        performanceMetrics: {
          onTimeDeliveryRate: 95.5,
          qualityScore: 4.7,
          responseTime: 2.5,
          costCompetitiveness: 4.2
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'supplier-002',
        name: 'EquipMed Solutions',
        contactPerson: 'Sarah Johnson',
        email: 'sarah.johnson@equipmed.com',
        phone: '+1-555-0102',
        address: {
          street: '456 Equipment Blvd',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'USA'
        },
        category: 'medical_equipment',
        status: 'active',
        rating: 4.3,
        certifications: ['ISO 13485', 'CE Marking', 'FDA 510(k)'],
        paymentTerms: 'Net 45',
        deliveryTime: 10,
        minimumOrderValue: 5000,
        contractStartDate: '2024-01-01',
        contractEndDate: '2024-12-31',
        performanceMetrics: {
          onTimeDeliveryRate: 92.0,
          qualityScore: 4.5,
          responseTime: 3.0,
          costCompetitiveness: 4.0
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    defaultSuppliers.forEach(supplier => {
      this.suppliers.set(supplier.id, supplier);
    });

    // Initialize default warehouses
    const defaultWarehouses: Warehouse[] = [
      {
        id: 'warehouse-001',
        name: 'Main Medical Warehouse',
        code: 'MMW-001',
        type: 'main',
        address: {
          street: '789 Storage Way',
          city: 'Houston',
          state: 'TX',
          zipCode: '77001',
          country: 'USA'
        },
        capacity: {
          totalArea: 50000,
          usedArea: 35000,
          availableArea: 15000,
          zones: [
            {
              id: 'zone-001',
              name: 'Pharmaceutical Storage',
              type: 'storage',
              area: 20000,
              capacity: 10000,
              currentUtilization: 7500,
              environmentalRequirements: {
                temperature: { min: 15, max: 25 },
                humidity: { min: 45, max: 65 },
                specialConditions: ['Climate Controlled', 'Security Monitored']
              }
            },
            {
              id: 'zone-002',
              name: 'Equipment Storage',
              type: 'storage',
              area: 15000,
              capacity: 5000,
              currentUtilization: 3000,
              environmentalRequirements: {
                temperature: { min: 10, max: 30 },
                humidity: { min: 30, max: 70 },
                specialConditions: ['Dust Free', 'Anti-Static']
              }
            }
          ]
        },
        environmentalControls: {
          temperatureControlled: true,
          humidityControlled: true,
          airFiltration: true,
          securityLevel: 'high'
        },
        operatingHours: {
          monday: { open: '06:00', close: '22:00' },
          tuesday: { open: '06:00', close: '22:00' },
          wednesday: { open: '06:00', close: '22:00' },
          thursday: { open: '06:00', close: '22:00' },
          friday: { open: '06:00', close: '22:00' },
          saturday: { open: '08:00', close: '18:00' },
          sunday: { open: '08:00', close: '18:00' }
        },
        managerId: 'user-warehouse-001',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    defaultWarehouses.forEach(warehouse => {
      this.warehouses.set(warehouse.id, warehouse);
    });
  }

  // Supplier Management
  async getSuppliers(filters?: {
    category?: string;
    status?: string;
    rating?: number;
  }): Promise<Supplier[]> {
    let suppliers = Array.from(this.suppliers.values());

    if (filters) {
      if (filters.category) {
        suppliers = suppliers.filter(s => s.category === filters.category);
      }
      if (filters.status) {
        suppliers = suppliers.filter(s => s.status === filters.status);
      }
      if (filters.rating) {
        suppliers = suppliers.filter(s => s.rating >= filters.rating);
      }
    }

    return suppliers;
  }

  async getSupplierById(id: string): Promise<Supplier | null> {
    return this.suppliers.get(id) || null;
  }

  async createSupplier(supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    const supplier: Supplier = {
      ...supplierData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.suppliers.set(supplier.id, supplier);
    return supplier;
  }

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | null> {
    const supplier = this.suppliers.get(id);
    if (!supplier) return null;

    const updatedSupplier = {
      ...supplier,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.suppliers.set(id, updatedSupplier);
    return updatedSupplier;
  }

  async evaluateSupplierPerformance(supplierId: string): Promise<any> {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) return null;

    // Calculate performance metrics based on historical data
    const orders = Array.from(this.purchaseOrders.values())
      .filter(po => po.supplierId === supplierId);

    const onTimeDeliveries = orders.filter(po => 
      po.actualDeliveryDate && po.actualDeliveryDate <= po.expectedDeliveryDate
    ).length;

    const qualityIssues = Array.from(this.qualityControls.values())
      .filter(qc => qc.referenceType === 'supplier' && qc.referenceId === supplierId && qc.status === 'failed');

    const performance = {
      totalOrders: orders.length,
      onTimeDeliveryRate: orders.length > 0 ? (onTimeDeliveries / orders.length) * 100 : 0,
      qualityScore: qualityIssues.length === 0 ? 5.0 : Math.max(1.0, 5.0 - (qualityIssues.length * 0.5)),
      averageOrderValue: orders.reduce((sum, po) => sum + po.totalAmount, 0) / orders.length || 0,
      responseTime: 2.5, // Mock data
      costCompetitiveness: 4.0, // Mock data
      recommendations: this.generateSupplierRecommendations(supplier, {
        onTimeDeliveryRate: (onTimeDeliveries / orders.length) * 100,
        qualityScore: qualityIssues.length === 0 ? 5.0 : Math.max(1.0, 5.0 - (qualityIssues.length * 0.5))
      })
    };

    return performance;
  }

  private generateSupplierRecommendations(supplier: Supplier, metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.onTimeDeliveryRate < 90) {
      recommendations.push('Consider discussing delivery schedule improvements with supplier');
    }
    if (metrics.qualityScore < 4.0) {
      recommendations.push('Implement additional quality control measures for this supplier');
    }
    if (supplier.rating < 4.0) {
      recommendations.push('Evaluate alternative suppliers for better performance');
    }

    return recommendations;
  }

  // Product Management
  async getProducts(filters?: {
    category?: string;
    manufacturer?: string;
    inStock?: boolean;
  }): Promise<Product[]> {
    let products = Array.from(this.products.values());

    if (filters) {
      if (filters.category) {
        products = products.filter(p => p.category === filters.category);
      }
      if (filters.manufacturer) {
        products = products.filter(p => p.manufacturer === filters.manufacturer);
      }
      if (filters.inStock !== undefined) {
        const inventoryItems = Array.from(this.inventory.values());
        const inStockProductIds = inventoryItems
          .filter(inv => inv.availableStock > 0)
          .map(inv => inv.productId);
        
        if (filters.inStock) {
          products = products.filter(p => inStockProductIds.includes(p.id));
        } else {
          products = products.filter(p => !inStockProductIds.includes(p.id));
        }
      }
    }

    return products;
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const product: Product = {
      ...productData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.products.set(product.id, product);
    return product;
  }

  // Inventory Management
  async getInventory(filters?: {
    locationId?: string;
    lowStock?: boolean;
    category?: string;
  }): Promise<Inventory[]> {
    let inventory = Array.from(this.inventory.values());

    if (filters) {
      if (filters.locationId) {
        inventory = inventory.filter(inv => inv.locationId === filters.locationId);
      }
      if (filters.lowStock) {
        inventory = inventory.filter(inv => inv.availableStock <= inv.reorderPoint);
      }
      if (filters.category) {
        const categoryProducts = Array.from(this.products.values())
          .filter(p => p.category === filters.category)
          .map(p => p.id);
        inventory = inventory.filter(inv => categoryProducts.includes(inv.productId));
      }
    }

    return inventory;
  }

  async updateStock(
    productId: string,
    locationId: string,
    quantity: number,
    type: StockMovement['type'],
    reason: string,
    userId: string,
    additionalData?: {
      unitCost?: number;
      batchNumber?: string;
      expirationDate?: string;
      referenceNumber?: string;
    }
  ): Promise<StockMovement> {
    const inventoryKey = `${productId}-${locationId}`;
    let inventory = this.inventory.get(inventoryKey);

    if (!inventory) {
      inventory = {
        id: uuidv4(),
        productId,
        locationId,
        currentStock: 0,
        reservedStock: 0,
        availableStock: 0,
        minimumStock: 10,
        maximumStock: 1000,
        reorderPoint: 20,
        reorderQuantity: 100,
        averageCost: 0,
        lastCost: 0,
        totalValue: 0,
        lastUpdated: new Date().toISOString(),
        stockMovements: []
      };
    }

    const movement: StockMovement = {
      id: uuidv4(),
      productId,
      locationId,
      type,
      quantity: Math.abs(quantity),
      unitCost: additionalData?.unitCost || inventory.averageCost,
      totalCost: Math.abs(quantity) * (additionalData?.unitCost || inventory.averageCost),
      reason,
      referenceNumber: additionalData?.referenceNumber || '',
      batchNumber: additionalData?.batchNumber,
      expirationDate: additionalData?.expirationDate,
      userId,
      timestamp: new Date().toISOString()
    };

    // Update inventory based on movement type
    if (type === 'inbound') {
      inventory.currentStock += quantity;
      inventory.availableStock += quantity;
    } else if (type === 'outbound') {
      inventory.currentStock -= quantity;
      inventory.availableStock -= quantity;
    }

    // Update costs
    if (additionalData?.unitCost) {
      inventory.lastCost = additionalData.unitCost;
      // Simple weighted average for average cost
      const totalValue = inventory.totalValue + movement.totalCost;
      const totalQuantity = inventory.currentStock;
      inventory.averageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;
    }

    inventory.totalValue = inventory.currentStock * inventory.averageCost;
    inventory.lastUpdated = new Date().toISOString();

    this.inventory.set(inventoryKey, inventory);
    this.stockMovements.push(movement);

    return movement;
  }

  async getStockMovements(filters?: {
    productId?: string;
    locationId?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<StockMovement[]> {
    let movements = [...this.stockMovements];

    if (filters) {
      if (filters.productId) {
        movements = movements.filter(m => m.productId === filters.productId);
      }
      if (filters.locationId) {
        movements = movements.filter(m => m.locationId === filters.locationId);
      }
      if (filters.type) {
        movements = movements.filter(m => m.type === filters.type);
      }
      if (filters.startDate) {
        movements = movements.filter(m => m.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        movements = movements.filter(m => m.timestamp <= filters.endDate!);
      }
    }

    return movements.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Purchase Order Management
  async createPurchaseOrder(orderData: Omit<PurchaseOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder> {
    const orderNumber = `PO-${Date.now()}`;
    
    const purchaseOrder: PurchaseOrder = {
      ...orderData,
      id: uuidv4(),
      orderNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.purchaseOrders.set(purchaseOrder.id, purchaseOrder);
    return purchaseOrder;
  }

  async getPurchaseOrders(filters?: {
    status?: string;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PurchaseOrder[]> {
    let orders = Array.from(this.purchaseOrders.values());

    if (filters) {
      if (filters.status) {
        orders = orders.filter(po => po.status === filters.status);
      }
      if (filters.supplierId) {
        orders = orders.filter(po => po.supplierId === filters.supplierId);
      }
      if (filters.startDate) {
        orders = orders.filter(po => po.orderDate >= filters.startDate!);
      }
      if (filters.endDate) {
        orders = orders.filter(po => po.orderDate <= filters.endDate!);
      }
    }

    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updatePurchaseOrderStatus(id: string, status: PurchaseOrder['status'], notes?: string): Promise<PurchaseOrder | null> {
    const order = this.purchaseOrders.get(id);
    if (!order) return null;

    const updatedOrder = {
      ...order,
      status,
      notes: notes || order.notes,
      updatedAt: new Date().toISOString()
    };

    this.purchaseOrders.set(id, updatedOrder);
    return updatedOrder;
  }

  // Purchase Requisition Management
  async createRequisition(reqData: Omit<PurchaseRequisition, 'id' | 'requisitionNumber' | 'createdAt' | 'updatedAt'>): Promise<PurchaseRequisition> {
    const requisitionNumber = `REQ-${Date.now()}`;
    
    const requisition: PurchaseRequisition = {
      ...reqData,
      id: uuidv4(),
      requisitionNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.requisitions.set(requisition.id, requisition);
    return requisition;
  }

  async getRequisitions(filters?: {
    status?: string;
    requestedBy?: string;
    department?: string;
  }): Promise<PurchaseRequisition[]> {
    let requisitions = Array.from(this.requisitions.values());

    if (filters) {
      if (filters.status) {
        requisitions = requisitions.filter(req => req.status === filters.status);
      }
      if (filters.requestedBy) {
        requisitions = requisitions.filter(req => req.requestedBy === filters.requestedBy);
      }
      if (filters.department) {
        requisitions = requisitions.filter(req => req.department === filters.department);
      }
    }

    return requisitions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async approveRequisition(id: string, approverId: string, comments?: string): Promise<PurchaseRequisition | null> {
    const requisition = this.requisitions.get(id);
    if (!requisition) return null;

    // Find the next pending approval step
    const pendingStep = requisition.approvalWorkflow.find(step => step.status === 'pending');
    if (pendingStep) {
      pendingStep.status = 'approved';
      pendingStep.approverId = approverId;
      pendingStep.comments = comments;
      pendingStep.timestamp = new Date().toISOString();
    }

    // Check if all approvals are complete
    const allApproved = requisition.approvalWorkflow.every(step => step.status === 'approved');
    if (allApproved) {
      requisition.status = 'approved';
    }

    requisition.updatedAt = new Date().toISOString();
    this.requisitions.set(id, requisition);
    return requisition;
  }

  // Warehouse Management
  async getWarehouses(): Promise<Warehouse[]> {
    return Array.from(this.warehouses.values());
  }

  async getWarehouseById(id: string): Promise<Warehouse | null> {
    return this.warehouses.get(id) || null;
  }

  async updateWarehouseUtilization(warehouseId: string, zoneId: string, newUtilization: number): Promise<boolean> {
    const warehouse = this.warehouses.get(warehouseId);
    if (!warehouse) return false;

    const zone = warehouse.capacity.zones.find(z => z.id === zoneId);
    if (!zone) return false;

    zone.currentUtilization = newUtilization;
    warehouse.capacity.usedArea = warehouse.capacity.zones.reduce((sum, z) => sum + z.currentUtilization, 0);
    warehouse.capacity.availableArea = warehouse.capacity.totalArea - warehouse.capacity.usedArea;
    warehouse.updatedAt = new Date().toISOString();

    this.warehouses.set(warehouseId, warehouse);
    return true;
  }

  // Quality Control
  async createQualityControl(qcData: Omit<QualityControl, 'id' | 'createdAt' | 'updatedAt'>): Promise<QualityControl> {
    const qualityControl: QualityControl = {
      ...qcData,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.qualityControls.set(qualityControl.id, qualityControl);
    return qualityControl;
  }

  async getQualityControls(filters?: {
    type?: string;
    status?: string;
    referenceId?: string;
  }): Promise<QualityControl[]> {
    let qcs = Array.from(this.qualityControls.values());

    if (filters) {
      if (filters.type) {
        qcs = qcs.filter(qc => qc.type === filters.type);
      }
      if (filters.status) {
        qcs = qcs.filter(qc => qc.status === filters.status);
      }
      if (filters.referenceId) {
        qcs = qcs.filter(qc => qc.referenceId === filters.referenceId);
      }
    }

    return qcs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Analytics and Reporting
  async getSupplyChainAnalytics(): Promise<SupplyChainAnalytics> {
    const inventory = Array.from(this.inventory.values());
    const suppliers = Array.from(this.suppliers.values());
    const purchaseOrders = Array.from(this.purchaseOrders.values());
    const warehouses = Array.from(this.warehouses.values());

    const analytics: SupplyChainAnalytics = {
      inventoryMetrics: {
        totalValue: inventory.reduce((sum, inv) => sum + inv.totalValue, 0),
        turnoverRate: 12.5, // Mock calculation
        stockoutEvents: inventory.filter(inv => inv.availableStock === 0).length,
        excessStock: inventory.filter(inv => inv.availableStock > inv.maximumStock).length,
        deadStock: inventory.filter(inv => inv.availableStock > 0 && inv.lastUpdated < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()).length,
        averageDaysOnHand: 45.2 // Mock calculation
      },
      supplierMetrics: {
        totalSuppliers: suppliers.length,
        activeSuppliers: suppliers.filter(s => s.status === 'active').length,
        averageRating: suppliers.reduce((sum, s) => sum + s.rating, 0) / suppliers.length || 0,
        onTimeDeliveryRate: suppliers.reduce((sum, s) => sum + s.performanceMetrics.onTimeDeliveryRate, 0) / suppliers.length || 0,
        qualityScore: suppliers.reduce((sum, s) => sum + s.performanceMetrics.qualityScore, 0) / suppliers.length || 0,
        costSavings: 125000 // Mock calculation
      },
      procurementMetrics: {
        totalPurchaseOrders: purchaseOrders.length,
        averageOrderValue: purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0) / purchaseOrders.length || 0,
        averageProcessingTime: 3.5, // Mock calculation in days
        approvalCycleTime: 2.1, // Mock calculation in days
        emergencyOrders: purchaseOrders.filter(po => po.priority === 'urgent').length,
        costVariance: 5.2 // Mock calculation as percentage
      },
      warehouseMetrics: {
        utilizationRate: warehouses.reduce((sum, w) => sum + (w.capacity.usedArea / w.capacity.totalArea), 0) / warehouses.length * 100 || 0,
        receivingEfficiency: 92.5, // Mock calculation
        pickingAccuracy: 98.7, // Mock calculation
        shippingPerformance: 94.2, // Mock calculation
        operationalCosts: 85000 // Mock calculation
      }
    };

    return analytics;
  }

  async generateReorderRecommendations(): Promise<Array<{
    productId: string;
    productName: string;
    currentStock: number;
    reorderPoint: number;
    recommendedQuantity: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    estimatedCost: number;
    suggestedSupplier: string;
  }>> {
    const inventory = Array.from(this.inventory.values());
    const products = Array.from(this.products.values());
    
    const recommendations = inventory
      .filter(inv => inv.availableStock <= inv.reorderPoint)
      .map(inv => {
        const product = products.find(p => p.id === inv.productId);
        const urgency = inv.availableStock === 0 ? 'critical' :
                       inv.availableStock <= inv.reorderPoint * 0.5 ? 'high' :
                       inv.availableStock <= inv.reorderPoint * 0.75 ? 'medium' : 'low';

        return {
          productId: inv.productId,
          productName: product?.name || 'Unknown Product',
          currentStock: inv.availableStock,
          reorderPoint: inv.reorderPoint,
          recommendedQuantity: inv.reorderQuantity,
          urgency,
          estimatedCost: inv.reorderQuantity * inv.averageCost,
          suggestedSupplier: 'supplier-001' // Mock - would be based on best supplier logic
        };
      });

    return recommendations.sort((a, b) => {
      const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    });
  }
}

export default SupplyChainService;