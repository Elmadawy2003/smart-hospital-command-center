import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import InsuranceService from '../services/insuranceService';

const router = express.Router();
const insuranceService = new InsuranceService();

// Apply authentication to all routes
router.use(authenticateToken);

// Insurance Providers
router.get('/providers', async (req, res) => {
  try {
    const providers = await insuranceService.getProviders();
    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insurance providers'
    });
  }
});

router.get('/providers/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const provider = await insuranceService.getProvider(providerId);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Insurance provider not found'
      });
    }

    res.json({
      success: true,
      data: provider
    });
  } catch (error) {
    console.error('Error fetching provider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insurance provider'
    });
  }
});

router.post('/providers', requireRole(['admin', 'insurance_manager']), async (req, res) => {
  try {
    const provider = await insuranceService.registerProvider(req.body);
    res.status(201).json({
      success: true,
      data: provider,
      message: 'Insurance provider registered successfully'
    });
  } catch (error) {
    console.error('Error registering provider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register insurance provider'
    });
  }
});

router.put('/providers/:providerId', requireRole(['admin', 'insurance_manager']), async (req, res) => {
  try {
    const { providerId } = req.params;
    const provider = await insuranceService.updateProvider(providerId, req.body);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Insurance provider not found'
      });
    }

    res.json({
      success: true,
      data: provider,
      message: 'Insurance provider updated successfully'
    });
  } catch (error) {
    console.error('Error updating provider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update insurance provider'
    });
  }
});

// Patient Insurance
router.get('/patients/:patientId/insurances', async (req, res) => {
  try {
    const { patientId } = req.params;
    const insurances = await insuranceService.getPatientInsurances(patientId);
    
    res.json({
      success: true,
      data: insurances
    });
  } catch (error) {
    console.error('Error fetching patient insurances:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient insurances'
    });
  }
});

router.post('/patients/:patientId/insurances', requireRole(['admin', 'insurance_manager', 'receptionist']), async (req, res) => {
  try {
    const { patientId } = req.params;
    const insuranceData = { ...req.body, patientId };
    
    const insurance = await insuranceService.addPatientInsurance(insuranceData);
    res.status(201).json({
      success: true,
      data: insurance,
      message: 'Patient insurance added successfully'
    });
  } catch (error) {
    console.error('Error adding patient insurance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add patient insurance'
    });
  }
});

router.put('/insurances/:insuranceId', requireRole(['admin', 'insurance_manager', 'receptionist']), async (req, res) => {
  try {
    const { insuranceId } = req.params;
    const insurance = await insuranceService.updatePatientInsurance(insuranceId, req.body);
    
    if (!insurance) {
      return res.status(404).json({
        success: false,
        message: 'Patient insurance not found'
      });
    }

    res.json({
      success: true,
      data: insurance,
      message: 'Patient insurance updated successfully'
    });
  } catch (error) {
    console.error('Error updating patient insurance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update patient insurance'
    });
  }
});

// Eligibility Verification
router.post('/eligibility/check', async (req, res) => {
  try {
    const eligibilityRequest = await insuranceService.checkEligibility(req.body);
    res.status(201).json({
      success: true,
      data: eligibilityRequest,
      message: 'Eligibility check initiated'
    });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check eligibility'
    });
  }
});

router.get('/eligibility/:requestId/response', async (req, res) => {
  try {
    const { requestId } = req.params;
    const response = await insuranceService.getEligibilityResponse(requestId);
    
    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Eligibility response not found or still processing'
      });
    }

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error fetching eligibility response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch eligibility response'
    });
  }
});

// Prior Authorization
router.post('/authorization/request', async (req, res) => {
  try {
    const authRequest = await insuranceService.submitAuthorizationRequest(req.body);
    res.status(201).json({
      success: true,
      data: authRequest,
      message: 'Authorization request submitted'
    });
  } catch (error) {
    console.error('Error submitting authorization request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit authorization request'
    });
  }
});

router.get('/authorization/:requestId/response', async (req, res) => {
  try {
    const { requestId } = req.params;
    const response = await insuranceService.getAuthorizationResponse(requestId);
    
    if (!response) {
      return res.status(404).json({
        success: false,
        message: 'Authorization response not found or still processing'
      });
    }

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error fetching authorization response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch authorization response'
    });
  }
});

// Claims Management
router.get('/claims', async (req, res) => {
  try {
    const { patientId, providerId, status, dateFrom, dateTo } = req.query;
    
    const filters: any = {};
    if (patientId) filters.patientId = patientId as string;
    if (providerId) filters.providerId = providerId as string;
    if (status) filters.status = status as string;
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const claims = await insuranceService.getClaims(Object.keys(filters).length > 0 ? filters : undefined);
    
    res.json({
      success: true,
      data: claims
    });
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    });
  }
});

