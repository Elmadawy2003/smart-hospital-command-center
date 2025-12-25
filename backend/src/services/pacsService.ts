import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

// DICOM Interfaces
export interface DICOMTag {
  tag: string;
  vr: string; // Value Representation
  value: any;
  description: string;
}

export interface DICOMMetadata {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  patientID: string;
  patientName: string;
  studyDate: string;
  studyTime: string;
  modality: string;
  bodyPart: string;
  studyDescription: string;
  seriesDescription: string;
  institutionName: string;
  referringPhysician: string;
  performingPhysician: string;
  imageType: string;
  rows: number;
  columns: number;
  pixelSpacing: number[];
  sliceThickness?: number;
  numberOfFrames?: number;
  tags: DICOMTag[];
}

export interface StudyInfo {
  studyInstanceUID: string;
  patientID: string;
  patientName: string;
  studyDate: string;
  studyTime: string;
  studyDescription: string;
  modality: string[];
  numberOfSeries: number;
  numberOfImages: number;
  referringPhysician: string;
  accessionNumber: string;
  status: 'pending' | 'in_progress' | 'completed' | 'reported';
  createdAt: Date;
  updatedAt: Date;
}

export interface SeriesInfo {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  bodyPart: string;
  numberOfImages: number;
  seriesDate: string;
  seriesTime: string;
  performingPhysician: string;
  protocolName: string;
  imageOrientationPatient: number[];
  pixelSpacing: number[];
  sliceThickness?: number;
}

export interface ImageInfo {
  sopInstanceUID: string;
  seriesInstanceUID: string;
  instanceNumber: number;
  imageType: string;
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  pixelRepresentation: number;
  photometricInterpretation: string;
  imagePosition: number[];
  imageOrientation: number[];
  pixelData: string; // Base64 encoded or file path
  windowCenter?: number;
  windowWidth?: number;
  rescaleIntercept?: number;
  rescaleSlope?: number;
}

export interface WorklistItem {
  accessionNumber: string;
  patientID: string;
  patientName: string;
  patientBirthDate: string;
  patientSex: string;
  studyInstanceUID: string;
  studyDescription: string;
  modality: string;
  scheduledDateTime: Date;
  requestingPhysician: string;
  performingPhysician?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'routine' | 'urgent' | 'stat';
  bodyPart: string;
  procedureCode: string;
  procedureDescription: string;
}

export interface PACSQuery {
  patientID?: string;
  patientName?: string;
  studyDate?: string;
  studyDateRange?: { from: string; to: string };
  modality?: string;
  accessionNumber?: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  referringPhysician?: string;
  studyDescription?: string;
  limit?: number;
  offset?: number;
}

export interface ViewerSession {
  sessionId: string;
  userId: string;
  studyInstanceUID: string;
  seriesInstanceUIDs: string[];
  viewerType: 'basic' | 'advanced' | 'mpr' | '3d';
  layout: string;
  windowLevel: { center: number; width: number };
  zoom: number;
  pan: { x: number; y: number };
  rotation: number;
  annotations: any[];
  measurements: any[];
  createdAt: Date;
  lastAccessed: Date;
}

export interface AnnotationTool {
  id: string;
  type: 'arrow' | 'circle' | 'rectangle' | 'freehand' | 'text' | 'ruler' | 'angle';
  coordinates: number[];
  text?: string;
  color: string;
  thickness: number;
  createdBy: string;
  createdAt: Date;
}

export interface MeasurementTool {
  id: string;
  type: 'length' | 'area' | 'volume' | 'angle' | 'density';
  coordinates: number[];
  value: number;
  unit: string;
  createdBy: string;
  createdAt: Date;
}

export class PACSService {
  private studies: Map<string, StudyInfo> = new Map();
  private series: Map<string, SeriesInfo> = new Map();
  private images: Map<string, ImageInfo> = new Map();
  private worklist: Map<string, WorklistItem> = new Map();
  private viewerSessions: Map<string, ViewerSession> = new Map();
  private storageBasePath: string = './pacs_storage';

