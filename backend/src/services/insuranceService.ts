import { v4 as uuidv4 } from 'uuid';

// Insurance Provider Information
export interface InsuranceProvider {
  id: string;
  name: string;
  code: string;
  type: string; // 'government' | 'private' | 'international'
  country: string;
  contactInfo: {
    phone: string;
    email: string;
    website: string;
    address: string;
  };
  apiEndpoint?: string;
  apiKey?: string;
  supportedServices: string[];
  claimSubmissionMethod: string; // 'api' | 'edi' | 'manual'
  eligibilityCheckSupported: boolean;
  preAuthRequired: boolean;
  averageProcessingTime: number; // in days
  status: string; // 'active' | 'inactive' | 'suspended'
}

// Patient Insurance Information
export interface PatientInsurance {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  policyNumber: string;
  groupNumber?: string;
  memberNumber: string;
  planType: string;
  planName: string;
  effectiveDate: Date;
  expirationDate: Date;
  copayAmount?: number;
  deductibleAmount?: number;
  coinsurancePercentage?: number;
  maxBenefit?: number;
  usedBenefit?: number;
  remainingBenefit?: number;
  isPrimary: boolean;
  status: string; // 'active' | 'inactive' | 'expired'
  verificationDate?: Date;
  verificationStatus?: string;
}

// Eligibility Check
export interface EligibilityRequest {
  id: string;
  patientId: string;
  providerId: string;
  serviceType: string;
  serviceDate: Date;
  requestDate: Date;
  requestedBy: string;
  status: string; // 'pending' | 'verified' | 'denied' | 'error'
}

export interface EligibilityResponse {
  id: string;
  requestId: string;
  isEligible: boolean;
  coverageDetails: {
    serviceType: string;
    covered: boolean;
    copayAmount?: number;
    deductibleAmount?: number;
    coinsurancePercentage?: number;
    maxBenefit?: number;
    remainingBenefit?: number;
    authorizationRequired: boolean;
    networkStatus: string; // 'in-network' | 'out-of-network'
  }[];
  limitations: string[];
  exclusions: string[];
  responseDate: Date;
  validUntil: Date;
  referenceNumber: string;
}

// Prior Authorization
export interface AuthorizationRequest {
  id: string;
  patientId: string;
  providerId: string;
  serviceType: string;
  serviceCode: string;
  serviceDescription: string;
  requestedDate: Date;
  urgency: string; // 'routine' | 'urgent' | 'emergency'
  clinicalInfo: {
    diagnosis: string[];
    symptoms: string[];
    treatmentHistory: string[];
    justification: string;
  };
  requestedBy: string;
  status: string; // 'pending' | 'approved' | 'denied' | 'partial'
  submissionDate: Date;
}

export interface AuthorizationResponse {
  id: string;
  requestId: string;
  authorizationNumber?: string;
  status: string;
  approvedServices: string[];
  deniedServices: string[];
  partiallyApprovedServices: string[];
  validFrom: Date;
  validUntil: Date;
  maxUnits?: number;
  usedUnits?: number;
  conditions: string[];
  reviewDate?: Date;
  responseDate: Date;
  reviewerNotes?: string;
}

// Insurance Claim
export interface InsuranceClaim {
  id: string;
  claimNumber: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  facilityId: string;
  facilityName: string;
  serviceDate: Date;
  submissionDate: Date;
  claimType: string; // 'medical' | 'pharmacy' | 'dental' | 'vision'
  services: ClaimService[];
  totalAmount: number;
  approvedAmount?: number;
  paidAmount?: number;
  patientResponsibility?: number;
  status: string; // 'submitted' | 'pending' | 'approved' | 'denied' | 'paid' | 'rejected'
  authorizationNumber?: string;
  referenceNumber?: string;
  processingNotes?: string;
  denialReason?: string;
  appealDeadline?: Date;
  paymentDate?: Date;
  checkNumber?: string;
}

export interface ClaimService {
  id: string;
  serviceCode: string;
  serviceDescription: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  approvedAmount?: number;
  deniedAmount?: number;
  denialReason?: string;
  modifiers?: string[];
  diagnosisCodes: string[];
  placeOfService: string;
  serviceDate: Date;
}

