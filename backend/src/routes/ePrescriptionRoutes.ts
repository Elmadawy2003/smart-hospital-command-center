import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import EPrescriptionService from '../services/ePrescriptionService';

const router = express.Router();
const ePrescriptionService = new EPrescriptionService();

// Apply authentication to all routes
router.use(authenticateToken);

// Drug Management Routes
router.get('/drugs/search', async (req, res) => {
  try {
    const { query, limit } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }

    const limitNum = limit ? parseInt(limit as string) : 20;
    const drugs = await ePrescriptionService.searchDrugs(query, limitNum);

    res.json({
      success: true,
      data: drugs,
      count: drugs.length
    });
  } catch (error) {
    console.error('Error searching drugs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search drugs' 
    });
  }
});

router.get('/drugs/:drugId', async (req, res) => {
  try {
    const { drugId } = req.params;
    const drug = await ePrescriptionService.getDrugById(drugId);

    if (!drug) {
      return res.status(404).json({ 
        success: false, 
        message: 'Drug not found' 
      });
    }

    res.json({
      success: true,
      data: drug
    });
  } catch (error) {
    console.error('Error getting drug:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get drug information' 
    });
  }
});

router.get('/drugs/:drugId/interactions', async (req, res) => {
  try {
    const { drugId } = req.params;
    const interactions = await ePrescriptionService.getDrugInteractions(drugId);

    res.json({
      success: true,
      data: interactions,
      count: interactions.length
    });
  } catch (error) {
    console.error('Error getting drug interactions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get drug interactions' 
    });
  }
});

// Prescription Management Routes
router.post('/prescriptions', requireRole(['doctor', 'nurse_practitioner', 'physician_assistant']), async (req, res) => {
  try {
    const prescriptionData = req.body;
    
    // Validate required fields
    const requiredFields = ['patientId', 'patientName', 'doctorId', 'doctorName', 'facilityId', 'facilityName', 'medications', 'diagnosis'];
    const missingFields = requiredFields.filter(field => !prescriptionData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate medications
    if (!Array.isArray(prescriptionData.medications) || prescriptionData.medications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one medication is required'
      });
    }

    // Set default values
    prescriptionData.prescriptionDate = new Date();
    prescriptionData.status = 'draft';
    prescriptionData.validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    prescriptionData.refillsRemaining = prescriptionData.totalRefills || 0;
    prescriptionData.electronicSignature = `${prescriptionData.doctorName} - Digital Signature`;
    prescriptionData.allergies = prescriptionData.allergies || [];
    prescriptionData.interactionChecks = [];
    prescriptionData.allergyChecks = [];
    prescriptionData.contraindications = [];

    const prescriptionId = await ePrescriptionService.createPrescription(prescriptionData);

    res.status(201).json({
      success: true,
      data: { prescriptionId },
      message: 'Prescription created successfully'
    });
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create prescription' 
    });
  }
});

router.get('/prescriptions/:prescriptionId', async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const prescription = await ePrescriptionService.getPrescription(prescriptionId);

    if (!prescription) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prescription not found' 
      });
    }

    res.json({
      success: true,
      data: prescription
    });
  } catch (error) {
    console.error('Error getting prescription:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get prescription' 
    });
  }
});

router.put('/prescriptions/:prescriptionId', requireRole(['doctor', 'nurse_practitioner', 'physician_assistant']), async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const updates = req.body;

    const success = await ePrescriptionService.updatePrescription(prescriptionId, updates);

    if (!success) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prescription not found' 
      });
    }

    res.json({
      success: true,
      message: 'Prescription updated successfully'
    });
  } catch (error) {
    console.error('Error updating prescription:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update prescription' 
    });
  }
});

router.delete('/prescriptions/:prescriptionId', requireRole(['doctor', 'nurse_practitioner', 'physician_assistant']), async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { reason } = req.body;
    const cancelledBy = req.user?.id || 'unknown';

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    const success = await ePrescriptionService.cancelPrescription(prescriptionId, cancelledBy, reason);

    if (!success) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prescription not found' 
      });
    }

    res.json({
      success: true,
      message: 'Prescription cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling prescription:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel prescription' 
    });
  }
});

// Safety Check Routes
router.post('/prescriptions/check-interactions', async (req, res) => {
  try {
    const { medications } = req.body;

    if (!Array.isArray(medications)) {
      return res.status(400).json({
        success: false,
        message: 'Medications array is required'
      });
    }

    const interactions = await ePrescriptionService.checkDrugInteractions(medications);

    res.json({
      success: true,
      data: interactions,
      count: interactions.length,
      hasInteractions: interactions.length > 0
    });
  } catch (error) {
    console.error('Error checking drug interactions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check drug interactions' 
    });
  }
});

router.post('/prescriptions/check-allergies', async (req, res) => {
  try {
    const { medications, allergies } = req.body;

    if (!Array.isArray(medications) || !Array.isArray(allergies)) {
      return res.status(400).json({
        success: false,
        message: 'Medications and allergies arrays are required'
      });
    }

    const allergyChecks = await ePrescriptionService.checkAllergies(medications, allergies);

    res.json({
      success: true,
      data: allergyChecks,
      count: allergyChecks.length,
      hasAllergies: allergyChecks.length > 0
    });
  } catch (error) {
    console.error('Error checking allergies:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check allergies' 
    });
  }
});

