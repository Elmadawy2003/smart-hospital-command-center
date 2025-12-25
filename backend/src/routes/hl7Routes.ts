import express from 'express';
import { hl7Service } from '../services/hl7Service';
import { fhirService } from '../services/fhirService';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// HL7 Message Endpoints

// Receive HL7 message
router.post('/message', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'HL7 message is required',
      });
    }

    await hl7Service.processMessage(message);

    // Generate ACK
    const parsedMessage = hl7Service.parseHL7Message(message);
    const ack = hl7Service.generateACK(parsedMessage, 'AA');

    res.status(200).json({
      success: true,
      message: 'HL7 message processed successfully',
      acknowledgment: ack,
    });
  } catch (error) {
    logger.error('Error processing HL7 message', { error: error.message });
    
    // Try to generate error ACK if possible
    try {
      const parsedMessage = hl7Service.parseHL7Message(req.body.message);
      const errorAck = hl7Service.generateACK(parsedMessage, 'AE');
      
      res.status(400).json({
        success: false,
        message: 'Error processing HL7 message',
        error: error.message,
        acknowledgment: errorAck,
      });
    } catch (ackError) {
      res.status(400).json({
        success: false,
        message: 'Error processing HL7 message',
        error: error.message,
      });
    }
  }
});

// Send HL7 message
router.post('/send', async (req, res) => {
  try {
    const { messageData, endpoint } = req.body;

    if (!messageData || !endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Message data and endpoint are required',
      });
    }

    const hl7Message = hl7Service.buildHL7Message(messageData);
    await hl7Service.sendMessage(hl7Message, endpoint);

    res.status(200).json({
      success: true,
      message: 'HL7 message sent successfully',
      messageControlId: messageData.messageControlId,
    });
  } catch (error) {
    logger.error('Error sending HL7 message', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error sending HL7 message',
      error: error.message,
    });
  }
});

// ADT (Admission, Discharge, Transfer) Endpoints

// Send patient admission message
router.post('/adt/admission', async (req, res) => {
  try {
    const { patientId, admissionData, endpoint } = req.body;

    const adtMessage = {
      messageType: 'ADT',
      eventType: 'A01',
      sendingApplication: 'HOSPITAL_ERP',
      sendingFacility: 'MAIN_HOSPITAL',
      receivingApplication: 'EXTERNAL_SYSTEM',
      receivingFacility: 'EXTERNAL_FACILITY',
      patientId,
      patientName: admissionData.patientName,
      dateOfBirth: admissionData.dateOfBirth,
      gender: admissionData.gender,
      admissionDate: admissionData.admissionDate,
      roomNumber: admissionData.roomNumber,
      attendingDoctor: admissionData.attendingDoctor,
    };

    const hl7Message = hl7Service.buildHL7Message(adtMessage);
    await hl7Service.sendMessage(hl7Message, endpoint);

    res.status(200).json({
      success: true,
      message: 'ADT admission message sent successfully',
      messageType: 'ADT^A01',
    });
  } catch (error) {
    logger.error('Error sending ADT admission message', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error sending ADT admission message',
      error: error.message,
    });
  }
});

// Send patient discharge message
router.post('/adt/discharge', async (req, res) => {
  try {
    const { patientId, dischargeData, endpoint } = req.body;

    const adtMessage = {
      messageType: 'ADT',
      eventType: 'A03',
      sendingApplication: 'HOSPITAL_ERP',
      sendingFacility: 'MAIN_HOSPITAL',
      receivingApplication: 'EXTERNAL_SYSTEM',
      receivingFacility: 'EXTERNAL_FACILITY',
      patientId,
      patientName: dischargeData.patientName,
      dateOfBirth: dischargeData.dateOfBirth,
      gender: dischargeData.gender,
      dischargeDate: dischargeData.dischargeDate,
      roomNumber: dischargeData.roomNumber,
      attendingDoctor: dischargeData.attendingDoctor,
    };

    const hl7Message = hl7Service.buildHL7Message(adtMessage);
    await hl7Service.sendMessage(hl7Message, endpoint);

    res.status(200).json({
      success: true,
      message: 'ADT discharge message sent successfully',
      messageType: 'ADT^A03',
    });
  } catch (error) {
    logger.error('Error sending ADT discharge message', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error sending ADT discharge message',
      error: error.message,
    });
  }
});