// Claim Processing Rules
export interface ClaimProcessingRule {
  id: string;
  name: string;
  description: string;
  ruleType: string; // 'validation' | 'pricing' | 'authorization' | 'fraud'
  conditions: {
    field: string;
    operator: string;
    value: any;
  }[];
  actions: {
    type: string; // 'approve' | 'deny' | 'flag' | 'adjust'
    value?: any;
    message?: string;
  }[];
  priority: number;
  isActive: boolean;
  providerId?: string;
  serviceTypes?: string[];
}

// Payment Information
export interface PaymentInfo {
  id: string;
  claimId: string;
  paymentMethod: string; // 'eft' | 'check' | 'wire'
  paymentAmount: number;
  paymentDate: Date;
  checkNumber?: string;
  transactionId?: string;
  remittanceAdvice: string;
  adjustments: PaymentAdjustment[];
}

export interface PaymentAdjustment {
  id: string;
  type: string; // 'deductible' | 'copay' | 'coinsurance' | 'discount'
  amount: number;
  reason: string;
  code?: string;
}

// Insurance Statistics
export interface InsuranceStatistics {
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  deniedClaims: number;
  totalClaimAmount: number;
  approvedAmount: number;
  paidAmount: number;
  averageProcessingTime: number;
  denialRate: number;
  topProviders: Array<{ providerId: string; providerName: string; claimCount: number }>;
  topServices: Array<{ serviceCode: string; serviceDescription: string; claimCount: number }>;
  monthlyTrends: Array<{ month: string; claimCount: number; amount: number }>;
  eligibilityChecks: number;
  authorizationRequests: number;
  authorizationApprovalRate: number;
}

export class InsuranceService {
  private providers: Map<string, InsuranceProvider> = new Map();
  private patientInsurances: Map<string, PatientInsurance[]> = new Map();
  private eligibilityRequests: Map<string, EligibilityRequest> = new Map();
  private eligibilityResponses: Map<string, EligibilityResponse> = new Map();
  private authorizationRequests: Map<string, AuthorizationRequest> = new Map();
  private authorizationResponses: Map<string, AuthorizationResponse> = new Map();
  private claims: Map<string, InsuranceClaim> = new Map();
  private processingRules: Map<string, ClaimProcessingRule> = new Map();
  private payments: Map<string, PaymentInfo> = new Map();

  constructor() {
    this.initializeDefaultProviders();
    this.initializeDefaultRules();
  }

  // Provider Management
  async registerProvider(provider: Omit<InsuranceProvider, 'id'>): Promise<InsuranceProvider> {
    const newProvider: InsuranceProvider = {
      id: uuidv4(),
      ...provider
    };

    this.providers.set(newProvider.id, newProvider);
    return newProvider;
  }

  async getProviders(): Promise<InsuranceProvider[]> {
    return Array.from(this.providers.values());
  }

  async getProvider(providerId: string): Promise<InsuranceProvider | null> {
    return this.providers.get(providerId) || null;
  }

  async updateProvider(providerId: string, updates: Partial<InsuranceProvider>): Promise<InsuranceProvider | null> {
    const provider = this.providers.get(providerId);
    if (!provider) return null;

    const updatedProvider = { ...provider, ...updates };
    this.providers.set(providerId, updatedProvider);
    return updatedProvider;
  }

  // Patient Insurance Management
  async addPatientInsurance(insurance: Omit<PatientInsurance, 'id'>): Promise<PatientInsurance> {
    const newInsurance: PatientInsurance = {
      id: uuidv4(),
      ...insurance
    };

    const patientInsurances = this.patientInsurances.get(insurance.patientId) || [];
    
    // If this is primary insurance, make others secondary
    if (newInsurance.isPrimary) {
      patientInsurances.forEach(ins => ins.isPrimary = false);
    }

    patientInsurances.push(newInsurance);
    this.patientInsurances.set(insurance.patientId, patientInsurances);

    return newInsurance;
  }

  async getPatientInsurances(patientId: string): Promise<PatientInsurance[]> {
    return this.patientInsurances.get(patientId) || [];
  }

  async updatePatientInsurance(insuranceId: string, updates: Partial<PatientInsurance>): Promise<PatientInsurance | null> {
    for (const [patientId, insurances] of this.patientInsurances.entries()) {
      const index = insurances.findIndex(ins => ins.id === insuranceId);
      if (index !== -1) {
        const updatedInsurance = { ...insurances[index], ...updates };
        insurances[index] = updatedInsurance;
        this.patientInsurances.set(patientId, insurances);
        return updatedInsurance;
      }
    }
    return null;
  }

