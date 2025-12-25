import { v4 as uuidv4 } from 'uuid';

// Drug and Medication Interfaces
export interface Drug {
  id: string;
  name: string;
  genericName: string;
  brandNames: string[];
  activeIngredient: string;
  strength: string;
  dosageForm: 'tablet' | 'capsule' | 'liquid' | 'injection' | 'cream' | 'ointment' | 'inhaler' | 'patch';
  routeOfAdministration: 'oral' | 'topical' | 'injection' | 'inhalation' | 'rectal' | 'sublingual';
  therapeuticClass: string;
  pharmacologicalClass: string;
  controlledSubstance: boolean;
  scheduleClass?: 'I' | 'II' | 'III' | 'IV' | 'V';
  contraindications: string[];
  sideEffects: string[];
  warnings: string[];
  interactions: DrugInteraction[];
  allergyInfo: string[];
  pregnancyCategory?: 'A' | 'B' | 'C' | 'D' | 'X';
  pediatricUse: boolean;
  geriatricUse: boolean;
  renalAdjustment: boolean;
  hepaticAdjustment: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DrugInteraction {
  drugId: string;
  drugName: string;
  interactionType: 'major' | 'moderate' | 'minor';
  severity: 'contraindicated' | 'serious' | 'significant' | 'minor';
  mechanism: string;
  clinicalEffect: string;
  management: string;
  documentation: 'excellent' | 'good' | 'fair' | 'poor';
  onset: 'rapid' | 'delayed' | 'unspecified';
  references: string[];
}

export interface Prescription {
  id: string;
  prescriptionNumber: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  facilityId: string;
  facilityName: string;
  prescriptionDate: Date;
  medications: PrescribedMedication[];
  diagnosis: string[];
  allergies: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
  };
  status: 'draft' | 'active' | 'completed' | 'cancelled' | 'expired';
  validUntil: Date;
  refillsRemaining: number;
  totalRefills: number;
  pharmacyId?: string;
  pharmacyName?: string;
  dispensedDate?: Date;
  dispensedBy?: string;
  notes?: string;
  electronicSignature: string;
  digitalSignature?: string;
  interactionChecks: InteractionCheck[];
  allergyChecks: AllergyCheck[];
  contraindications: ContraindicationCheck[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PrescribedMedication {
  id: string;
  drugId: string;
  drugName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  substitutionAllowed: boolean;
  refills: number;
  daysSupply: number;
  prn: boolean; // Pro re nata (as needed)
  prnInstructions?: string;
  startDate: Date;
  endDate?: Date;
  cost?: number;
  insuranceCovered?: boolean;
  priorAuthRequired?: boolean;
  status: 'prescribed' | 'dispensed' | 'discontinued';
}

export interface InteractionCheck {
  id: string;
  drug1Id: string;
  drug1Name: string;
  drug2Id: string;
  drug2Name: string;
  interactionType: 'drug-drug' | 'drug-food' | 'drug-disease' | 'drug-allergy';
  severity: 'contraindicated' | 'serious' | 'significant' | 'minor';
  description: string;
  clinicalEffect: string;
  management: string;
  overridden: boolean;
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AllergyCheck {
  id: string;
  drugId: string;
  drugName: string;
  allergen: string;
  allergyType: 'drug' | 'food' | 'environmental';
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction: string[];
  crossReactivity: string[];
  overridden: boolean;
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: Date;
}

export interface ContraindicationCheck {
  id: string;
  drugId: string;
  drugName: string;
  condition: string;
  contraindicationType: 'absolute' | 'relative';
  severity: 'high' | 'medium' | 'low';
  description: string;
  alternatives: string[];
  overridden: boolean;
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: Date;
}

export interface PrescriptionTemplate {
  id: string;
  name: string;
  description: string;
  specialty: string;
  condition: string;
  medications: Omit<PrescribedMedication, 'id' | 'status'>[];
  instructions: string;
  duration: string;
  followUpRequired: boolean;
  followUpDays?: number;
  createdBy: string;
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PharmacyInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  npi: string;
  hours: string;
  services: string[];
  acceptedInsurance: string[];
  electronicPrescribing: boolean;
  deliveryAvailable: boolean;
  status: 'active' | 'inactive';
}

export interface PrescriptionHistory {
  prescriptionId: string;
  action: 'created' | 'modified' | 'dispensed' | 'cancelled' | 'refilled';
  performedBy: string;
  performedAt: Date;
  details: string;
  oldValues?: any;
  newValues?: any;
}

export class EPrescriptionService {
  private drugs: Map<string, Drug> = new Map();
  private prescriptions: Map<string, Prescription> = new Map();
  private templates: Map<string, PrescriptionTemplate> = new Map();
  private pharmacies: Map<string, PharmacyInfo> = new Map();
  private prescriptionHistory: Map<string, PrescriptionHistory[]> = new Map();
  private interactionDatabase: Map<string, DrugInteraction[]> = new Map();

  constructor() {
    this.initializeDrugDatabase();
    this.initializePharmacies();
    this.initializeTemplates();
    this.initializeSampleData();
  }

  private initializeDrugDatabase(): void {
    // Sample drugs with interaction data
    const drugs: Drug[] = [
      {
        id: 'drug_001',
        name: 'Warfarin',
        genericName: 'Warfarin Sodium',
        brandNames: ['Coumadin', 'Jantoven'],
        activeIngredient: 'Warfarin Sodium',
        strength: '5mg',
        dosageForm: 'tablet',
        routeOfAdministration: 'oral',
        therapeuticClass: 'Anticoagulant',
        pharmacologicalClass: 'Vitamin K Antagonist',
        controlledSubstance: false,
        contraindications: ['Active bleeding', 'Pregnancy', 'Severe liver disease'],
        sideEffects: ['Bleeding', 'Bruising', 'Hair loss'],
        warnings: ['Monitor INR regularly', 'Avoid alcohol'],
        interactions: [
          {
            drugId: 'drug_002',
            drugName: 'Aspirin',
            interactionType: 'major',
            severity: 'serious',
            mechanism: 'Additive anticoagulant effect',
            clinicalEffect: 'Increased bleeding risk',
            management: 'Monitor closely, consider alternative',
            documentation: 'excellent',
            onset: 'rapid',
            references: ['Clinical study 2023']
          }
        ],
        allergyInfo: ['Warfarin hypersensitivity'],
        pregnancyCategory: 'X',
        pediatricUse: false,
        geriatricUse: true,
        renalAdjustment: false,
        hepaticAdjustment: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'drug_002',
        name: 'Aspirin',
        genericName: 'Acetylsalicylic Acid',
        brandNames: ['Bayer', 'Bufferin'],
        activeIngredient: 'Acetylsalicylic Acid',
        strength: '81mg',
        dosageForm: 'tablet',
        routeOfAdministration: 'oral',
        therapeuticClass: 'Antiplatelet',
        pharmacologicalClass: 'NSAID',
        controlledSubstance: false,
        contraindications: ['Active bleeding', 'Peptic ulcer', 'Children with viral infections'],
        sideEffects: ['GI upset', 'Bleeding', 'Tinnitus'],
        warnings: ['Take with food', 'Monitor for bleeding'],
        interactions: [
          {
            drugId: 'drug_001',
            drugName: 'Warfarin',
            interactionType: 'major',
            severity: 'serious',
            mechanism: 'Additive anticoagulant effect',
            clinicalEffect: 'Increased bleeding risk',
            management: 'Monitor closely, consider alternative',
            documentation: 'excellent',
            onset: 'rapid',
            references: ['Clinical study 2023']
          }
        ],
        allergyInfo: ['Aspirin hypersensitivity', 'Salicylate allergy'],
        pregnancyCategory: 'C',
        pediatricUse: false,
        geriatricUse: true,
        renalAdjustment: true,
        hepaticAdjustment: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'drug_003',
        name: 'Metformin',
        genericName: 'Metformin Hydrochloride',
        brandNames: ['Glucophage', 'Fortamet'],
        activeIngredient: 'Metformin Hydrochloride',
        strength: '500mg',
        dosageForm: 'tablet',
        routeOfAdministration: 'oral',
        therapeuticClass: 'Antidiabetic',
        pharmacologicalClass: 'Biguanide',
        controlledSubstance: false,
        contraindications: ['Severe kidney disease', 'Metabolic acidosis', 'Diabetic ketoacidosis'],
        sideEffects: ['Nausea', 'Diarrhea', 'Metallic taste'],
        warnings: ['Monitor kidney function', 'Risk of lactic acidosis'],
        interactions: [],
        allergyInfo: ['Metformin hypersensitivity'],
        pregnancyCategory: 'B',
        pediatricUse: true,
        geriatricUse: true,
        renalAdjustment: true,
        hepaticAdjustment: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    drugs.forEach(drug => {
      this.drugs.set(drug.id, drug);
      this.interactionDatabase.set(drug.id, drug.interactions);
    });
  }

  private initializePharmacies(): void {
    const pharmacies: PharmacyInfo[] = [
      {
        id: 'pharmacy_001',
        name: 'Central Hospital Pharmacy',
        address: '123 Medical Center Dr, City, State 12345',
        phone: '+1-555-0123',
        email: 'pharmacy@hospital.com',
        licenseNumber: 'PH123456',
        npi: '1234567890',
        hours: 'Mon-Fri: 8AM-8PM, Sat-Sun: 9AM-5PM',
        services: ['Prescription filling', 'Medication counseling', 'Immunizations'],
        acceptedInsurance: ['Medicare', 'Medicaid', 'Blue Cross', 'Aetna'],
        electronicPrescribing: true,
        deliveryAvailable: true,
        status: 'active'
      },
      {
        id: 'pharmacy_002',
        name: 'Community Pharmacy',
        address: '456 Main St, City, State 12345',
        phone: '+1-555-0124',
        email: 'info@communitypharmacy.com',
        licenseNumber: 'PH123457',
        npi: '1234567891',
        hours: 'Mon-Sat: 9AM-7PM, Sun: 10AM-4PM',
        services: ['Prescription filling', 'OTC medications', 'Health screenings'],
        acceptedInsurance: ['Medicare', 'Medicaid', 'Cigna', 'United Healthcare'],
        electronicPrescribing: true,
        deliveryAvailable: false,
        status: 'active'
      }
    ];

    pharmacies.forEach(pharmacy => {
      this.pharmacies.set(pharmacy.id, pharmacy);
    });
  }

  private initializeTemplates(): void {
    const templates: PrescriptionTemplate[] = [
      {
        id: 'template_001',
        name: 'Hypertension Management',
        description: 'Standard treatment for hypertension',
        specialty: 'Cardiology',
        condition: 'Hypertension',
        medications: [
          {
            drugId: 'drug_004',
            drugName: 'Lisinopril',
            genericName: 'Lisinopril',
            strength: '10mg',
            dosageForm: 'tablet',
            quantity: 30,
            unit: 'tablets',
            dosage: '10mg',
            frequency: 'Once daily',
            duration: '30 days',
            instructions: 'Take in the morning with or without food',
            substitutionAllowed: true,
            refills: 5,
            daysSupply: 30,
            prn: false,
            startDate: new Date()
          }
        ],
        instructions: 'Monitor blood pressure regularly',
        duration: '30 days',
        followUpRequired: true,
        followUpDays: 14,
        createdBy: 'dr_001',
        isPublic: true,
        usageCount: 25,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  private initializeSampleData(): void {
    // Sample prescription
    const prescription: Prescription = {
      id: 'rx_001',
      prescriptionNumber: 'RX2025001',
      patientId: 'pat_001',
      patientName: 'John Doe',
      doctorId: 'dr_001',
      doctorName: 'Dr. Smith',
      facilityId: 'facility_001',
      facilityName: 'Central Hospital',
      prescriptionDate: new Date(),
      medications: [
        {
          id: 'med_001',
          drugId: 'drug_003',
          drugName: 'Metformin',
          genericName: 'Metformin Hydrochloride',
          strength: '500mg',
          dosageForm: 'tablet',
          quantity: 60,
          unit: 'tablets',
          dosage: '500mg',
          frequency: 'Twice daily',
          duration: '30 days',
          instructions: 'Take with meals',
          substitutionAllowed: true,
          refills: 5,
          daysSupply: 30,
          prn: false,
          startDate: new Date(),
          status: 'prescribed'
        }
      ],
      diagnosis: ['Type 2 Diabetes Mellitus'],
      allergies: ['Penicillin'],
      status: 'active',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      refillsRemaining: 5,
      totalRefills: 5,
      electronicSignature: 'Dr. Smith - Digital Signature',
      interactionChecks: [],
      allergyChecks: [],
      contraindications: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.prescriptions.set(prescription.id, prescription);
  }

  // Drug Management
  async searchDrugs(query: string, limit: number = 20): Promise<Drug[]> {
    const results: Drug[] = [];
    const searchTerm = query.toLowerCase();

    for (const drug of this.drugs.values()) {
      if (
        drug.name.toLowerCase().includes(searchTerm) ||
        drug.genericName.toLowerCase().includes(searchTerm) ||
        drug.brandNames.some(brand => brand.toLowerCase().includes(searchTerm)) ||
        drug.activeIngredient.toLowerCase().includes(searchTerm)
      ) {
        results.push(drug);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  async getDrugById(drugId: string): Promise<Drug | null> {
    return this.drugs.get(drugId) || null;
  }

  async getDrugInteractions(drugId: string): Promise<DrugInteraction[]> {
    return this.interactionDatabase.get(drugId) || [];
  }

  // Prescription Management
  async createPrescription(prescriptionData: Omit<Prescription, 'id' | 'prescriptionNumber' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const prescriptionId = uuidv4();
    const prescriptionNumber = `RX${Date.now()}`;

    const prescription: Prescription = {
      ...prescriptionData,
      id: prescriptionId,
      prescriptionNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Perform safety checks
    const interactionChecks = await this.checkDrugInteractions(prescription.medications);
    const allergyChecks = await this.checkAllergies(prescription.medications, prescription.allergies);
    const contraindications = await this.checkContraindications(prescription.medications, prescription.diagnosis);

    prescription.interactionChecks = interactionChecks;
    prescription.allergyChecks = allergyChecks;
    prescription.contraindications = contraindications;

    this.prescriptions.set(prescriptionId, prescription);

    // Log history
    this.addPrescriptionHistory(prescriptionId, {
      prescriptionId,
      action: 'created',
      performedBy: prescription.doctorId,
      performedAt: new Date(),
      details: 'Prescription created'
    });

    return prescriptionId;
  }

  async getPrescription(prescriptionId: string): Promise<Prescription | null> {
    return this.prescriptions.get(prescriptionId) || null;
  }

  async updatePrescription(prescriptionId: string, updates: Partial<Prescription>): Promise<boolean> {
    const prescription = this.prescriptions.get(prescriptionId);
    if (!prescription) return false;

    const oldValues = { ...prescription };
    Object.assign(prescription, updates, { updatedAt: new Date() });

    // Re-run safety checks if medications changed
    if (updates.medications) {
      const interactionChecks = await this.checkDrugInteractions(prescription.medications);
      const allergyChecks = await this.checkAllergies(prescription.medications, prescription.allergies);
      const contraindications = await this.checkContraindications(prescription.medications, prescription.diagnosis);

      prescription.interactionChecks = interactionChecks;
      prescription.allergyChecks = allergyChecks;
      prescription.contraindications = contraindications;
    }

    this.prescriptions.set(prescriptionId, prescription);

    // Log history
    this.addPrescriptionHistory(prescriptionId, {
      prescriptionId,
      action: 'modified',
      performedBy: updates.doctorId || prescription.doctorId,
      performedAt: new Date(),
      details: 'Prescription updated',
      oldValues,
      newValues: prescription
    });

    return true;
  }

  async cancelPrescription(prescriptionId: string, cancelledBy: string, reason: string): Promise<boolean> {
    const prescription = this.prescriptions.get(prescriptionId);
    if (!prescription) return false;

    prescription.status = 'cancelled';
    prescription.updatedAt = new Date();

    this.prescriptions.set(prescriptionId, prescription);

    // Log history
    this.addPrescriptionHistory(prescriptionId, {
      prescriptionId,
      action: 'cancelled',
      performedBy: cancelledBy,
      performedAt: new Date(),
      details: `Prescription cancelled: ${reason}`
    });

    return true;
  }

  // Safety Checks
  async checkDrugInteractions(medications: PrescribedMedication[]): Promise<InteractionCheck[]> {
    const interactions: InteractionCheck[] = [];

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const drug1 = medications[i];
        const drug2 = medications[j];

        const drug1Interactions = await this.getDrugInteractions(drug1.drugId);
        const interaction = drug1Interactions.find(int => int.drugId === drug2.drugId);

        if (interaction) {
          interactions.push({
            id: uuidv4(),
            drug1Id: drug1.drugId,
            drug1Name: drug1.drugName,
            drug2Id: drug2.drugId,
            drug2Name: drug2.drugName,
            interactionType: 'drug-drug',
            severity: interaction.severity,
            description: interaction.mechanism,
            clinicalEffect: interaction.clinicalEffect,
            management: interaction.management,
            overridden: false,
            acknowledged: false
          });
        }
      }
    }

    return interactions;
  }

  async checkAllergies(medications: PrescribedMedication[], patientAllergies: string[]): Promise<AllergyCheck[]> {
    const allergyChecks: AllergyCheck[] = [];

    for (const medication of medications) {
      const drug = await this.getDrugById(medication.drugId);
      if (!drug) continue;

      for (const allergy of patientAllergies) {
        if (drug.allergyInfo.some(allergen => 
          allergen.toLowerCase().includes(allergy.toLowerCase()) ||
          allergy.toLowerCase().includes(allergen.toLowerCase())
        )) {
          allergyChecks.push({
            id: uuidv4(),
            drugId: medication.drugId,
            drugName: medication.drugName,
            allergen: allergy,
            allergyType: 'drug',
            severity: 'moderate',
            reaction: ['Unknown reaction'],
            crossReactivity: [],
            overridden: false
          });
        }
      }
    }

    return allergyChecks;
  }

  async checkContraindications(medications: PrescribedMedication[], diagnoses: string[]): Promise<ContraindicationCheck[]> {
    const contraindications: ContraindicationCheck[] = [];

    for (const medication of medications) {
      const drug = await this.getDrugById(medication.drugId);
      if (!drug) continue;

      for (const diagnosis of diagnoses) {
        if (drug.contraindications.some(contraindication => 
          contraindication.toLowerCase().includes(diagnosis.toLowerCase()) ||
          diagnosis.toLowerCase().includes(contraindication.toLowerCase())
        )) {
          contraindications.push({
            id: uuidv4(),
            drugId: medication.drugId,
            drugName: medication.drugName,
            condition: diagnosis,
            contraindicationType: 'absolute',
            severity: 'high',
            description: `${medication.drugName} is contraindicated in ${diagnosis}`,
            alternatives: [],
            overridden: false
          });
        }
      }
    }

    return contraindications;
  }

  // Template Management
  async getTemplates(specialty?: string): Promise<PrescriptionTemplate[]> {
    let templates = Array.from(this.templates.values());
    
    if (specialty) {
      templates = templates.filter(template => 
        template.specialty.toLowerCase() === specialty.toLowerCase()
      );
    }

    return templates.sort((a, b) => b.usageCount - a.usageCount);
  }

  async createTemplate(templateData: Omit<PrescriptionTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const templateId = uuidv4();
    const template: PrescriptionTemplate = {
      ...templateData,
      id: templateId,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(templateId, template);
    return templateId;
  }

  async useTemplate(templateId: string): Promise<PrescriptionTemplate | null> {
    const template = this.templates.get(templateId);
    if (!template) return null;

    template.usageCount++;
    template.updatedAt = new Date();
    this.templates.set(templateId, template);

    return template;
  }

  // Pharmacy Management
  async getPharmacies(): Promise<PharmacyInfo[]> {
    return Array.from(this.pharmacies.values()).filter(pharmacy => pharmacy.status === 'active');
  }

  async getPharmacyById(pharmacyId: string): Promise<PharmacyInfo | null> {
    return this.pharmacies.get(pharmacyId) || null;
  }

  // Prescription History
  private addPrescriptionHistory(prescriptionId: string, historyEntry: PrescriptionHistory): void {
    const history = this.prescriptionHistory.get(prescriptionId) || [];
    history.push(historyEntry);
    this.prescriptionHistory.set(prescriptionId, history);
  }

  async getPrescriptionHistory(prescriptionId: string): Promise<PrescriptionHistory[]> {
    return this.prescriptionHistory.get(prescriptionId) || [];
  }

  // Patient Prescription History
  async getPatientPrescriptions(patientId: string): Promise<Prescription[]> {
    return Array.from(this.prescriptions.values())
      .filter(prescription => prescription.patientId === patientId)
      .sort((a, b) => b.prescriptionDate.getTime() - a.prescriptionDate.getTime());
  }

  // Doctor Prescription History
  async getDoctorPrescriptions(doctorId: string, startDate?: Date, endDate?: Date): Promise<Prescription[]> {
    let prescriptions = Array.from(this.prescriptions.values())
      .filter(prescription => prescription.doctorId === doctorId);

    if (startDate) {
      prescriptions = prescriptions.filter(prescription => 
        prescription.prescriptionDate >= startDate
      );
    }

    if (endDate) {
      prescriptions = prescriptions.filter(prescription => 
        prescription.prescriptionDate <= endDate
      );
    }

    return prescriptions.sort((a, b) => b.prescriptionDate.getTime() - a.prescriptionDate.getTime());
  }

  // Override Safety Checks
  async overrideInteraction(prescriptionId: string, interactionId: string, reason: string, overriddenBy: string): Promise<boolean> {
    const prescription = this.prescriptions.get(prescriptionId);
    if (!prescription) return false;

    const interaction = prescription.interactionChecks.find(check => check.id === interactionId);
    if (!interaction) return false;

    interaction.overridden = true;
    interaction.overrideReason = reason;
    interaction.overriddenBy = overriddenBy;
    interaction.overriddenAt = new Date();

    this.prescriptions.set(prescriptionId, prescription);
    return true;
  }

  async acknowledgeInteraction(prescriptionId: string, interactionId: string, acknowledgedBy: string): Promise<boolean> {
    const prescription = this.prescriptions.get(prescriptionId);
    if (!prescription) return false;

    const interaction = prescription.interactionChecks.find(check => check.id === interactionId);
    if (!interaction) return false;

    interaction.acknowledged = true;
    interaction.acknowledgedBy = acknowledgedBy;
    interaction.acknowledgedAt = new Date();

    this.prescriptions.set(prescriptionId, prescription);
    return true;
  }

  // Statistics and Analytics
  async getPrescriptionStatistics(): Promise<any> {
    const totalPrescriptions = this.prescriptions.size;
    const activePrescriptions = Array.from(this.prescriptions.values())
      .filter(prescription => prescription.status === 'active').length;

    const interactionCount = Array.from(this.prescriptions.values())
      .reduce((count, prescription) => count + prescription.interactionChecks.length, 0);

    const allergyAlertCount = Array.from(this.prescriptions.values())
      .reduce((count, prescription) => count + prescription.allergyChecks.length, 0);

    const contraindicationCount = Array.from(this.prescriptions.values())
      .reduce((count, prescription) => count + prescription.contraindications.length, 0);

    const topDrugs = this.getTopPrescribedDrugs();
    const topDoctors = this.getTopPrescribingDoctors();

    return {
      totalPrescriptions,
      activePrescriptions,
      interactionCount,
      allergyAlertCount,
      contraindicationCount,
      topDrugs,
      topDoctors,
      totalDrugs: this.drugs.size,
      totalPharmacies: this.pharmacies.size,
      totalTemplates: this.templates.size
    };
  }

  private getTopPrescribedDrugs(): Array<{ drugName: string; count: number }> {
    const drugCounts = new Map<string, number>();

    Array.from(this.prescriptions.values()).forEach(prescription => {
      prescription.medications.forEach(medication => {
        const count = drugCounts.get(medication.drugName) || 0;
        drugCounts.set(medication.drugName, count + 1);
      });
    });

    return Array.from(drugCounts.entries())
      .map(([drugName, count]) => ({ drugName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getTopPrescribingDoctors(): Array<{ doctorName: string; count: number }> {
    const doctorCounts = new Map<string, number>();

    Array.from(this.prescriptions.values()).forEach(prescription => {
      const count = doctorCounts.get(prescription.doctorName) || 0;
      doctorCounts.set(prescription.doctorName, count + 1);
    });

    return Array.from(doctorCounts.entries())
      .map(([doctorName, count]) => ({ doctorName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

export default EPrescriptionService;