import { Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';

// FHIR Resource Types
export interface FHIRPatient {
  resourceType: 'Patient';
  id?: string;
  identifier?: Array<{
    use?: string;
    type?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    system?: string;
    value?: string;
  }>;
  active?: boolean;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: Array<{
    use?: string;
    type?: string;
    text?: string;
    line?: string[];
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id?: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference?: string;
    display?: string;
  };
  effectiveDateTime?: string;
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
  valueBoolean?: boolean;
}

export interface FHIRMedicationRequest {
  resourceType: 'MedicationRequest';
  id?: string;
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference?: string;
    display?: string;
  };
  authoredOn?: string;
  requester?: {
    reference?: string;
    display?: string;
  };
  dosageInstruction?: Array<{
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
      };
    };
    route?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    doseAndRate?: Array<{
      doseQuantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    }>;
  }>;
}

export class FHIRService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.FHIR_SERVER_URL || 'http://localhost:8080/fhir';
    this.apiKey = process.env.FHIR_API_KEY || '';
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json',
      'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : '',
    };
  }

  // Patient Operations
  async createPatient(patient: FHIRPatient): Promise<FHIRPatient> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/Patient`,
        patient,
        { headers: this.getHeaders() }
      );
      logger.info('FHIR Patient created successfully', { patientId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Error creating FHIR Patient', { error: error.message });
      throw new Error('Failed to create FHIR Patient');
    }
  }

  async getPatient(patientId: string): Promise<FHIRPatient> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/Patient/${patientId}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      logger.error('Error fetching FHIR Patient', { patientId, error: error.message });
      throw new Error('Failed to fetch FHIR Patient');
    }
  }

  async updatePatient(patientId: string, patient: FHIRPatient): Promise<FHIRPatient> {
    try {
      const response = await axios.put(
        `${this.baseUrl}/Patient/${patientId}`,
        patient,
        { headers: this.getHeaders() }
      );
      logger.info('FHIR Patient updated successfully', { patientId });
      return response.data;
    } catch (error) {
      logger.error('Error updating FHIR Patient', { patientId, error: error.message });
      throw new Error('Failed to update FHIR Patient');
    }
  }

  async searchPatients(params: Record<string, string>): Promise<{ entry: Array<{ resource: FHIRPatient }> }> {
    try {
      const queryParams = new URLSearchParams(params);
      const response = await axios.get(
        `${this.baseUrl}/Patient?${queryParams.toString()}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      logger.error('Error searching FHIR Patients', { params, error: error.message });
      throw new Error('Failed to search FHIR Patients');
    }
  }

  // Observation Operations
  async createObservation(observation: FHIRObservation): Promise<FHIRObservation> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/Observation`,
        observation,
        { headers: this.getHeaders() }
      );
      logger.info('FHIR Observation created successfully', { observationId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Error creating FHIR Observation', { error: error.message });
      throw new Error('Failed to create FHIR Observation');
    }
  }

  async getObservationsForPatient(patientId: string): Promise<{ entry: Array<{ resource: FHIRObservation }> }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/Observation?subject=Patient/${patientId}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      logger.error('Error fetching FHIR Observations', { patientId, error: error.message });
      throw new Error('Failed to fetch FHIR Observations');
    }
  }

  // Medication Request Operations
  async createMedicationRequest(medicationRequest: FHIRMedicationRequest): Promise<FHIRMedicationRequest> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/MedicationRequest`,
        medicationRequest,
        { headers: this.getHeaders() }
      );
      logger.info('FHIR MedicationRequest created successfully', { medicationRequestId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Error creating FHIR MedicationRequest', { error: error.message });
      throw new Error('Failed to create FHIR MedicationRequest');
    }
  }

  async getMedicationRequestsForPatient(patientId: string): Promise<{ entry: Array<{ resource: FHIRMedicationRequest }> }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/MedicationRequest?subject=Patient/${patientId}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      logger.error('Error fetching FHIR MedicationRequests', { patientId, error: error.message });
      throw new Error('Failed to fetch FHIR MedicationRequests');
    }
  }

  // Data Conversion Utilities
  convertPatientToFHIR(patient: any): FHIRPatient {
    return {
      resourceType: 'Patient',
      identifier: [
        {
          use: 'usual',
          system: 'http://hospital.local/patient-id',
          value: patient.id?.toString(),
        },
      ],
      active: true,
      name: [
        {
          use: 'official',
          family: patient.lastName,
          given: [patient.firstName],
        },
      ],
      telecom: [
        {
          system: 'phone',
          value: patient.phone,
          use: 'home',
        },
        {
          system: 'email',
          value: patient.email,
          use: 'home',
        },
      ],
      gender: patient.gender?.toLowerCase() as 'male' | 'female' | 'other' | 'unknown',
      birthDate: patient.dateOfBirth,
      address: [
        {
          use: 'home',
          text: patient.address,
          city: patient.city,
          state: patient.state,
          postalCode: patient.zipCode,
          country: patient.country || 'SA',
        },
      ],
    };
  }

  convertObservationToFHIR(observation: any, patientId: string): FHIRObservation {
    return {
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: observation.code,
            display: observation.name,
          },
        ],
        text: observation.name,
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      effectiveDateTime: observation.date,
      valueQuantity: {
        value: observation.value,
        unit: observation.unit,
        system: 'http://unitsofmeasure.org',
        code: observation.unit,
      },
    };
  }

  convertMedicationRequestToFHIR(prescription: any, patientId: string): FHIRMedicationRequest {
    return {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: prescription.medicationCode,
            display: prescription.medicationName,
          },
        ],
        text: prescription.medicationName,
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      authoredOn: prescription.prescribedDate,
      requester: {
        reference: `Practitioner/${prescription.doctorId}`,
        display: prescription.doctorName,
      },
      dosageInstruction: [
        {
          text: prescription.instructions,
          timing: {
            repeat: {
              frequency: prescription.frequency,
              period: 1,
              periodUnit: 'd',
            },
          },
          doseAndRate: [
            {
              doseQuantity: {
                value: prescription.dosage,
                unit: prescription.dosageUnit,
                system: 'http://unitsofmeasure.org',
                code: prescription.dosageUnit,
              },
            },
          ],
        },
      ],
    };
  }

  // Bulk Operations
  async syncPatientData(patientId: string): Promise<void> {
    try {
      // This would typically sync patient data between internal system and FHIR server
      logger.info('Starting FHIR patient data sync', { patientId });
      
      // Implementation would depend on specific requirements
      // This is a placeholder for the actual sync logic
      
      logger.info('FHIR patient data sync completed', { patientId });
    } catch (error) {
      logger.error('Error syncing FHIR patient data', { patientId, error: error.message });
      throw error;
    }
  }

  async validateFHIRResource(resource: any): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${resource.resourceType}/$validate`,
        resource,
        { headers: this.getHeaders() }
      );
      return response.status === 200;
    } catch (error) {
      logger.error('FHIR resource validation failed', { resource: resource.resourceType, error: error.message });
      return false;
    }
  }
}

export const fhirService = new FHIRService();