  // Eligibility Verification
  async checkEligibility(request: Omit<EligibilityRequest, 'id' | 'requestDate' | 'status'>): Promise<EligibilityRequest> {
    const eligibilityRequest: EligibilityRequest = {
      id: uuidv4(),
      requestDate: new Date(),
      status: 'pending',
      ...request
    };

    this.eligibilityRequests.set(eligibilityRequest.id, eligibilityRequest);

    // Simulate API call to insurance provider
    setTimeout(() => {
      this.processEligibilityCheck(eligibilityRequest.id);
    }, 1000);

    return eligibilityRequest;
  }

  private async processEligibilityCheck(requestId: string): Promise<void> {
    const request = this.eligibilityRequests.get(requestId);
    if (!request) return;

    const patientInsurances = await this.getPatientInsurances(request.patientId);
    const primaryInsurance = patientInsurances.find(ins => ins.isPrimary && ins.providerId === request.providerId);

    if (!primaryInsurance) {
      request.status = 'denied';
      return;
    }

    // Simulate eligibility response
    const response: EligibilityResponse = {
      id: uuidv4(),
      requestId: requestId,
      isEligible: true,
      coverageDetails: [{
        serviceType: request.serviceType,
        covered: true,
        copayAmount: primaryInsurance.copayAmount,
        deductibleAmount: primaryInsurance.deductibleAmount,
        coinsurancePercentage: primaryInsurance.coinsurancePercentage,
        maxBenefit: primaryInsurance.maxBenefit,
        remainingBenefit: primaryInsurance.remainingBenefit,
        authorizationRequired: false,
        networkStatus: 'in-network'
      }],
      limitations: [],
      exclusions: [],
      responseDate: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      referenceNumber: `ELG-${Date.now()}`
    };

    this.eligibilityResponses.set(response.id, response);
    request.status = 'verified';
  }

  async getEligibilityResponse(requestId: string): Promise<EligibilityResponse | null> {
    for (const response of this.eligibilityResponses.values()) {
      if (response.requestId === requestId) {
        return response;
      }
    }
    return null;
  }

  // Prior Authorization
  async submitAuthorizationRequest(request: Omit<AuthorizationRequest, 'id' | 'submissionDate' | 'status'>): Promise<AuthorizationRequest> {
    const authRequest: AuthorizationRequest = {
      id: uuidv4(),
      submissionDate: new Date(),
      status: 'pending',
      ...request
    };

    this.authorizationRequests.set(authRequest.id, authRequest);

    // Simulate processing
    setTimeout(() => {
      this.processAuthorizationRequest(authRequest.id);
    }, 2000);

    return authRequest;
  }

  private async processAuthorizationRequest(requestId: string): Promise<void> {
    const request = this.authorizationRequests.get(requestId);
    if (!request) return;

    // Simulate authorization response
    const response: AuthorizationResponse = {
      id: uuidv4(),
      requestId: requestId,
      authorizationNumber: `AUTH-${Date.now()}`,
      status: 'approved',
      approvedServices: [request.serviceCode],
      deniedServices: [],
      partiallyApprovedServices: [],
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      maxUnits: 10,
      usedUnits: 0,
      conditions: ['Must be performed by in-network provider'],
      responseDate: new Date(),
      reviewerNotes: 'Approved based on medical necessity'
    };

    this.authorizationResponses.set(response.id, response);
    request.status = 'approved';
  }

  async getAuthorizationResponse(requestId: string): Promise<AuthorizationResponse | null> {
    for (const response of this.authorizationResponses.values()) {
      if (response.requestId === requestId) {
        return response;
      }
    }
    return null;
  }

  // Claims Management
  async submitClaim(claim: Omit<InsuranceClaim, 'id' | 'claimNumber' | 'submissionDate' | 'status'>): Promise<InsuranceClaim> {
    const newClaim: InsuranceClaim = {
      id: uuidv4(),
      claimNumber: `CLM-${Date.now()}`,
      submissionDate: new Date(),
      status: 'submitted',
      ...claim
    };

    this.claims.set(newClaim.id, newClaim);

    // Process claim through rules engine
    setTimeout(() => {
      this.processClaim(newClaim.id);
    }, 1500);

    return newClaim;
  }

