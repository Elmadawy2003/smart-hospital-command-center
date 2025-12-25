import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '@/middleware/auth';
import { AppError } from '@/middleware/errorHandler';
import { getCache, setCache, deleteCache } from '@/config/redis';
import { logger } from '@/utils/logger';
import { dbQueryLogger } from '@/utils/logger';
import { userActivityLogger } from '@/utils/logger';

const prisma = new PrismaClient();

// Patient Management
export const getPatients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { mrn: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status !== undefined) {
      where.isActive = status === 'active';
    }

    const startTime = performance.now();
    
    const [patients, totalCount] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          appointments: {
            take: 1,
            orderBy: { appointmentDate: 'desc' },
            include: { doctor: { select: { firstName: true, lastName: true } } }
          },
          medicalRecords: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { doctor: { select: { firstName: true, lastName: true } } }
          },
          _count: {
            select: {
              appointments: true,
              medicalRecords: true,
              labResults: true,
              prescriptions: true,
            }
          }
        }
      }),
      prisma.patient.count({ where })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Patient list query', [], endTime - startTime);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        patients: patients.map(patient => ({
          ...patient,
          lastAppointment: patient.appointments[0] || null,
          lastMedicalRecord: patient.medicalRecords[0] || null,
          counts: patient._count,
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        }
      },
      message: `Retrieved ${patients.length} patients successfully`
    });

  } catch (error) {
    logger.error('Error fetching patients:', error);
    throw new AppError('Failed to fetch patients', 500);
  }
};

export const getPatientById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const includeHistory = req.query.includeHistory === 'true';

    // Check cache first
    const cacheKey = `patient:${id}:${includeHistory}`;
    const cachedPatient = await getCache(cacheKey);
    
    if (cachedPatient) {
      return res.json({
        success: true,
        data: JSON.parse(cachedPatient),
        message: 'Patient retrieved successfully (cached)'
      });
    }

    const startTime = performance.now();
    
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        appointments: includeHistory ? {
          orderBy: { appointmentDate: 'desc' },
          include: {
            doctor: { select: { firstName: true, lastName: true, specialization: true } },
            department: { select: { name: true } }
          }
        } : {
          take: 5,
          orderBy: { appointmentDate: 'desc' },
          include: {
            doctor: { select: { firstName: true, lastName: true, specialization: true } }
          }
        },
        medicalRecords: includeHistory ? {
          orderBy: { createdAt: 'desc' },
          include: {
            doctor: { select: { firstName: true, lastName: true, specialization: true } }
          }
        } : {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            doctor: { select: { firstName: true, lastName: true, specialization: true } }
          }
        },
        labResults: includeHistory ? {
          orderBy: { testDate: 'desc' },
          include: {
            technician: { select: { firstName: true, lastName: true } },
            verifier: { select: { firstName: true, lastName: true } }
          }
        } : {
          take: 5,
          orderBy: { testDate: 'desc' },
          include: {
            technician: { select: { firstName: true, lastName: true } }
          }
        },
        prescriptions: includeHistory ? {
          orderBy: { createdAt: 'desc' },
          include: {
            doctor: { select: { firstName: true, lastName: true } },
            medications: {
              include: {
                medication: { select: { name: true, dosage: true, form: true } }
              }
            }
          }
        } : {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            doctor: { select: { firstName: true, lastName: true } },
            medications: {
              include: {
                medication: { select: { name: true, dosage: true, form: true } }
              }
            }
          }
        },
        billings: includeHistory ? {
          orderBy: { createdAt: 'desc' }
        } : {
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            appointments: true,
            medicalRecords: true,
            labResults: true,
            prescriptions: true,
            billings: true,
          }
        }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Patient detail query', [id], endTime - startTime);

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    // Cache the result for 5 minutes
    await setCache(cacheKey, JSON.stringify(patient), 300);

    res.json({
      success: true,
      data: patient,
      message: 'Patient retrieved successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching patient:', error);
    throw new AppError('Failed to fetch patient', 500);
  }
};

