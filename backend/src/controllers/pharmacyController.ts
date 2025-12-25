import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '@/middleware/auth';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { setCache, getCache, deleteCache } from '@/config/redis';
import { dbQueryLogger, userActivityLogger } from '@/middleware/logging';

const prisma = new PrismaClient();

// Medications Management
export const getMedications = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search, category } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { genericName: { contains: search as string, mode: 'insensitive' } },
        { brandName: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.form = category;
    }

    const [medications, total] = await Promise.all([
      prisma.medication.findMany({
        where,
        include: {
          inventory: {
            select: {
              quantity: true,
              status: true,
              expiryDate: true,
            },
          },
        },
        skip: offset,
        take: Number(limit),
        orderBy: { name: 'asc' },
      }),
      prisma.medication.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        medications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching medications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medications',
    });
  }
};

export const getMedicationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const medication = await prisma.medication.findUnique({
      where: { id },
      include: {
        inventory: true,
        prescriptions: {
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                patientNumber: true,
              },
            },
            doctor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { prescribedDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!medication) {
      throw new AppError('Medication not found', 404);
    }

    res.json({
      success: true,
      data: medication,
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Error fetching medication:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching medication',
      });
    }
  }
};

export const createMedication = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const medicationData = req.body;

    const medication = await prisma.medication.create({
      data: medicationData,
    });

    logger.info(`Medication created: ${medication.id}`, {
      userId: req.user?.id,
      medicationId: medication.id,
    });

    res.status(201).json({
      success: true,
      data: medication,
      message: 'Medication created successfully',
    });
  } catch (error) {
    logger.error('Error creating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating medication',
    });
  }
};