router.post('/prescriptions/check-contraindications', async (req, res) => {
  try {
    const { medications, diagnoses } = req.body;

    if (!Array.isArray(medications) || !Array.isArray(diagnoses)) {
      return res.status(400).json({
        success: false,
        message: 'Medications and diagnoses arrays are required'
      });
    }

    const contraindications = await ePrescriptionService.checkContraindications(medications, diagnoses);

    res.json({
      success: true,
      data: contraindications,
      count: contraindications.length,
      hasContraindications: contraindications.length > 0
    });
  } catch (error) {
    console.error('Error checking contraindications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check contraindications' 
    });
  }
});

// Override and Acknowledge Routes
router.post('/prescriptions/:prescriptionId/interactions/:interactionId/override', requireRole(['doctor', 'nurse_practitioner']), async (req, res) => {
  try {
    const { prescriptionId, interactionId } = req.params;
    const { reason } = req.body;
    const overriddenBy = req.user?.id || 'unknown';

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Override reason is required'
      });
    }

    const success = await ePrescriptionService.overrideInteraction(prescriptionId, interactionId, reason, overriddenBy);

    if (!success) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prescription or interaction not found' 
      });
    }

    res.json({
      success: true,
      message: 'Interaction overridden successfully'
    });
  } catch (error) {
    console.error('Error overriding interaction:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to override interaction' 
    });
  }
});

router.post('/prescriptions/:prescriptionId/interactions/:interactionId/acknowledge', async (req, res) => {
  try {
    const { prescriptionId, interactionId } = req.params;
    const acknowledgedBy = req.user?.id || 'unknown';

    const success = await ePrescriptionService.acknowledgeInteraction(prescriptionId, interactionId, acknowledgedBy);

    if (!success) {
      return res.status(404).json({ 
        success: false, 
        message: 'Prescription or interaction not found' 
      });
    }

    res.json({
      success: true,
      message: 'Interaction acknowledged successfully'
    });
  } catch (error) {
    console.error('Error acknowledging interaction:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to acknowledge interaction' 
    });
  }
});

// Template Management Routes
router.get('/templates', async (req, res) => {
  try {
    const { specialty } = req.query;
    const templates = await ePrescriptionService.getTemplates(specialty as string);

    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get templates' 
    });
  }
});

router.post('/templates', requireRole(['doctor', 'nurse_practitioner', 'physician_assistant']), async (req, res) => {
  try {
    const templateData = req.body;
    
    // Validate required fields
    const requiredFields = ['name', 'description', 'specialty', 'condition', 'medications'];
    const missingFields = requiredFields.filter(field => !templateData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    templateData.createdBy = req.user?.id || 'unknown';
    templateData.isPublic = templateData.isPublic || false;

    const templateId = await ePrescriptionService.createTemplate(templateData);

    res.status(201).json({
      success: true,
      data: { templateId },
      message: 'Template created successfully'
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create template' 
    });
  }
});

router.post('/templates/:templateId/use', async (req, res) => {
  try {
    const { templateId } = req.params;
    const template = await ePrescriptionService.useTemplate(templateId);

    if (!template) {
      return res.status(404).json({ 
        success: false, 
        message: 'Template not found' 
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error using template:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to use template' 
    });
  }
});

// Pharmacy Management Routes
router.get('/pharmacies', async (req, res) => {
  try {
    const pharmacies = await ePrescriptionService.getPharmacies();

    res.json({
      success: true,
      data: pharmacies,
      count: pharmacies.length
    });
  } catch (error) {
    console.error('Error getting pharmacies:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get pharmacies' 
    });
  }
});

router.get('/pharmacies/:pharmacyId', async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const pharmacy = await ePrescriptionService.getPharmacyById(pharmacyId);

    if (!pharmacy) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pharmacy not found' 
      });
    }

    res.json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    console.error('Error getting pharmacy:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get pharmacy information' 
    });
  }
});

// History Routes
router.get('/prescriptions/:prescriptionId/history', async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const history = await ePrescriptionService.getPrescriptionHistory(prescriptionId);

    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error getting prescription history:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get prescription history' 
    });
  }
});

router.get('/patients/:patientId/prescriptions', async (req, res) => {
  try {
    const { patientId } = req.params;
    const prescriptions = await ePrescriptionService.getPatientPrescriptions(patientId);

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error getting patient prescriptions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get patient prescriptions' 
    });
  }
});

router.get('/doctors/:doctorId/prescriptions', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;

    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate) {
      start = new Date(startDate as string);
      if (isNaN(start.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid start date format'
        });
      }
    }

    if (endDate) {
      end = new Date(endDate as string);
      if (isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid end date format'
        });
      }
    }

    const prescriptions = await ePrescriptionService.getDoctorPrescriptions(doctorId, start, end);

    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length
    });
  } catch (error) {
    console.error('Error getting doctor prescriptions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get doctor prescriptions' 
    });
  }
});

// Statistics Routes
router.get('/statistics', requireRole(['admin', 'manager', 'doctor']), async (req, res) => {
  try {
    const statistics = await ePrescriptionService.getPrescriptionStatistics();

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting prescription statistics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get prescription statistics' 
    });
  }
});

// Health Check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'E-Prescription service is running',
    timestamp: new Date().toISOString()
  });
});

export default router;