  private async processClaim(claimId: string): Promise<void> {
    const claim = this.claims.get(claimId);
    if (!claim) return;

    claim.status = 'pending';

    // Apply processing rules
    const applicableRules = Array.from(this.processingRules.values())
      .filter(rule => rule.isActive && this.ruleApplies(rule, claim))
      .sort((a, b) => b.priority - a.priority);

    let approved = true;
    let adjustedAmount = claim.totalAmount;
    const processingNotes: string[] = [];

    for (const rule of applicableRules) {
      const result = this.applyRule(rule, claim);
      if (result.action === 'deny') {
        approved = false;
        claim.denialReason = result.message;
        break;
      } else if (result.action === 'adjust') {
        adjustedAmount = result.value;
        processingNotes.push(result.message || 'Amount adjusted');
      } else if (result.action === 'flag') {
        processingNotes.push(result.message || 'Flagged for review');
      }
    }

    if (approved) {
      claim.status = 'approved';
      claim.approvedAmount = adjustedAmount;
      claim.processingNotes = processingNotes.join('; ');
      
      // Calculate patient responsibility
      const patientInsurances = await this.getPatientInsurances(claim.patientId);
      const primaryInsurance = patientInsurances.find(ins => ins.isPrimary);
      
      if (primaryInsurance) {
        const copay = primaryInsurance.copayAmount || 0;
        const deductible = primaryInsurance.deductibleAmount || 0;
        const coinsurance = (primaryInsurance.coinsurancePercentage || 0) / 100;
        
        claim.patientResponsibility = copay + deductible + (adjustedAmount * coinsurance);
        claim.paidAmount = adjustedAmount - claim.patientResponsibility;
      }
    } else {
      claim.status = 'denied';
      claim.approvedAmount = 0;
      claim.paidAmount = 0;
      claim.patientResponsibility = claim.totalAmount;
    }
  }