export const createPatient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      emergencyContact,
      insuranceInfo,
      medicalHistory,
      allergies,
      bloodType,
      maritalStatus,
      occupation,
      nationality,
    } = req.body;

    // Check for duplicate email or phone
    if (email || phone) {
      const existingPatient = await prisma.patient.findFirst({
        where: {
          OR: [
            email ? { email } : {},
            phone ? { phone } : {},
          ].filter(condition => Object.keys(condition).length > 0)
        }
      });

      if (existingPatient) {
        throw new AppError('Patient with this email or phone already exists', 409);
      }
    }

    const startTime = performance.now();
    
    const patient = await prisma.patient.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        phone,
        email,
        address,
        emergencyContact,
        insuranceInfo,
        medicalHistory,
        allergies,
        bloodType,
        maritalStatus,
        occupation,
        nationality,
        createdBy: req.user!.id,
      },
      include: {
        _count: {
          select: {
            appointments: true,
            medicalRecords: true,
            labResults: true,
            prescriptions: true,
          }
        }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Patient creation', [patient.id], endTime - startTime);

    // Log user activity
    logger.info('Patient created', {
      patientId: patient.id,
      createdBy: req.user!.id,
      patientName: `${firstName} ${lastName}`,
    });

    res.status(201).json({
      success: true,
      data: patient,
      message: 'Patient created successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error creating patient:', error);
    throw new AppError('Failed to create patient', 500);
  }
};

export const updatePatient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.mrn;
    delete updateData.createdAt;
    delete updateData.createdBy;

    // Check if patient exists
    const existingPatient = await prisma.patient.findUnique({
      where: { id }
    });

    if (!existingPatient) {
      throw new AppError('Patient not found', 404);
    }

    // Check for duplicate email or phone (excluding current patient)
    if (updateData.email || updateData.phone) {
      const duplicatePatient = await prisma.patient.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                updateData.email ? { email: updateData.email } : {},
                updateData.phone ? { phone: updateData.phone } : {},
              ].filter(condition => Object.keys(condition).length > 0)
            }
          ]
        }
      });

      if (duplicatePatient) {
        throw new AppError('Another patient with this email or phone already exists', 409);
      }
    }

    const startTime = performance.now();
    
    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            appointments: true,
            medicalRecords: true,
            labResults: true,
            prescriptions: true,
          }
        }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Patient update', [id], endTime - startTime);

    // Clear cache
    await deleteCache(`patient:${id}:true`);
    await deleteCache(`patient:${id}:false`);

    // Log user activity
    logger.info('Patient updated', {
      patientId: id,
      updatedBy: req.user!.id,
      changes: Object.keys(updateData),
    });

    res.json({
      success: true,
      data: updatedPatient,
      message: 'Patient updated successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error updating patient:', error);
    throw new AppError('Failed to update patient', 500);
  }
};

export const deletePatient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { hardDelete } = req.query;

    // Check if patient exists
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            appointments: true,
            medicalRecords: true,
            labResults: true,
            prescriptions: true,
          }
        }
      }
    });

    if (!existingPatient) {
      throw new AppError('Patient not found', 404);
    }

    const startTime = performance.now();
    
    if (hardDelete === 'true') {
      // Hard delete - only for admin users
      if (req.user!.role !== 'admin' && req.user!.role !== 'super_admin') {
        throw new AppError('Insufficient permissions for hard delete', 403);
      }

      await prisma.patient.delete({
        where: { id }
      });

      logger.warn('Patient hard deleted', {
        patientId: id,
        deletedBy: req.user!.id,
        patientName: `${existingPatient.firstName} ${existingPatient.lastName}`,
      });

    } else {
      // Soft delete
      await prisma.patient.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        }
      });

      logger.info('Patient soft deleted', {
        patientId: id,
        deletedBy: req.user!.id,
        patientName: `${existingPatient.firstName} ${existingPatient.lastName}`,
      });
    }

    const endTime = performance.now();
    dbQueryLogger('Patient deletion', [id], endTime - startTime);

    // Clear cache
    await deleteCache(`patient:${id}:true`);
    await deleteCache(`patient:${id}:false`);

    res.json({
      success: true,
      message: `Patient ${hardDelete === 'true' ? 'permanently deleted' : 'deactivated'} successfully`
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error deleting patient:', error);
    throw new AppError('Failed to delete patient', 500);
  }
};