router.get('/claims/:claimId', async (req, res) => {
  try {
    const { claimId } = req.params;
    const claim = await insuranceService.getClaim(claimId);
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    res.json({
      success: true,
      data: claim
    });
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim'
    });
  }
});

router.post('/claims', requireRole(['admin', 'insurance_manager', 'billing_staff']), async (req, res) => {
  try {
    const claim = await insuranceService.submitClaim(req.body);
    res.status(201).json({
      success: true,
      data: claim,
      message: 'Claim submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit claim'
    });
  }
});

router.put('/claims/:claimId/status', requireRole(['admin', 'insurance_manager']), async (req, res) => {
  try {
    const { claimId } = req.params;
    const { status, notes } = req.body;
    
    const claim = await insuranceService.updateClaimStatus(claimId, status, notes);
    
    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      });
    }

    res.json({
      success: true,
      data: claim,
      message: 'Claim status updated successfully'
    });
  } catch (error) {
    console.error('Error updating claim status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update claim status'
    });
  }
});

// Payment Processing
router.get('/payments', async (req, res) => {
  try {
    const { claimId } = req.query;
    const payments = await insuranceService.getPayments(claimId as string);
    
    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
});

router.post('/payments', requireRole(['admin', 'insurance_manager', 'billing_staff']), async (req, res) => {
  try {
    const payment = await insuranceService.processPayment(req.body);
    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment processed successfully'
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment'
    });
  }
});

// Processing Rules
router.get('/processing-rules', requireRole(['admin', 'insurance_manager']), async (req, res) => {
  try {
    const rules = await insuranceService.getProcessingRules();
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error fetching processing rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch processing rules'
    });
  }
});

router.post('/processing-rules', requireRole(['admin', 'insurance_manager']), async (req, res) => {
  try {
    const rule = await insuranceService.addProcessingRule(req.body);
    res.status(201).json({
      success: true,
      data: rule,
      message: 'Processing rule added successfully'
    });
  } catch (error) {
    console.error('Error adding processing rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add processing rule'
    });
  }
});

router.put('/processing-rules/:ruleId', requireRole(['admin', 'insurance_manager']), async (req, res) => {
  try {
    const { ruleId } = req.params;
    const rule = await insuranceService.updateProcessingRule(ruleId, req.body);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Processing rule not found'
      });
    }

    res.json({
      success: true,
      data: rule,
      message: 'Processing rule updated successfully'
    });
  } catch (error) {
    console.error('Error updating processing rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update processing rule'
    });
  }
});

router.delete('/processing-rules/:ruleId', requireRole(['admin', 'insurance_manager']), async (req, res) => {
  try {
    const { ruleId } = req.params;
    const deleted = await insuranceService.deleteProcessingRule(ruleId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Processing rule not found'
      });
    }

    res.json({
      success: true,
      message: 'Processing rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting processing rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete processing rule'
    });
  }
});

// Statistics and Reporting
router.get('/statistics', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const filters: any = {};
    if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
    if (dateTo) filters.dateTo = new Date(dateTo as string);

    const statistics = await insuranceService.getStatistics(filters.dateFrom, filters.dateTo);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Bulk Operations
router.post('/claims/bulk-submit', requireRole(['admin', 'insurance_manager']), async (req, res) => {
  try {
    const { claims } = req.body;
    
    if (!Array.isArray(claims)) {
      return res.status(400).json({
        success: false,
        message: 'Claims must be an array'
      });
    }

    const results = [];
    for (const claimData of claims) {
      try {
        const claim = await insuranceService.submitClaim(claimData);
        results.push({ success: true, claim });
      } catch (error) {
        results.push({ success: false, error: error.message, claimData });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Processed ${results.length} claims`
    });
  } catch (error) {
    console.error('Error bulk submitting claims:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk submit claims'
    });
  }
});

router.post('/eligibility/bulk-check', requireRole(['admin', 'insurance_manager']), async (req, res) => {
  try {
    const { requests } = req.body;
    
    if (!Array.isArray(requests)) {
      return res.status(400).json({
        success: false,
        message: 'Requests must be an array'
      });
    }

    const results = [];
    for (const requestData of requests) {
      try {
        const request = await insuranceService.checkEligibility(requestData);
        results.push({ success: true, request });
      } catch (error) {
        results.push({ success: false, error: error.message, requestData });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Processed ${results.length} eligibility checks`
    });
  } catch (error) {
    console.error('Error bulk checking eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk check eligibility'
    });
  }
});

// Health Check
router.get('/health', async (req, res) => {
  try {
    const providers = await insuranceService.getProviders();
    const activeProviders = providers.filter(p => p.status === 'active');
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        totalProviders: providers.length,
        activeProviders: activeProviders.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({
      success: false,
      message: 'Insurance service health check failed'
    });
  }
});

export default router;