  private ruleApplies(rule: ClaimProcessingRule, claim: InsuranceClaim): boolean {
    if (rule.providerId && rule.providerId !== claim.providerId) return false;
    if (rule.serviceTypes && !rule.serviceTypes.includes(claim.claimType)) return false;

    return rule.conditions.every(condition => {
      const fieldValue = this.getFieldValue(claim, condition.field);
      return this.evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  private getFieldValue(claim: InsuranceClaim, field: string): any {
    const fields = field.split('.');
    let value: any = claim;
    for (const f of fields) {
      value = value?.[f];
    }
    return value;
  }

  private evaluateCondition(fieldValue: any, operator: string, value: any): boolean {
    switch (operator) {
      case 'equals': return fieldValue === value;
      case 'not_equals': return fieldValue !== value;
      case 'greater_than': return fieldValue > value;
      case 'less_than': return fieldValue < value;
      case 'contains': return fieldValue?.includes?.(value);
      case 'in': return Array.isArray(value) && value.includes(fieldValue);
      default: return false;
    }
  }

  private applyRule(rule: ClaimProcessingRule, claim: InsuranceClaim): { action: string; value?: any; message?: string } {
    const action = rule.actions[0]; // Use first action for simplicity
    return {
      action: action.type,
      value: action.value,
      message: action.message
    };
  }

  async getClaims(filters?: {
    patientId?: string;
    providerId?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<InsuranceClaim[]> {
    let claims = Array.from(this.claims.values());

    if (filters) {
      if (filters.patientId) {
        claims = claims.filter(claim => claim.patientId === filters.patientId);
      }
      if (filters.providerId) {
        claims = claims.filter(claim => claim.providerId === filters.providerId);
      }
      if (filters.status) {
        claims = claims.filter(claim => claim.status === filters.status);
      }
      if (filters.dateFrom) {
        claims = claims.filter(claim => claim.serviceDate >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        claims = claims.filter(claim => claim.serviceDate <= filters.dateTo!);
      }
    }

    return claims.sort((a, b) => b.submissionDate.getTime() - a.submissionDate.getTime());
  }

  async getClaim(claimId: string): Promise<InsuranceClaim | null> {
    return this.claims.get(claimId) || null;
  }

  async updateClaimStatus(claimId: string, status: string, notes?: string): Promise<InsuranceClaim | null> {
    const claim = this.claims.get(claimId);
    if (!claim) return null;

    claim.status = status;
    if (notes) {
      claim.processingNotes = notes;
    }

    return claim;
  }

  // Payment Processing
  async processPayment(payment: Omit<PaymentInfo, 'id'>): Promise<PaymentInfo> {
    const newPayment: PaymentInfo = {
      id: uuidv4(),
      ...payment
    };

    this.payments.set(newPayment.id, newPayment);

    // Update claim status
    const claim = this.claims.get(payment.claimId);
    if (claim) {
      claim.status = 'paid';
      claim.paymentDate = payment.paymentDate;
      claim.checkNumber = payment.checkNumber;
    }

    return newPayment;
  }

  async getPayments(claimId?: string): Promise<PaymentInfo[]> {
    const payments = Array.from(this.payments.values());
    return claimId ? payments.filter(p => p.claimId === claimId) : payments;
  }

  // Statistics and Reporting
  async getStatistics(dateFrom?: Date, dateTo?: Date): Promise<InsuranceStatistics> {
    const claims = Array.from(this.claims.values()).filter(claim => {
      if (dateFrom && claim.serviceDate < dateFrom) return false;
      if (dateTo && claim.serviceDate > dateTo) return false;
      return true;
    });

    const totalClaims = claims.length;
    const pendingClaims = claims.filter(c => c.status === 'pending').length;
    const approvedClaims = claims.filter(c => c.status === 'approved' || c.status === 'paid').length;
    const deniedClaims = claims.filter(c => c.status === 'denied').length;

    const totalClaimAmount = claims.reduce((sum, c) => sum + c.totalAmount, 0);
    const approvedAmount = claims.reduce((sum, c) => sum + (c.approvedAmount || 0), 0);
    const paidAmount = claims.reduce((sum, c) => sum + (c.paidAmount || 0), 0);

    const processingTimes = claims
      .filter(c => c.status !== 'submitted')
      .map(c => {
        const submissionTime = c.submissionDate.getTime();
        const currentTime = Date.now();
        return (currentTime - submissionTime) / (1000 * 60 * 60 * 24); // days
      });

    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;

    const denialRate = totalClaims > 0 ? (deniedClaims / totalClaims) * 100 : 0;

    // Top providers
    const providerCounts = new Map<string, { name: string; count: number }>();
    claims.forEach(claim => {
      const existing = providerCounts.get(claim.providerId) || { name: claim.providerName, count: 0 };
      existing.count++;
      providerCounts.set(claim.providerId, existing);
    });

    const topProviders = Array.from(providerCounts.entries())
      .map(([providerId, data]) => ({ providerId, providerName: data.name, claimCount: data.count }))
      .sort((a, b) => b.claimCount - a.claimCount)
      .slice(0, 10);

    // Top services
    const serviceCounts = new Map<string, { description: string; count: number }>();
    claims.forEach(claim => {
      claim.services.forEach(service => {
        const existing = serviceCounts.get(service.serviceCode) || { description: service.serviceDescription, count: 0 };
        existing.count++;
        serviceCounts.set(service.serviceCode, existing);
      });
    });

    const topServices = Array.from(serviceCounts.entries())
      .map(([serviceCode, data]) => ({ serviceCode, serviceDescription: data.description, claimCount: data.count }))
      .sort((a, b) => b.claimCount - a.claimCount)
      .slice(0, 10);

    // Monthly trends (last 12 months)
    const monthlyTrends: Array<{ month: string; claimCount: number; amount: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const monthClaims = claims.filter(claim => {
        const claimMonth = `${claim.serviceDate.getFullYear()}-${String(claim.serviceDate.getMonth() + 1).padStart(2, '0')}`;
        return claimMonth === monthKey;
      });

      monthlyTrends.push({
        month: monthKey,
        claimCount: monthClaims.length,
        amount: monthClaims.reduce((sum, c) => sum + c.totalAmount, 0)
      });
    }

    const eligibilityChecks = this.eligibilityRequests.size;
    const authorizationRequests = this.authorizationRequests.size;
    const approvedAuthorizations = Array.from(this.authorizationResponses.values())
      .filter(r => r.status === 'approved').length;
    const authorizationApprovalRate = authorizationRequests > 0 
      ? (approvedAuthorizations / authorizationRequests) * 100 
      : 0;

    return {
      totalClaims,
      pendingClaims,
      approvedClaims,
      deniedClaims,
      totalClaimAmount,
      approvedAmount,
      paidAmount,
      averageProcessingTime,
      denialRate,
      topProviders,
      topServices,
      monthlyTrends,
      eligibilityChecks,
      authorizationRequests,
      authorizationApprovalRate
    };
  }

  // Processing Rules Management
  async addProcessingRule(rule: Omit<ClaimProcessingRule, 'id'>): Promise<ClaimProcessingRule> {
    const newRule: ClaimProcessingRule = {
      id: uuidv4(),
      ...rule
    };

    this.processingRules.set(newRule.id, newRule);
    return newRule;
  }

  async getProcessingRules(): Promise<ClaimProcessingRule[]> {
    return Array.from(this.processingRules.values());
  }

  async updateProcessingRule(ruleId: string, updates: Partial<ClaimProcessingRule>): Promise<ClaimProcessingRule | null> {
    const rule = this.processingRules.get(ruleId);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates };
    this.processingRules.set(ruleId, updatedRule);
    return updatedRule;
  }

  async deleteProcessingRule(ruleId: string): Promise<boolean> {
    return this.processingRules.delete(ruleId);
  }

  private initializeDefaultProviders(): void {
    const defaultProviders: InsuranceProvider[] = [
      {
        id: 'provider-1',
        name: 'National Health Insurance',
        code: 'NHI',
        type: 'government',
        country: 'Saudi Arabia',
        contactInfo: {
          phone: '+966-11-123-4567',
          email: 'claims@nhi.gov.sa',
          website: 'https://nhi.gov.sa',
          address: 'Riyadh, Saudi Arabia'
        },
        supportedServices: ['medical', 'pharmacy', 'dental'],
        claimSubmissionMethod: 'api',
        eligibilityCheckSupported: true,
        preAuthRequired: true,
        averageProcessingTime: 7,
        status: 'active'
      },
      {
        id: 'provider-2',
        name: 'Bupa Arabia',
        code: 'BUPA',
        type: 'private',
        country: 'Saudi Arabia',
        contactInfo: {
          phone: '+966-11-987-6543',
          email: 'claims@bupa.com.sa',
          website: 'https://bupa.com.sa',
          address: 'Jeddah, Saudi Arabia'
        },
        supportedServices: ['medical', 'dental', 'vision'],
        claimSubmissionMethod: 'api',
        eligibilityCheckSupported: true,
        preAuthRequired: false,
        averageProcessingTime: 5,
        status: 'active'
      }
    ];

    defaultProviders.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  private initializeDefaultRules(): void {
    const defaultRules: ClaimProcessingRule[] = [
      {
        id: 'rule-1',
        name: 'Maximum Claim Amount Check',
        description: 'Flag claims over 10,000 SAR for manual review',
        ruleType: 'validation',
        conditions: [
          { field: 'totalAmount', operator: 'greater_than', value: 10000 }
        ],
        actions: [
          { type: 'flag', message: 'High value claim requires manual review' }
        ],
        priority: 1,
        isActive: true
      },
      {
        id: 'rule-2',
        name: 'Duplicate Claim Check',
        description: 'Deny duplicate claims for same service on same date',
        ruleType: 'validation',
        conditions: [
          { field: 'serviceDate', operator: 'equals', value: 'today' }
        ],
        actions: [
          { type: 'deny', message: 'Duplicate claim detected' }
        ],
        priority: 2,
        isActive: true
      },
      {
        id: 'rule-3',
        name: 'Emergency Service Auto-Approval',
        description: 'Auto-approve emergency services under 5,000 SAR',
        ruleType: 'authorization',
        conditions: [
          { field: 'claimType', operator: 'equals', value: 'emergency' },
          { field: 'totalAmount', operator: 'less_than', value: 5000 }
        ],
        actions: [
          { type: 'approve', message: 'Emergency service auto-approved' }
        ],
        priority: 3,
        isActive: true
      }
    ];

    defaultRules.forEach(rule => {
      this.processingRules.set(rule.id, rule);
    });
  }
}

export default InsuranceService;