// Medical Records Management
export const getPatientMedicalRecords = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { patientId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, firstName: true, lastName: true }
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    const startTime = performance.now();
    
    const [medicalRecords, totalCount] = await Promise.all([
      prisma.medicalRecord.findMany({
        where: { patientId },
        skip: offset,
        take: limit,
        orderBy: { visitDate: 'desc' },
        include: {
          doctor: {
            select: {
              firstName: true,
              lastName: true,
              specialization: true,
              department: { select: { name: true } }
            }
          },
          department: { select: { name: true } },
          prescriptions: {
            include: {
              medications: {
                include: {
                  medication: { select: { name: true, dosage: true, form: true } }
                }
              }
            }
          },
          labResults: {
            include: {
              technician: { select: { firstName: true, lastName: true } }
            }
          }
        }
      }),
      prisma.medicalRecord.count({ where: { patientId } })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Medical records query', [patientId], endTime - startTime);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        patient,
        medicalRecords,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        }
      },
      message: 'Medical records retrieved successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching medical records:', error);
    throw new AppError('Failed to fetch medical records', 500);
  }
};

export const createMedicalRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      patientId,
      diagnosis,
      symptoms,
      treatment,
      medications,
      notes,
      visitDate,
      departmentId,
      followUpDate,
      vitalSigns,
      chiefComplaint,
    } = req.body;

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    const startTime = performance.now();
    
    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        patientId,
        doctorId: req.user!.id,
        diagnosis,
        symptoms,
        treatment,
        medications,
        notes,
        visitDate: visitDate ? new Date(visitDate) : new Date(),
        departmentId,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        vitalSigns,
        chiefComplaint,
      },
      include: {
        doctor: {
          select: {
            firstName: true,
            lastName: true,
            specialization: true,
          }
        },
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          }
        },
        department: { select: { name: true } }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Medical record creation', [medicalRecord.id], endTime - startTime);

    // Clear patient cache
    await deleteCache(`patient:${patientId}:true`);
    await deleteCache(`patient:${patientId}:false`);

    // Log user activity
    logger.info('Medical record created', {
      recordId: medicalRecord.id,
      patientId,
      doctorId: req.user!.id,
      diagnosis,
    });

    res.status(201).json({
      success: true,
      data: medicalRecord,
      message: 'Medical record created successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error creating medical record:', error);
    throw new AppError('Failed to create medical record', 500);
  }
};

// Appointment Management
export const getAppointments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const doctorId = req.query.doctorId as string;
    const patientId = req.query.patientId as string;
    const date = req.query.date as string;
    const departmentId = req.query.departmentId as string;

    // Build where clause
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (doctorId) {
      where.doctorId = doctorId;
    }
    
    if (patientId) {
      where.patientId = patientId;
    }
    
    if (departmentId) {
      where.departmentId = departmentId;
    }
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      
      where.appointmentDate = {
        gte: startDate,
        lt: endDate,
      };
    }

    // Role-based filtering
    if (req.user!.role === 'doctor') {
      where.doctorId = req.user!.id;
    } else if (req.user!.role === 'nurse') {
      // Nurses can see appointments in their department
      if (req.user!.departmentId) {
        where.departmentId = req.user!.departmentId;
      }
    }

    const startTime = performance.now();
    
    const [appointments, totalCount] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { appointmentDate: 'asc' },
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              mrn: true,
            }
          },
          doctor: {
            select: {
              firstName: true,
              lastName: true,
              specialization: true,
            }
          },
          department: { select: { name: true } }
        }
      }),
      prisma.appointment.count({ where })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Appointments query', [], endTime - startTime);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        }
      },
      message: 'Appointments retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching appointments:', error);
    throw new AppError('Failed to fetch appointments', 500);
  }
};