  constructor() {
    this.initializeStorage();
    this.initializeSampleData();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.storageBasePath, { recursive: true });
      await fs.mkdir(path.join(this.storageBasePath, 'studies'), { recursive: true });
      await fs.mkdir(path.join(this.storageBasePath, 'series'), { recursive: true });
      await fs.mkdir(path.join(this.storageBasePath, 'images'), { recursive: true });
    } catch (error) {
      console.error('Error initializing PACS storage:', error);
    }
  }

  private initializeSampleData(): void {
    // Sample study
    const studyUID = '1.2.840.113619.2.176.2025.1.1.1';
    const study: StudyInfo = {
      studyInstanceUID: studyUID,
      patientID: 'PAT001',
      patientName: 'John Doe',
      studyDate: '20250101',
      studyTime: '120000',
      studyDescription: 'Chest CT',
      modality: ['CT'],
      numberOfSeries: 2,
      numberOfImages: 150,
      referringPhysician: 'Dr. Smith',
      accessionNumber: 'ACC001',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.studies.set(studyUID, study);

    // Sample series
    const seriesUID = '1.2.840.113619.2.176.2025.1.1.1.1';
    const series: SeriesInfo = {
      seriesInstanceUID: seriesUID,
      studyInstanceUID: studyUID,
      seriesNumber: 1,
      seriesDescription: 'Axial CT',
      modality: 'CT',
      bodyPart: 'CHEST',
      numberOfImages: 75,
      seriesDate: '20250101',
      seriesTime: '120000',
      performingPhysician: 'Dr. Johnson',
      protocolName: 'Chest CT Protocol',
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      pixelSpacing: [0.5, 0.5],
      sliceThickness: 1.0
    };
    this.series.set(seriesUID, series);

    // Sample worklist item
    const worklistItem: WorklistItem = {
      accessionNumber: 'ACC002',
      patientID: 'PAT002',
      patientName: 'Jane Smith',
      patientBirthDate: '19850315',
      patientSex: 'F',
      studyInstanceUID: '1.2.840.113619.2.176.2025.1.1.2',
      studyDescription: 'Brain MRI',
      modality: 'MR',
      scheduledDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      requestingPhysician: 'Dr. Brown',
      status: 'scheduled',
      priority: 'routine',
      bodyPart: 'HEAD',
      procedureCode: 'MR001',
      procedureDescription: 'Brain MRI with contrast'
    };
    this.worklist.set('ACC002', worklistItem);
  }

  // Study Management
  async storeStudy(dicomMetadata: DICOMMetadata, imageData: Buffer): Promise<string> {
    const studyUID = dicomMetadata.studyInstanceUID;
    const seriesUID = dicomMetadata.seriesInstanceUID;
    const sopUID = dicomMetadata.sopInstanceUID;

    // Store or update study info
    if (!this.studies.has(studyUID)) {
      const study: StudyInfo = {
        studyInstanceUID: studyUID,
        patientID: dicomMetadata.patientID,
        patientName: dicomMetadata.patientName,
        studyDate: dicomMetadata.studyDate,
        studyTime: dicomMetadata.studyTime,
        studyDescription: dicomMetadata.studyDescription,
        modality: [dicomMetadata.modality],
        numberOfSeries: 1,
        numberOfImages: 1,
        referringPhysician: dicomMetadata.referringPhysician,
        accessionNumber: `ACC_${Date.now()}`,
        status: 'in_progress',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.studies.set(studyUID, study);
    }

    // Store or update series info
    if (!this.series.has(seriesUID)) {
      const series: SeriesInfo = {
        seriesInstanceUID: seriesUID,
        studyInstanceUID: studyUID,
        seriesNumber: 1,
        seriesDescription: dicomMetadata.seriesDescription,
        modality: dicomMetadata.modality,
        bodyPart: dicomMetadata.bodyPart,
        numberOfImages: 1,
        seriesDate: dicomMetadata.studyDate,
        seriesTime: dicomMetadata.studyTime,
        performingPhysician: dicomMetadata.performingPhysician,
        protocolName: 'Standard Protocol',
        imageOrientationPatient: [1, 0, 0, 0, 1, 0],
        pixelSpacing: dicomMetadata.pixelSpacing,
        sliceThickness: dicomMetadata.sliceThickness
      };
      this.series.set(seriesUID, series);
    }

    // Store image
    const imagePath = path.join(this.storageBasePath, 'images', `${sopUID}.dcm`);
    await fs.writeFile(imagePath, imageData);

    const image: ImageInfo = {
      sopInstanceUID: sopUID,
      seriesInstanceUID: seriesUID,
      instanceNumber: 1,
      imageType: dicomMetadata.imageType,
      rows: dicomMetadata.rows,
      columns: dicomMetadata.columns,
      bitsAllocated: 16,
      bitsStored: 16,
      pixelRepresentation: 0,
      photometricInterpretation: 'MONOCHROME2',
      imagePosition: [0, 0, 0],
      imageOrientation: [1, 0, 0, 0, 1, 0],
      pixelData: imagePath
    };
    this.images.set(sopUID, image);

    return sopUID;
  }

  async queryStudies(query: PACSQuery): Promise<StudyInfo[]> {
    let results = Array.from(this.studies.values());

    if (query.patientID) {
      results = results.filter(study => 
        study.patientID.toLowerCase().includes(query.patientID!.toLowerCase())
      );
    }

    if (query.patientName) {
      results = results.filter(study => 
        study.patientName.toLowerCase().includes(query.patientName!.toLowerCase())
      );
    }

    if (query.studyDate) {
      results = results.filter(study => study.studyDate === query.studyDate);
    }

    if (query.studyDateRange) {
      results = results.filter(study => 
        study.studyDate >= query.studyDateRange!.from && 
        study.studyDate <= query.studyDateRange!.to
      );
    }

    if (query.modality) {
      results = results.filter(study => 
        study.modality.includes(query.modality!)
      );
    }

    if (query.accessionNumber) {
      results = results.filter(study => 
        study.accessionNumber.includes(query.accessionNumber!)
      );
    }

    if (query.studyInstanceUID) {
      results = results.filter(study => 
        study.studyInstanceUID === query.studyInstanceUID
      );
    }

    if (query.referringPhysician) {
      results = results.filter(study => 
        study.referringPhysician.toLowerCase().includes(query.referringPhysician!.toLowerCase())
      );
    }

    if (query.studyDescription) {
      results = results.filter(study => 
        study.studyDescription.toLowerCase().includes(query.studyDescription!.toLowerCase())
      );
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    
    return results.slice(offset, offset + limit);
  }

  async getStudyDetails(studyInstanceUID: string): Promise<StudyInfo | null> {
    return this.studies.get(studyInstanceUID) || null;
  }

  async getStudySeries(studyInstanceUID: string): Promise<SeriesInfo[]> {
    return Array.from(this.series.values()).filter(
      series => series.studyInstanceUID === studyInstanceUID
    );
  }

  async getSeriesImages(seriesInstanceUID: string): Promise<ImageInfo[]> {
    return Array.from(this.images.values()).filter(
      image => image.seriesInstanceUID === seriesInstanceUID
    );
  }

  async getImageData(sopInstanceUID: string): Promise<Buffer | null> {
    const image = this.images.get(sopInstanceUID);
    if (!image) return null;

    try {
      return await fs.readFile(image.pixelData);
    } catch (error) {
      console.error('Error reading image data:', error);
      return null;
    }
  }

  // Worklist Management
  async getWorklist(modality?: string, date?: string): Promise<WorklistItem[]> {
    let items = Array.from(this.worklist.values());

    if (modality) {
      items = items.filter(item => item.modality === modality);
    }

    if (date) {
      items = items.filter(item => 
        item.scheduledDateTime.toISOString().split('T')[0] === date
      );
    }

    return items.sort((a, b) => a.scheduledDateTime.getTime() - b.scheduledDateTime.getTime());
  }

  async addWorklistItem(item: Omit<WorklistItem, 'studyInstanceUID'>): Promise<string> {
    const studyUID = `1.2.840.113619.2.176.${Date.now()}.${Math.random()}`;
    const worklistItem: WorklistItem = {
      ...item,
      studyInstanceUID: studyUID
    };
    
    this.worklist.set(item.accessionNumber, worklistItem);
    return studyUID;
  }

  async updateWorklistStatus(accessionNumber: string, status: WorklistItem['status']): Promise<boolean> {
    const item = this.worklist.get(accessionNumber);
    if (!item) return false;

    item.status = status;
    this.worklist.set(accessionNumber, item);
    return true;
  }

  // Viewer Session Management
  async createViewerSession(
    userId: string, 
    studyInstanceUID: string, 
    seriesInstanceUIDs: string[]
  ): Promise<string> {
    const sessionId = uuidv4();
    const session: ViewerSession = {
      sessionId,
      userId,
      studyInstanceUID,
      seriesInstanceUIDs,
      viewerType: 'basic',
      layout: '1x1',
      windowLevel: { center: 40, width: 400 },
      zoom: 1.0,
      pan: { x: 0, y: 0 },
      rotation: 0,
      annotations: [],
      measurements: [],
      createdAt: new Date(),
      lastAccessed: new Date()
    };

    this.viewerSessions.set(sessionId, session);
    return sessionId;
  }

  async getViewerSession(sessionId: string): Promise<ViewerSession | null> {
    const session = this.viewerSessions.get(sessionId);
    if (session) {
      session.lastAccessed = new Date();
      this.viewerSessions.set(sessionId, session);
    }
    return session || null;
  }

  async updateViewerSession(sessionId: string, updates: Partial<ViewerSession>): Promise<boolean> {
    const session = this.viewerSessions.get(sessionId);
    if (!session) return false;

    Object.assign(session, updates, { lastAccessed: new Date() });
    this.viewerSessions.set(sessionId, session);
    return true;
  }

  async addAnnotation(sessionId: string, annotation: AnnotationTool): Promise<boolean> {
    const session = this.viewerSessions.get(sessionId);
    if (!session) return false;

    session.annotations.push(annotation);
    session.lastAccessed = new Date();
    this.viewerSessions.set(sessionId, session);
    return true;
  }

  async addMeasurement(sessionId: string, measurement: MeasurementTool): Promise<boolean> {
    const session = this.viewerSessions.get(sessionId);
    if (!session) return false;

    session.measurements.push(measurement);
    session.lastAccessed = new Date();
    this.viewerSessions.set(sessionId, session);
    return true;
  }

  // DICOM Utilities
  parseDICOMTags(buffer: Buffer): DICOMTag[] {
    // Simplified DICOM tag parsing - in real implementation, use a proper DICOM library
    const tags: DICOMTag[] = [];
    
    // Sample tags for demonstration
    tags.push({
      tag: '(0010,0010)',
      vr: 'PN',
      value: 'Sample Patient',
      description: 'Patient Name'
    });

    tags.push({
      tag: '(0020,000D)',
      vr: 'UI',
      value: '1.2.840.113619.2.176.2025.1.1.1',
      description: 'Study Instance UID'
    });

    return tags;
  }

  generateDICOMMetadata(tags: DICOMTag[]): Partial<DICOMMetadata> {
    const metadata: Partial<DICOMMetadata> = {};
    
    tags.forEach(tag => {
      switch (tag.tag) {
        case '(0010,0020)':
          metadata.patientID = tag.value;
          break;
        case '(0010,0010)':
          metadata.patientName = tag.value;
          break;
        case '(0020,000D)':
          metadata.studyInstanceUID = tag.value;
          break;
        case '(0020,000E)':
          metadata.seriesInstanceUID = tag.value;
          break;
        case '(0008,0018)':
          metadata.sopInstanceUID = tag.value;
          break;
        case '(0008,0020)':
          metadata.studyDate = tag.value;
          break;
        case '(0008,0030)':
          metadata.studyTime = tag.value;
          break;
        case '(0008,0060)':
          metadata.modality = tag.value;
          break;
        case '(0018,0015)':
          metadata.bodyPart = tag.value;
          break;
      }
    });

    return metadata;
  }

  // Statistics and Analytics
  async getPACSStatistics(): Promise<any> {
    const totalStudies = this.studies.size;
    const totalSeries = this.series.size;
    const totalImages = this.images.size;
    const totalWorklist = this.worklist.size;

    const modalityStats = new Map<string, number>();
    Array.from(this.studies.values()).forEach(study => {
      study.modality.forEach(mod => {
        modalityStats.set(mod, (modalityStats.get(mod) || 0) + 1);
      });
    });

    const statusStats = new Map<string, number>();
    Array.from(this.studies.values()).forEach(study => {
      statusStats.set(study.status, (statusStats.get(study.status) || 0) + 1);
    });

    return {
      totalStudies,
      totalSeries,
      totalImages,
      totalWorklist,
      modalityDistribution: Object.fromEntries(modalityStats),
      statusDistribution: Object.fromEntries(statusStats),
      storageUsage: await this.calculateStorageUsage(),
      activeViewerSessions: this.viewerSessions.size
    };
  }

  private async calculateStorageUsage(): Promise<{ totalSize: number; formattedSize: string }> {
    // Simplified storage calculation
    const totalSize = this.images.size * 1024 * 1024; // Assume 1MB per image
    const formattedSize = this.formatBytes(totalSize);
    
    return { totalSize, formattedSize };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default PACSService;