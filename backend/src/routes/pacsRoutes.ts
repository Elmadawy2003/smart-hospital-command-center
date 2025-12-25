import express from 'express';
import multer from 'multer';
import PACSService, { PACSQuery, WorklistItem, AnnotationTool, MeasurementTool } from '../services/pacsService';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();
const pacsService = new PACSService();

// Configure multer for DICOM file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    // Accept DICOM files and common medical image formats
    const allowedTypes = [
      'application/dicom',
      'application/octet-stream',
      'image/dicom',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.dcm')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only DICOM files are allowed.'));
    }
  }
});

// Apply authentication to all routes
router.use(authenticateToken);

// Study Management Routes

// Query studies
router.get('/studies', async (req, res) => {
  try {
    const query: PACSQuery = {
      patientID: req.query.patientID as string,
      patientName: req.query.patientName as string,
      studyDate: req.query.studyDate as string,
      studyDateRange: req.query.fromDate && req.query.toDate ? {
        from: req.query.fromDate as string,
        to: req.query.toDate as string
      } : undefined,
      modality: req.query.modality as string,
      accessionNumber: req.query.accessionNumber as string,
      studyInstanceUID: req.query.studyInstanceUID as string,
      referringPhysician: req.query.referringPhysician as string,
      studyDescription: req.query.studyDescription as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };

    const studies = await pacsService.queryStudies(query);
    res.json({
      success: true,
      data: studies,
      total: studies.length
    });
  } catch (error) {
    console.error('Error querying studies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to query studies',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get study details
router.get('/studies/:studyInstanceUID', async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const study = await pacsService.getStudyDetails(studyInstanceUID);
    
    if (!study) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    res.json({
      success: true,
      data: study
    });
  } catch (error) {
    console.error('Error getting study details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get study details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get study series
router.get('/studies/:studyInstanceUID/series', async (req, res) => {
  try {
    const { studyInstanceUID } = req.params;
    const series = await pacsService.getStudySeries(studyInstanceUID);
    
    res.json({
      success: true,
      data: series
    });
  } catch (error) {
    console.error('Error getting study series:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get study series',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get series images
router.get('/series/:seriesInstanceUID/images', async (req, res) => {
  try {
    const { seriesInstanceUID } = req.params;
    const images = await pacsService.getSeriesImages(seriesInstanceUID);
    
    res.json({
      success: true,
      data: images
    });
  } catch (error) {
    console.error('Error getting series images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get series images',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get image data
router.get('/images/:sopInstanceUID/data', async (req, res) => {
  try {
    const { sopInstanceUID } = req.params;
    const imageData = await pacsService.getImageData(sopInstanceUID);
    
    if (!imageData) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    res.set({
      'Content-Type': 'application/dicom',
      'Content-Disposition': `attachment; filename="${sopInstanceUID}.dcm"`
    });
    res.send(imageData);
  } catch (error) {
    console.error('Error getting image data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get image data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload DICOM files
router.post('/upload', requireRole(['doctor', 'technician', 'admin']), upload.array('dicomFiles', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadResults = [];
    
    for (const file of files) {
      try {
        // Parse DICOM tags (simplified - in real implementation, use proper DICOM library)
        const tags = pacsService.parseDICOMTags(file.buffer);
        const metadata = pacsService.generateDICOMMetadata(tags);
        
        // Generate UIDs if not present
        const studyUID = metadata.studyInstanceUID || `1.2.840.113619.2.176.${Date.now()}.${Math.random()}`;
        const seriesUID = metadata.seriesInstanceUID || `${studyUID}.1`;
        const sopUID = metadata.sopInstanceUID || `${seriesUID}.${Date.now()}`;
        
        const fullMetadata = {
          studyInstanceUID: studyUID,
          seriesInstanceUID: seriesUID,
          sopInstanceUID: sopUID,
          patientID: metadata.patientID || 'UNKNOWN',
          patientName: metadata.patientName || 'Unknown Patient',
          studyDate: metadata.studyDate || new Date().toISOString().split('T')[0].replace(/-/g, ''),
          studyTime: metadata.studyTime || new Date().toTimeString().split(' ')[0].replace(/:/g, ''),
          modality: metadata.modality || 'OT',
          bodyPart: metadata.bodyPart || 'UNKNOWN',
          studyDescription: metadata.studyDescription || 'Unknown Study',
          seriesDescription: metadata.seriesDescription || 'Unknown Series',
          institutionName: 'Hospital ERP',
          referringPhysician: 'Dr. Unknown',
          performingPhysician: 'Dr. Unknown',
          imageType: 'ORIGINAL\\PRIMARY',
          rows: 512,
          columns: 512,
          pixelSpacing: [1.0, 1.0],
          tags
        };
        
        const result = await pacsService.storeStudy(fullMetadata, file.buffer);
        uploadResults.push({
          filename: file.originalname,
          sopInstanceUID: result,
          status: 'success'
        });
      } catch (fileError) {
        uploadResults.push({
          filename: file.originalname,
          status: 'error',
          error: fileError instanceof Error ? fileError.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      message: 'Files processed',
      results: uploadResults
    });
  } catch (error) {
    console.error('Error uploading DICOM files:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload DICOM files',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Worklist Management Routes

// Get worklist
router.get('/worklist', async (req, res) => {
  try {
    const modality = req.query.modality as string;
    const date = req.query.date as string;
    
    const worklist = await pacsService.getWorklist(modality, date);
    
    res.json({
      success: true,
      data: worklist
    });
  } catch (error) {
    console.error('Error getting worklist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get worklist',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add worklist item
router.post('/worklist', requireRole(['doctor', 'admin']), async (req, res) => {
  try {
    const worklistItem: Omit<WorklistItem, 'studyInstanceUID'> = req.body;
    
    const studyUID = await pacsService.addWorklistItem(worklistItem);
    
    res.status(201).json({
      success: true,
      message: 'Worklist item added successfully',
      studyInstanceUID: studyUID
    });
  } catch (error) {
    console.error('Error adding worklist item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add worklist item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update worklist status
router.patch('/worklist/:accessionNumber/status', requireRole(['doctor', 'technician', 'admin']), async (req, res) => {
  try {
    const { accessionNumber } = req.params;
    const { status } = req.body;
    
    const success = await pacsService.updateWorklistStatus(accessionNumber, status);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Worklist item not found'
      });
    }

    res.json({
      success: true,
      message: 'Worklist status updated successfully'
    });
  } catch (error) {
    console.error('Error updating worklist status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update worklist status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Viewer Session Management Routes

// Create viewer session
router.post('/viewer/sessions', async (req, res) => {
  try {
    const { studyInstanceUID, seriesInstanceUIDs } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const sessionId = await pacsService.createViewerSession(userId, studyInstanceUID, seriesInstanceUIDs);
    
    res.status(201).json({
      success: true,
      sessionId
    });
  } catch (error) {
    console.error('Error creating viewer session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create viewer session',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get viewer session
router.get('/viewer/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await pacsService.getViewerSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Viewer session not found'
      });
    }

    // Check if user owns the session
    if (session.userId !== req.user?.id && !req.user?.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error getting viewer session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get viewer session',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update viewer session
router.patch('/viewer/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;
    
    const session = await pacsService.getViewerSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Viewer session not found'
      });
    }

    // Check if user owns the session
    if (session.userId !== req.user?.id && !req.user?.roles.includes('admin')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const success = await pacsService.updateViewerSession(sessionId, updates);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update viewer session'
      });
    }

    res.json({
      success: true,
      message: 'Viewer session updated successfully'
    });
  } catch (error) {
    console.error('Error updating viewer session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update viewer session',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add annotation
router.post('/viewer/sessions/:sessionId/annotations', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const annotation: AnnotationTool = {
      ...req.body,
      id: `ann_${Date.now()}_${Math.random()}`,
      createdBy: req.user?.id || 'unknown',
      createdAt: new Date()
    };
    
    const success = await pacsService.addAnnotation(sessionId, annotation);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Viewer session not found'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Annotation added successfully',
      annotationId: annotation.id
    });
  } catch (error) {
    console.error('Error adding annotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add annotation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add measurement
router.post('/viewer/sessions/:sessionId/measurements', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const measurement: MeasurementTool = {
      ...req.body,
      id: `meas_${Date.now()}_${Math.random()}`,
      createdBy: req.user?.id || 'unknown',
      createdAt: new Date()
    };
    
    const success = await pacsService.addMeasurement(sessionId, measurement);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Viewer session not found'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Measurement added successfully',
      measurementId: measurement.id
    });
  } catch (error) {
    console.error('Error adding measurement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add measurement',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Statistics and Analytics Routes

// Get PACS statistics
router.get('/statistics', requireRole(['admin', 'manager']), async (req, res) => {
  try {
    const statistics = await pacsService.getPACSStatistics();
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting PACS statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get PACS statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'PACS service is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;