// Send patient transfer message
router.post('/adt/transfer', async (req, res) => {
  try {
    const { patientId, transferData, endpoint } = req.body;

    const adtMessage = {
      messageType: 'ADT',
      eventType: 'A02',
      sendingApplication: 'HOSPITAL_ERP',
      sendingFacility: 'MAIN_HOSPITAL',
      receivingApplication: 'EXTERNAL_SYSTEM',
      receivingFacility: 'EXTERNAL_FACILITY',
      patientId,
      patientName: transferData.patientName,
      dateOfBirth: transferData.dateOfBirth,
      gender: transferData.gender,
      roomNumber: transferData.newRoomNumber,
      attendingDoctor: transferData.attendingDoctor,
    };

    const hl7Message = hl7Service.buildHL7Message(adtMessage);
    await hl7Service.sendMessage(hl7Message, endpoint);

    res.status(200).json({
      success: true,
      message: 'ADT transfer message sent successfully',
      messageType: 'ADT^A02',
    });
  } catch (error) {
    logger.error('Error sending ADT transfer message', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error sending ADT transfer message',
      error: error.message,
    });
  }
});

// ORM (Order Management) Endpoints

// Send lab order
router.post('/orm/lab-order', async (req, res) => {
  try {
    const { patientId, orderData, endpoint } = req.body;

    const ormMessage = {
      messageType: 'ORM',
      eventType: 'O01',
      sendingApplication: 'HOSPITAL_ERP',
      sendingFacility: 'MAIN_HOSPITAL',
      receivingApplication: 'LAB_SYSTEM',
      receivingFacility: 'LAB_FACILITY',
      patientId,
      orderNumber: orderData.orderNumber,
      orderingProvider: orderData.orderingProvider,
      orderDateTime: orderData.orderDateTime,
      orderType: orderData.orderType,
      orderDescription: orderData.orderDescription,
      priority: orderData.priority || 'ROUTINE',
    };

    const hl7Message = hl7Service.buildHL7Message(ormMessage);
    await hl7Service.sendMessage(hl7Message, endpoint);

    res.status(200).json({
      success: true,
      message: 'ORM lab order sent successfully',
      orderNumber: orderData.orderNumber,
    });
  } catch (error) {
    logger.error('Error sending ORM lab order', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error sending ORM lab order',
      error: error.message,
    });
  }
});

// ORU (Observation Result) Endpoints

// Send lab results
router.post('/oru/lab-results', async (req, res) => {
  try {
    const { patientId, resultData, endpoint } = req.body;

    const oruMessage = {
      messageType: 'ORU',
      eventType: 'R01',
      sendingApplication: 'LAB_SYSTEM',
      sendingFacility: 'LAB_FACILITY',
      receivingApplication: 'HOSPITAL_ERP',
      receivingFacility: 'MAIN_HOSPITAL',
      patientId,
      orderNumber: resultData.orderNumber,
      observationDateTime: resultData.observationDateTime,
      resultStatus: resultData.resultStatus || 'F',
      observations: resultData.observations,
    };

    const hl7Message = hl7Service.buildHL7Message(oruMessage);
    await hl7Service.sendMessage(hl7Message, endpoint);

    res.status(200).json({
      success: true,
      message: 'ORU lab results sent successfully',
      orderNumber: resultData.orderNumber,
    });
  } catch (error) {
    logger.error('Error sending ORU lab results', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error sending ORU lab results',
      error: error.message,
    });
  }
});

// FHIR Integration Endpoints

// Convert HL7 to FHIR
router.post('/convert/hl7-to-fhir', async (req, res) => {
  try {
    const { hl7Message } = req.body;

    if (!hl7Message) {
      return res.status(400).json({
        success: false,
        message: 'HL7 message is required',
      });
    }

    const parsedMessage = hl7Service.parseHL7Message(hl7Message);
    
    // Convert based on message type
    let fhirResource;
    switch (parsedMessage.messageType) {
      case 'ADT':
        fhirResource = await convertADTToFHIR(parsedMessage);
        break;
      case 'ORU':
        fhirResource = await convertORUToFHIR(parsedMessage);
        break;
      default:
        throw new Error(`Conversion not supported for message type: ${parsedMessage.messageType}`);
    }

    res.status(200).json({
      success: true,
      message: 'HL7 message converted to FHIR successfully',
      fhirResource,
    });
  } catch (error) {
    logger.error('Error converting HL7 to FHIR', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error converting HL7 to FHIR',
      error: error.message,
    });
  }
});