export const createAppointment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      patientId,
      doctorId,
      appointmentDate,
      duration,
      type,
      notes,
      departmentId,
      priority,
    } = req.body;

    // Verify patient and doctor exist
    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.user.findUnique({ where: { id: doctorId, role: 'doctor' } })
    ]);

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }

    // Check for scheduling conflicts
    const appointmentDateTime = new Date(appointmentDate);
    const appointmentEndTime = new Date(appointmentDateTime.getTime() + (duration * 60000));

    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { in: ['scheduled', 'confirmed'] },
        appointmentDate: {
          lt: appointmentEndTime,
        },
        AND: {
          appointmentDate: {
            gte: new Date(appointmentDateTime.getTime() - (duration * 60000)),
          }
        }
      }
    });

    if (conflictingAppointment) {
      throw new AppError('Doctor is not available at this time', 409);
    }

    const startTime = performance.now();
    
    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        appointmentDate: appointmentDateTime,
        duration,
        type,
        notes,
        departmentId,
        priority: priority || 'normal',
        status: 'scheduled',
        createdBy: req.user!.id,
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            mrn: true,
          }
        },
        doctor: {
          select: {
            firstName: true,
            lastName: true,
            specialization: true,
          }
        },
        department: { select: { name: true } }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Appointment creation', [appointment.id], endTime - startTime);

    // Log user activity
    logger.info('Appointment created', {
      appointmentId: appointment.id,
      patientId,
      doctorId,
      appointmentDate: appointmentDateTime,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Appointment created successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error creating appointment:', error);
    throw new AppError('Failed to create appointment', 500);
  }
};

export const updateAppointmentStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
    
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid appointment status', 400);
    }

    // Check if appointment exists
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true } }
      }
    });

    if (!existingAppointment) {
      throw new AppError('Appointment not found', 404);
    }

    // Role-based authorization
    if (req.user!.role === 'doctor' && existingAppointment.doctorId !== req.user!.id) {
      throw new AppError('You can only update your own appointments', 403);
    }

    const startTime = performance.now();
    
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        notes: notes || existingAppointment.notes,
        updatedAt: new Date(),
      },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          }
        },
        doctor: {
          select: {
            firstName: true,
            lastName: true,
            specialization: true,
          }
        }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Appointment status update', [id], endTime - startTime);

    // Log user activity
    logger.info('Appointment status updated', {
      appointmentId: id,
      oldStatus: existingAppointment.status,
      newStatus: status,
      updatedBy: req.user!.id,
    });

    res.json({
      success: true,
      data: updatedAppointment,
      message: 'Appointment status updated successfully'
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error updating appointment status:', error);
    throw new AppError('Failed to update appointment status', 500);
  }
};

// Search functionality
export const searchPatients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { query, limit = 10 } = req.query;
    
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      throw new AppError('Search query must be at least 2 characters long', 400);
    }

    const searchTerm = query.trim();
    const searchLimit = Math.min(parseInt(limit as string), 50);

    const startTime = performance.now();
    
    const patients = await prisma.patient.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { firstName: { contains: searchTerm, mode: 'insensitive' } },
              { lastName: { contains: searchTerm, mode: 'insensitive' } },
              { email: { contains: searchTerm, mode: 'insensitive' } },
              { phone: { contains: searchTerm, mode: 'insensitive' } },
              { mrn: { contains: searchTerm, mode: 'insensitive' } },
            ]
          }
        ]
      },
      take: searchLimit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        mrn: true,
        dateOfBirth: true,
        gender: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });

    const endTime = performance.now();
    dbQueryLogger('Patient search', [searchTerm], endTime - startTime);

    res.json({
      success: true,
      data: patients,
      message: `Found ${patients.length} patients matching "${searchTerm}"`
    });

  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error searching patients:', error);
    throw new AppError('Failed to search patients', 500);
  }
};

