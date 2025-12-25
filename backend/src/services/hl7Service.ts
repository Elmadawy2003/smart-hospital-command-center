import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// HL7 Message Types
export interface HL7Message {
  messageType: string;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  timestamp: string;
  messageStructure: string;
  segments: HL7Segment[];
}

export interface HL7Segment {
  segmentType: string;
  fields: string[];
}

export interface ADTMessage {
  messageType: 'ADT';
  eventType: 'A01' | 'A02' | 'A03' | 'A04' | 'A08' | 'A11' | 'A12' | 'A13';
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  gender: string;
  admissionDate?: string;
  dischargeDate?: string;
  roomNumber?: string;
  attendingDoctor?: string;
}

export interface ORMMessage {
  messageType: 'ORM';
  eventType: 'O01';
  patientId: string;
  orderNumber: string;
  orderingProvider: string;
  orderDateTime: string;
  orderType: string;
  orderDescription: string;
  priority: 'STAT' | 'ASAP' | 'ROUTINE';
}

export interface ORUMessage {
  messageType: 'ORU';
  eventType: 'R01';
  patientId: string;
  orderNumber: string;
  observationDateTime: string;
  resultStatus: 'F' | 'P' | 'C' | 'X';
  observations: Array<{
    observationId: string;
    observationValue: string;
    units: string;
    referenceRange: string;
    abnormalFlags: string;
  }>;
}

export class HL7Service extends EventEmitter {
  private messageQueue: HL7Message[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startMessageProcessor();
  }

  // Message Parsing
  parseHL7Message(rawMessage: string): HL7Message {
    try {
      const lines = rawMessage.split('\r');
      const segments: HL7Segment[] = [];

      for (const line of lines) {
        if (line.trim()) {
          const fields = line.split('|');
          const segmentType = fields[0];
          segments.push({
            segmentType,
            fields: fields.slice(1),
          });
        }
      }

      const mshSegment = segments.find(s => s.segmentType === 'MSH');
      if (!mshSegment) {
        throw new Error('Invalid HL7 message: Missing MSH segment');
      }

      return {
        messageType: mshSegment.fields[7]?.split('^')[0] || '',
        messageControlId: mshSegment.fields[8] || '',
        sendingApplication: mshSegment.fields[1] || '',
        sendingFacility: mshSegment.fields[2] || '',
        receivingApplication: mshSegment.fields[3] || '',
        receivingFacility: mshSegment.fields[4] || '',
        timestamp: mshSegment.fields[5] || '',
        messageStructure: mshSegment.fields[7] || '',
        segments,
      };
    } catch (error) {
      logger.error('Error parsing HL7 message', { error: error.message });
      throw new Error('Failed to parse HL7 message');
    }
  }

  // Message Building
  buildHL7Message(messageData: any): string {
    try {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const messageControlId = this.generateMessageControlId();

      let hl7Message = '';

      // MSH Segment
      hl7Message += `MSH|^~\\&|${messageData.sendingApplication}|${messageData.sendingFacility}|${messageData.receivingApplication}|${messageData.receivingFacility}|${timestamp}||${messageData.messageType}^${messageData.eventType}|${messageControlId}|P|2.5\r`;

      // Add specific segments based on message type
      switch (messageData.messageType) {
        case 'ADT':
          hl7Message += this.buildADTSegments(messageData);
          break;
        case 'ORM':
          hl7Message += this.buildORMSegments(messageData);
          break;
        case 'ORU':
          hl7Message += this.buildORUSegments(messageData);
          break;
        default:
          throw new Error(`Unsupported message type: ${messageData.messageType}`);
      }

      return hl7Message;
    } catch (error) {
      logger.error('Error building HL7 message', { error: error.message });
      throw new Error('Failed to build HL7 message');
    }
  }

  private buildADTSegments(data: ADTMessage): string {
    let segments = '';

    // EVN Segment
    segments += `EVN|${data.eventType}|${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}\r`;

    // PID Segment
    segments += `PID|1||${data.patientId}||${data.patientName}||${data.dateOfBirth}|${data.gender}\r`;

    // PV1 Segment (if admission/discharge data available)
    if (data.admissionDate || data.dischargeDate || data.roomNumber) {
      segments += `PV1|1|I|${data.roomNumber || ''}||||||${data.attendingDoctor || ''}||||||||||||||||||||||||||||${data.admissionDate || ''}|${data.dischargeDate || ''}\r`;
    }

    return segments;
  }

  private buildORMSegments(data: ORMMessage): string {
    let segments = '';

    // PID Segment
    segments += `PID|1||${data.patientId}\r`;

    // ORC Segment
    segments += `ORC|NW|${data.orderNumber}||||||${data.orderDateTime}|||${data.orderingProvider}\r`;

    // OBR Segment
    segments += `OBR|1|${data.orderNumber}||${data.orderType}^${data.orderDescription}|${data.priority}|${data.orderDateTime}\r`;

    return segments;
  }

  private buildORUSegments(data: ORUMessage): string {
    let segments = '';

    // PID Segment
    segments += `PID|1||${data.patientId}\r`;

    // OBR Segment
    segments += `OBR|1|${data.orderNumber}||LAB^Laboratory|R|${data.observationDateTime}||||||||${data.observationDateTime}|||${data.resultStatus}\r`;

    // OBX Segments for each observation
    data.observations.forEach((obs, index) => {
      segments += `OBX|${index + 1}|NM|${obs.observationId}||${obs.observationValue}|${obs.units}|${obs.referenceRange}|${obs.abnormalFlags}|||${data.resultStatus}\r`;
    });

    return segments;
  }