// Convert FHIR to HL7
router.post('/convert/fhir-to-hl7', async (req, res) => {
  try {
    const { fhirResource, messageType } = req.body;

    if (!fhirResource || !messageType) {
      return res.status(400).json({
        success: false,
        message: 'FHIR resource and message type are required',
      });
    }

    // Convert based on FHIR resource type
    let hl7Message;
    switch (fhirResource.resourceType) {
      case 'Patient':
        hl7Message = await convertPatientToADT(fhirResource, messageType);
        break;
      case 'Observation':
        hl7Message = await convertObservationToORU(fhirResource);
        break;
      default:
        throw new Error(`Conversion not supported for FHIR resource type: ${fhirResource.resourceType}`);
    }

    res.status(200).json({
      success: true,
      message: 'FHIR resource converted to HL7 successfully',
      hl7Message,
    });
  } catch (error) {
    logger.error('Error converting FHIR to HL7', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error converting FHIR to HL7',
      error: error.message,
    });
  }
});

// Status and Monitoring Endpoints

// Get HL7 service status
router.get('/status', (req, res) => {
  try {
    res.status(200).json({
      success: true,
      status: 'active',
      timestamp: new Date().toISOString(),
      messageQueue: hl7Service.listenerCount('messageReceived'),
    });
  } catch (error) {
    logger.error('Error getting HL7 service status', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error getting HL7 service status',
      error: error.message,
    });
  }
});

// Helper Functions for Conversion

async function convertADTToFHIR(hl7Message: any): Promise<any> {
  const pidSegment = hl7Message.segments.find((s: any) => s.segmentType === 'PID');
  
  if (!pidSegment) {
    throw new Error('PID segment not found in ADT message');
  }

  const fhirPatient = {
    resourceType: 'Patient',
    id: pidSegment.fields[1],
    identifier: [
      {
        system: 'http://hospital.local/patient-id',
        value: pidSegment.fields[1],
      },
    ],
    name: [
      {
        family: pidSegment.fields[3]?.split('^')[0] || '',
        given: [pidSegment.fields[3]?.split('^')[1] || ''],
      },
    ],
    birthDate: pidSegment.fields[5],
    gender: pidSegment.fields[6] === 'M' ? 'male' : pidSegment.fields[6] === 'F' ? 'female' : 'unknown',
  };

  return fhirPatient;
}

async function convertORUToFHIR(hl7Message: any): Promise<any> {
  const obxSegments = hl7Message.segments.filter((s: any) => s.segmentType === 'OBX');
  
  const observations = obxSegments.map((obx: any, index: number) => ({
    resourceType: 'Observation',
    id: `obs-${index + 1}`,
    status: 'final',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: obx.fields[2],
          display: obx.fields[2],
        },
      ],
    },
    valueQuantity: {
      value: parseFloat(obx.fields[4]) || 0,
      unit: obx.fields[5],
    },
    referenceRange: [
      {
        text: obx.fields[6],
      },
    ],
  }));

  return observations;
}

async function convertPatientToADT(fhirPatient: any, eventType: string): Promise<string> {
  const adtMessage = {
    messageType: 'ADT',
    eventType,
    sendingApplication: 'HOSPITAL_ERP',
    sendingFacility: 'MAIN_HOSPITAL',
    receivingApplication: 'EXTERNAL_SYSTEM',
    receivingFacility: 'EXTERNAL_FACILITY',
    patientId: fhirPatient.id,
    patientName: `${fhirPatient.name?.[0]?.family || ''}^${fhirPatient.name?.[0]?.given?.[0] || ''}`,
    dateOfBirth: fhirPatient.birthDate,
    gender: fhirPatient.gender === 'male' ? 'M' : fhirPatient.gender === 'female' ? 'F' : 'U',
  };

  return hl7Service.buildHL7Message(adtMessage);
}

async function convertObservationToORU(fhirObservation: any): Promise<string> {
  const oruMessage = {
    messageType: 'ORU',
    eventType: 'R01',
    sendingApplication: 'LAB_SYSTEM',
    sendingFacility: 'LAB_FACILITY',
    receivingApplication: 'HOSPITAL_ERP',
    receivingFacility: 'MAIN_HOSPITAL',
    patientId: fhirObservation.subject?.reference?.split('/')[1] || 'UNKNOWN',
    orderNumber: `ORD${Date.now()}`,
    observationDateTime: new Date().toISOString(),
    resultStatus: 'F',
    observations: [
      {
        observationId: fhirObservation.code?.coding?.[0]?.code || 'UNKNOWN',
        observationValue: fhirObservation.valueQuantity?.value?.toString() || '',
        units: fhirObservation.valueQuantity?.unit || '',
        referenceRange: fhirObservation.referenceRange?.[0]?.text || '',
        abnormalFlags: '',
      },
    ],
  };

  return hl7Service.buildHL7Message(oruMessage);
}

export default router;