// Dashboard statistics
export const getPatientStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = performance.now();
    
    const [
      totalPatients,
      activePatients,
      newPatientsThisMonth,
      appointmentsToday,
      upcomingAppointments,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.patient.count({ where: { isActive: true } }),
      prisma.patient.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          },
          status: { in: ['scheduled', 'confirmed', 'in_progress'] }
        }
      }),
      prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: new Date(),
            lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
          },
          status: { in: ['scheduled', 'confirmed'] }
        }
      })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Patient statistics', [], endTime - startTime);

    res.json({
      success: true,
      data: {
        totalPatients,
        activePatients,
        inactivePatients: totalPatients - activePatients,
        newPatientsThisMonth,
        appointmentsToday,
        upcomingAppointments,
      },
      message: 'Patient statistics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching patient statistics:', error);
    throw new AppError('Failed to fetch patient statistics', 500);
  }
};

// Get doctor appointments
export const getDoctorAppointments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = performance.now();
    const { doctorId } = req.params;
    const { page = 1, limit = 10, status, date } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    
    const whereClause: any = {
      doctorId: Number(doctorId)
    };

    if (status) {
      whereClause.status = status;
    }

    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      whereClause.appointmentDate = {
        gte: startDate,
        lt: endDate
      };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: whereClause,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true
            }
          }
        },
        orderBy: { appointmentDate: 'asc' },
        skip,
        take: Number(limit)
      }),
      prisma.appointment.count({ where: whereClause })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Doctor appointments', [doctorId], endTime - startTime);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      },
      message: 'Doctor appointments retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching doctor appointments:', error);
    throw new AppError('Failed to fetch doctor appointments', 500);
  }
};

// Get patient appointments
export const getPatientAppointments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = performance.now();
    const { patientId } = req.params;
    const { page = 1, limit = 10, status, upcoming } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    
    const whereClause: any = {
      patientId: Number(patientId)
    };

    if (status) {
      whereClause.status = status;
    }

    if (upcoming === 'true') {
      whereClause.appointmentDate = {
        gte: new Date()
      };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: whereClause,
        include: {
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              specialization: true,
              phone: true,
              email: true
            }
          }
        },
        orderBy: { appointmentDate: 'asc' },
        skip,
        take: Number(limit)
      }),
      prisma.appointment.count({ where: whereClause })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Patient appointments', [patientId], endTime - startTime);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      },
      message: 'Patient appointments retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching patient appointments:', error);
    throw new AppError('Failed to fetch patient appointments', 500);
  }
};

// Get upcoming appointments
export const getUpcomingAppointments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = performance.now();
    const { page = 1, limit = 10, days = 7 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + Number(days));

    const whereClause = {
      appointmentDate: {
        gte: new Date(),
        lte: endDate
      },
      status: { in: ['scheduled', 'confirmed'] }
    };

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: whereClause,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              specialization: true,
              phone: true,
              email: true
            }
          }
        },
        orderBy: { appointmentDate: 'asc' },
        skip,
        take: Number(limit)
      }),
      prisma.appointment.count({ where: whereClause })
    ]);

    const endTime = performance.now();
    dbQueryLogger('Upcoming appointments', [], endTime - startTime);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      },
      message: 'Upcoming appointments retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching upcoming appointments:', error);
    throw new AppError('Failed to fetch upcoming appointments', 500);
  }
};