  // Message Processing
  async processMessage(rawMessage: string): Promise<void> {
    try {
      const parsedMessage = this.parseHL7Message(rawMessage);
      this.messageQueue.push(parsedMessage);

      logger.info('HL7 message queued for processing', {
        messageType: parsedMessage.messageType,
        messageControlId: parsedMessage.messageControlId,
      });

      this.emit('messageReceived', parsedMessage);
    } catch (error) {
      logger.error('Error processing HL7 message', { error: error.message });
      this.emit('messageError', error);
    }
  }

  private startMessageProcessor(): void {
    this.processingInterval = setInterval(() => {
      if (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          this.handleMessage(message);
        }
      }
    }, 1000);
  }

  private async handleMessage(message: HL7Message): Promise<void> {
    try {
      logger.info('Processing HL7 message', {
        messageType: message.messageType,
        messageControlId: message.messageControlId,
      });

      switch (message.messageType) {
        case 'ADT':
          await this.handleADTMessage(message);
          break;
        case 'ORM':
          await this.handleORMMessage(message);
          break;
        case 'ORU':
          await this.handleORUMessage(message);
          break;
        default:
          logger.warn('Unsupported HL7 message type', { messageType: message.messageType });
      }

      this.emit('messageProcessed', message);
    } catch (error) {
      logger.error('Error handling HL7 message', {
        messageType: message.messageType,
        messageControlId: message.messageControlId,
        error: error.message,
      });
      this.emit('messageError', error);
    }
  }

  private async handleADTMessage(message: HL7Message): Promise<void> {
    // Extract patient information from ADT message
    const pidSegment = message.segments.find(s => s.segmentType === 'PID');
    const evnSegment = message.segments.find(s => s.segmentType === 'EVN');
    const pv1Segment = message.segments.find(s => s.segmentType === 'PV1');

    if (pidSegment && evnSegment) {
      const patientData = {
        patientId: pidSegment.fields[1],
        name: pidSegment.fields[3],
        dateOfBirth: pidSegment.fields[5],
        gender: pidSegment.fields[6],
        eventType: evnSegment.fields[0],
        admissionDate: pv1Segment?.fields[43],
        dischargeDate: pv1Segment?.fields[44],
        roomNumber: pv1Segment?.fields[2],
      };

      // Here you would typically update your patient database
      logger.info('ADT message processed', { patientData });
    }
  }

  private async handleORMMessage(message: HL7Message): Promise<void> {
    // Extract order information from ORM message
    const pidSegment = message.segments.find(s => s.segmentType === 'PID');
    const orcSegment = message.segments.find(s => s.segmentType === 'ORC');
    const obrSegment = message.segments.find(s => s.segmentType === 'OBR');

    if (pidSegment && orcSegment && obrSegment) {
      const orderData = {
        patientId: pidSegment.fields[1],
        orderNumber: orcSegment.fields[1],
        orderType: obrSegment.fields[3],
        orderDateTime: orcSegment.fields[7],
        orderingProvider: orcSegment.fields[10],
      };

      // Here you would typically create an order in your system
      logger.info('ORM message processed', { orderData });
    }
  }

  private async handleORUMessage(message: HL7Message): Promise<void> {
    // Extract result information from ORU message
    const pidSegment = message.segments.find(s => s.segmentType === 'PID');
    const obrSegment = message.segments.find(s => s.segmentType === 'OBR');
    const obxSegments = message.segments.filter(s => s.segmentType === 'OBX');

    if (pidSegment && obrSegment) {
      const resultData = {
        patientId: pidSegment.fields[1],
        orderNumber: obrSegment.fields[1],
        resultDateTime: obrSegment.fields[6],
        resultStatus: obrSegment.fields[24],
        observations: obxSegments.map(obx => ({
          observationId: obx.fields[2],
          value: obx.fields[4],
          units: obx.fields[5],
          referenceRange: obx.fields[6],
          abnormalFlags: obx.fields[7],
        })),
      };

      // Here you would typically store results in your system
      logger.info('ORU message processed', { resultData });
    }
  }

  // Utility Methods
  private generateMessageControlId(): string {
    return `MSG${Date.now()}${Math.random().toString(36).substr(2, 5)}`;
  }

  generateACK(originalMessage: HL7Message, status: 'AA' | 'AE' | 'AR' = 'AA'): string {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const ackControlId = this.generateMessageControlId();

    let ack = `MSH|^~\\&|${originalMessage.receivingApplication}|${originalMessage.receivingFacility}|${originalMessage.sendingApplication}|${originalMessage.sendingFacility}|${timestamp}||ACK|${ackControlId}|P|2.5\r`;
    ack += `MSA|${status}|${originalMessage.messageControlId}\r`;

    return ack;
  }

  // Connection Management
  async sendMessage(message: string, endpoint: string): Promise<void> {
    try {
      // This would typically send the message to an external system
      // Implementation depends on the specific transport mechanism (TCP, HTTP, etc.)
      logger.info('Sending HL7 message', { endpoint, messageLength: message.length });
      
      // Placeholder for actual sending logic
      // await this.transportLayer.send(message, endpoint);
      
      logger.info('HL7 message sent successfully', { endpoint });
    } catch (error) {
      logger.error('Error sending HL7 message', { endpoint, error: error.message });
      throw error;
    }
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

export const hl7Service = new HL7Service();