export const updateMedication = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    const medication = await prisma.medication.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Medication updated: ${id}`, {
      userId: req.user?.id,
      medicationId: id,
    });

    res.json({
      success: true,
      data: medication,
      message: 'Medication updated successfully',
    });
  } catch (error) {
    logger.error('Error updating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating medication',
    });
  }
};

export const deleteMedication = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.medication.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`Medication deleted: ${id}`, {
      userId: req.user?.id,
      medicationId: id,
    });

    res.json({
      success: true,
      message: 'Medication deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting medication:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting medication',
    });
  }
};

// Inventory Management
export const getInventory = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, lowStock } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (lowStock === 'true') {
      where.OR = [
        { status: 'low_stock' },
        { status: 'out_of_stock' },
      ];
    }

    const [inventory, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: {
          medication: {
            select: {
              id: true,
              name: true,
              genericName: true,
              brandName: true,
              form: true,
            },
          },
        },
        skip: offset,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inventory.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        inventory,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inventory',
    });
  }
};

export const updateInventory = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const { quantity, unitPrice, expiryDate, batchNumber, supplier } = req.body;

    // Determine status based on quantity
    let status = 'in_stock';
    const inventory = await prisma.inventory.findUnique({
      where: { id },
      select: { minimumStockLevel: true },
    });

    if (inventory) {
      if (quantity === 0) {
        status = 'out_of_stock';
      } else if (quantity <= inventory.minimumStockLevel) {
        status = 'low_stock';
      }
    }

    const updatedInventory = await prisma.inventory.update({
      where: { id },
      data: {
        quantity,
        unitPrice,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        batchNumber,
        supplier,
        status,
      },
      include: {
        medication: true,
      },
    });

    logger.info(`Inventory updated: ${id}`, {
      userId: req.user?.id,
      inventoryId: id,
      newQuantity: quantity,
    });

    res.json({
      success: true,
      data: updatedInventory,
      message: 'Inventory updated successfully',
    });
  } catch (error) {
    logger.error('Error updating inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating inventory',
    });
  }
};

// Prescriptions Management
export const getPrescriptions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, patientId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (patientId) {
      where.patientId = patientId;
    }

    const [prescriptions, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              patientNumber: true,
            },
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          medication: {
            select: {
              id: true,
              name: true,
              genericName: true,
              form: true,
            },
          },
          dispensedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        skip: offset,
        take: Number(limit),
        orderBy: { prescribedDate: 'desc' },
      }),
      prisma.prescription.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        prescriptions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching prescriptions',
    });
  }
};

export const dispensePrescription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Check if prescription exists and is pending
    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        medication: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!prescription) {
      throw new AppError('Prescription not found', 404);
    }

    if (prescription.status !== 'pending') {
      throw new AppError('Prescription has already been processed', 400);
    }

    // Check inventory availability
    const availableInventory = prescription.medication.inventory.find(
      (inv) => inv.quantity >= quantity && inv.status === 'in_stock'
    );

    if (!availableInventory) {
      throw new AppError('Insufficient inventory for this medication', 400);
    }

    // Update prescription and inventory in a transaction
    await prisma.$transaction(async (tx) => {
      // Update prescription
      await tx.prescription.update({
        where: { id },
        data: {
          status: 'dispensed',
          dispensedDate: new Date(),
          dispensedBy: req.user?.id,
          quantity,
        },
      });

      // Update inventory
      const newQuantity = availableInventory.quantity - quantity;
      let newStatus = 'in_stock';
      
      if (newQuantity === 0) {
        newStatus = 'out_of_stock';
      } else if (newQuantity <= availableInventory.minimumStockLevel) {
        newStatus = 'low_stock';
      }

      await tx.inventory.update({
        where: { id: availableInventory.id },
        data: {
          quantity: newQuantity,
          status: newStatus,
        },
      });
    });

    logger.info(`Prescription dispensed: ${id}`, {
      userId: req.user?.id,
      prescriptionId: id,
      quantity,
    });

    res.json({
      success: true,
      message: 'Prescription dispensed successfully',
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      logger.error('Error dispensing prescription:', error);
      res.status(500).json({
        success: false,
        message: 'Error dispensing prescription',
      });
    }
  }
};

// Reports
export const getPharmacyReports = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get dispensed prescriptions count
    const dispensedCount = await prisma.prescription.count({
      where: {
        status: 'dispensed',
        dispensedDate: {
          gte: start,
          lte: end,
        },
      },
    });

    // Get low stock items
    const lowStockItems = await prisma.inventory.count({
      where: {
        OR: [
          { status: 'low_stock' },
          { status: 'out_of_stock' },
        ],
      },
    });

    // Get expired items
    const expiredItems = await prisma.inventory.count({
      where: {
        expiryDate: {
          lt: new Date(),
        },
      },
    });

    // Get top dispensed medications
    const topMedications = await prisma.prescription.groupBy({
      by: ['medicationId'],
      where: {
        status: 'dispensed',
        dispensedDate: {
          gte: start,
          lte: end,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    // Get medication details for top medications
    const medicationIds = topMedications.map(item => item.medicationId);
    const medications = await prisma.medication.findMany({
      where: {
        id: {
          in: medicationIds,
        },
      },
      select: {
        id: true,
        name: true,
        genericName: true,
      },
    });

    const topMedicationsWithDetails = topMedications.map(item => ({
      ...item,
      medication: medications.find(med => med.id === item.medicationId),
    }));

    res.json({
      success: true,
      data: {
        summary: {
          dispensedCount,
          lowStockItems,
          expiredItems,
        },
        topMedications: topMedicationsWithDetails,
      },
    });
  } catch (error) {
    logger.error('Error generating pharmacy reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating pharmacy reports',
    });
  }
};

// Add new functions for comprehensive pharmacy management

// Low Stock Alert Management
export const getLowStockAlerts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cacheKey = 'pharmacy:low_stock_alerts';
    const cached = await getCache(cacheKey);
    
    if (cached) {
      userActivityLogger(req.user?.id || 'unknown', 'pharmacy_low_stock_view', { source: 'cache' });
      res.json({
        success: true,
        data: cached,
        message: 'Low stock alerts retrieved from cache'
      });
      return;
    }

    const startTime = performance.now();
    
    const lowStockItems = await prisma.inventory.findMany({
      where: {
        OR: [
          { quantity: { lte: prisma.inventory.fields.minQuantity } },
          { status: 'low_stock' },
          { 
            expiryDate: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            }
          }
        ]
      },
      include: {
        medication: {
          select: {
            name: true,
            genericName: true,
            brandName: true,
            form: true,
            strength: true,
          }
        }
      },
      orderBy: [
        { quantity: 'asc' },
        { expiryDate: 'asc' }
      ]
    });

    const endTime = performance.now();
    dbQueryLogger('Low stock alerts query', [], endTime - startTime);

    const alertData = {
      lowStockItems,
      summary: {
        totalAlerts: lowStockItems.length,
        criticalStock: lowStockItems.filter(item => item.quantity <= (item.minQuantity || 0) * 0.5).length,
        expiringSoon: lowStockItems.filter(item => 
          item.expiryDate && item.expiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ).length
      }
    };

    await setCache(cacheKey, alertData, 300); // Cache for 5 minutes

    userActivityLogger(req.user?.id || 'unknown', 'pharmacy_low_stock_view', { 
      alertsCount: alertData.summary.totalAlerts 
    });

    res.json({
      success: true,
      data: alertData,
      message: 'Low stock alerts retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching low stock alerts:', error);
    throw new AppError('Failed to fetch low stock alerts', 500);
  }
};

// Batch Update Inventory
export const batchUpdateInventory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { updates } = req.body;
    
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new AppError('Updates array is required and cannot be empty', 400);
    }

    const startTime = performance.now();
    
    const results = await prisma.$transaction(async (tx) => {
      const updatePromises = updates.map(async (update: any) => {
        const { inventoryId, quantity, expiryDate, batchNumber, supplier } = update;
        
        return await tx.inventory.update({
          where: { id: inventoryId },
          data: {
            quantity: quantity !== undefined ? quantity : undefined,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            batchNumber: batchNumber || undefined,
            supplier: supplier || undefined,
            updatedAt: new Date(),
          },
          include: {
            medication: {
              select: { name: true, genericName: true }
            }
          }
        });
      });
      
      return await Promise.all(updatePromises);
    });

    const endTime = performance.now();
    dbQueryLogger('Batch inventory update', [updates.length], endTime - startTime);

    // Clear related caches
    await deleteCache('pharmacy:*');
    await deleteCache('inventory:*');

    userActivityLogger(req.user?.id || 'unknown', 'pharmacy_batch_update', { 
      updatedItems: results.length 
    });

    res.json({
      success: true,
      data: results,
      message: `Successfully updated ${results.length} inventory items`
    });

  } catch (error) {
    logger.error('Error in batch inventory update:', error);
    throw new AppError('Failed to update inventory items', 500);
  }
};

// Medication Interaction Check
export const checkMedicationInteractions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { patientId, medicationIds } = req.body;
    
    if (!patientId || !Array.isArray(medicationIds) || medicationIds.length === 0) {
      throw new AppError('Patient ID and medication IDs are required', 400);
    }

    const startTime = performance.now();
    
    // Get patient's current active prescriptions
    const activePrescriptions = await prisma.prescription.findMany({
      where: {
        patientId,
        status: 'active',
        endDate: { gte: new Date() }
      },
      include: {
        medication: {
          select: {
            id: true,
            name: true,
            genericName: true,
            contraindications: true,
            interactions: true,
          }
        }
      }
    });

    // Get the new medications being prescribed
    const newMedications = await prisma.medication.findMany({
      where: {
        id: { in: medicationIds }
      },
      select: {
        id: true,
        name: true,
        genericName: true,
        contraindications: true,
        interactions: true,
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Medication interaction check', [patientId, medicationIds.length], endTime - startTime);

    // Simple interaction checking logic (in real implementation, this would be more sophisticated)
    const interactions: any[] = [];
    const warnings: any[] = [];

    // Check interactions between current and new medications
    activePrescriptions.forEach(prescription => {
      newMedications.forEach(newMed => {
        if (prescription.medication.interactions && 
            prescription.medication.interactions.includes(newMed.genericName || newMed.name)) {
          interactions.push({
            type: 'drug_interaction',
            severity: 'moderate',
            currentMedication: prescription.medication,
            newMedication: newMed,
            description: `Potential interaction between ${prescription.medication.name} and ${newMed.name}`
          });
        }
      });
    });

    // Check for duplicate medications
    const currentMedNames = activePrescriptions.map(p => p.medication.genericName || p.medication.name);
    newMedications.forEach(newMed => {
      if (currentMedNames.includes(newMed.genericName || newMed.name)) {
        warnings.push({
          type: 'duplicate_medication',
          severity: 'high',
          medication: newMed,
          description: `Patient is already taking ${newMed.name}`
        });
      }
    });

    userActivityLogger(req.user?.id || 'unknown', 'medication_interaction_check', { 
      patientId,
      medicationsChecked: medicationIds.length,
      interactionsFound: interactions.length,
      warningsFound: warnings.length
    });

    res.json({
      success: true,
      data: {
        interactions,
        warnings,
        summary: {
          totalInteractions: interactions.length,
          totalWarnings: warnings.length,
          safe: interactions.length === 0 && warnings.length === 0
        }
      },
      message: 'Medication interaction check completed'
    });

  } catch (error) {
    logger.error('Error checking medication interactions:', error);
    throw new AppError('Failed to check medication interactions', 500);
  }
};

// Pharmacy Analytics
export const getPharmacyAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const cacheKey = `pharmacy:analytics:${start.toISOString()}:${end.toISOString()}`;
    const cached = await getCache(cacheKey);
    
    if (cached) {
      userActivityLogger(req.user?.id || 'unknown', 'pharmacy_analytics_view', { source: 'cache' });
      res.json({
        success: true,
        data: cached,
        message: 'Pharmacy analytics retrieved from cache'
      });
      return;
    }

    const startTime = performance.now();
    
    const [
      totalPrescriptions,
      dispensedPrescriptions,
      totalRevenue,
      topMedications,
      inventoryValue,
      expiringMedications
    ] = await Promise.all([
      prisma.prescription.count({
        where: {
          prescribedDate: { gte: start, lte: end }
        }
      }),
      prisma.prescription.count({
        where: {
          prescribedDate: { gte: start, lte: end },
          status: 'dispensed'
        }
      }),
      prisma.prescription.aggregate({
        where: {
          prescribedDate: { gte: start, lte: end },
          status: 'dispensed'
        },
        _sum: { totalCost: true }
      }),
      prisma.prescription.groupBy({
        by: ['medicationId'],
        where: {
          prescribedDate: { gte: start, lte: end },
          status: 'dispensed'
        },
        _count: { medicationId: true },
        _sum: { totalCost: true },
        orderBy: { _count: { medicationId: 'desc' } },
        take: 10
      }),
      prisma.inventory.aggregate({
        _sum: {
          quantity: true
        }
      }),
      prisma.inventory.count({
        where: {
          expiryDate: {
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
          }
        }
      })
    ]);

    // Get medication details for top medications
    const topMedicationIds = topMedications.map(item => item.medicationId);
    const medicationDetails = await prisma.medication.findMany({
      where: { id: { in: topMedicationIds } },
      select: { id: true, name: true, genericName: true }
    });

    const topMedicationsWithDetails = topMedications.map(item => ({
      ...item,
      medication: medicationDetails.find(med => med.id === item.medicationId)
    }));

    const endTime = performance.now();
    dbQueryLogger('Pharmacy analytics query', [start, end], endTime - startTime);

    const analyticsData = {
      summary: {
        totalPrescriptions,
        dispensedPrescriptions,
        dispensingRate: totalPrescriptions > 0 ? (dispensedPrescriptions / totalPrescriptions * 100).toFixed(2) : 0,
        totalRevenue: totalRevenue._sum.totalCost || 0,
        inventoryValue: inventoryValue._sum.quantity || 0,
        expiringMedications
      },
      topMedications: topMedicationsWithDetails,
      period: { startDate: start, endDate: end }
    };

    await setCache(cacheKey, analyticsData, 1800); // Cache for 30 minutes

    userActivityLogger(req.user?.id || 'unknown', 'pharmacy_analytics_view', { 
      period: `${start.toISOString()} to ${end.toISOString()}`,
      totalPrescriptions,
      revenue: analyticsData.summary.totalRevenue
    });

    res.json({
      success: true,
      data: analyticsData,
      message: 'Pharmacy analytics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching pharmacy analytics:', error);
    throw new AppError('Failed to fetch pharmacy analytics', 500);
  }
};