// Update appointment
export const updateAppointment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = performance.now();
    const { id } = req.params;
    const { appointmentDate, reason, notes, status } = req.body;

    // Check if appointment exists
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: Number(id) }
    });

    if (!existingAppointment) {
      throw new AppError('Appointment not found', 404);
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: Number(id) },
      data: {
        ...(appointmentDate && { appointmentDate: new Date(appointmentDate) }),
        ...(reason && { reason }),
        ...(notes && { notes }),
        ...(status && { status }),
        updatedAt: new Date()
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
            phone: true,
            email: true
          }
        }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Update appointment', [id], endTime - startTime);

    userActivityLogger(req.user?.id, 'UPDATE_APPOINTMENT', {
      appointmentId: id,
      changes: { appointmentDate, reason, notes, status }
    });

    res.json({
      success: true,
      data: updatedAppointment,
      message: 'Appointment updated successfully'
    });

  } catch (error) {
    logger.error('Error updating appointment:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to update appointment', 500);
  }
};

// Delete appointment
export const deleteAppointment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = performance.now();
    const { id } = req.params;

    // Check if appointment exists
    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: Number(id) }
    });

    if (!existingAppointment) {
      throw new AppError('Appointment not found', 404);
    }

    await prisma.appointment.delete({
      where: { id: Number(id) }
    });

    const endTime = performance.now();
    dbQueryLogger('Delete appointment', [id], endTime - startTime);

    userActivityLogger(req.user?.id, 'DELETE_APPOINTMENT', {
      appointmentId: id
    });

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting appointment:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to delete appointment', 500);
  }
};

// Delete medical record
export const deleteMedicalRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = performance.now();
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Medical record ID is required'
      });
      return;
    }

    // Check if medical record exists
    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { id: id }
    });

    if (!existingRecord) {
      res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
      return;
    }

    await prisma.medicalRecord.delete({
      where: { id: id }
    });

    const endTime = performance.now();
    dbQueryLogger('Delete medical record', [id], endTime - startTime);

    userActivityLogger(req.user?.id, 'DELETE_MEDICAL_RECORD', {
      recordId: id
    });

    res.json({
      success: true,
      message: 'Medical record deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting medical record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete medical record'
    });
  }
};

// Get appointment by ID
export const getAppointmentById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = performance.now();
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Appointment ID is required'
      });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            dateOfBirth: true,
            gender: true
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: true,
            phone: true,
            email: true
          }
        }
      }
    });

    if (!appointment) {
      res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
      return;
    }

    const endTime = performance.now();
    dbQueryLogger('Get appointment by ID', [id], endTime - startTime);

    res.json({
      success: true,
      data: appointment,
      message: 'Appointment retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment'
    });
  }
};

// Update medical record
export const updateMedicalRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const startTime = performance.now();
    const { id } = req.params;
    const { diagnosis, treatment, medications, notes, followUpDate } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Medical record ID is required'
      });
      return;
    }

    // Check if medical record exists
    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { id: id }
    });

    if (!existingRecord) {
      res.status(404).json({
        success: false,
        message: 'Medical record not found'
      });
      return;
    }

    const updatedRecord = await prisma.medicalRecord.update({
      where: { id: id },
      data: {
        ...(diagnosis && { diagnosis }),
        ...(treatment && { treatment }),
        ...(medications && { medications }),
        ...(notes && { notes }),
        ...(followUpDate && { followUpDate: new Date(followUpDate) }),
        updatedAt: new Date()
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true
          }
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: true
          }
        }
      }
    });

    const endTime = performance.now();
    dbQueryLogger('Update medical record', [id], endTime - startTime);

    userActivityLogger(req.user?.id, 'UPDATE_MEDICAL_RECORD', {
      recordId: id,
      changes: { diagnosis, treatment, medications, notes, followUpDate }
    });

    res.json({
      success: true,
      data: updatedRecord,
      message: 'Medical record updated successfully'
    });

  } catch (error) {
    logger.error('Error updating medical record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medical record'
    });
  }
};