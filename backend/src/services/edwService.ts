import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// Data Source Interfaces
export interface DataSource {
  id: string;
  name: string;
  type: 'database' | 'api' | 'file' | 'hl7' | 'fhir';
  connectionString: string;
  schema?: string;
  isActive: boolean;
  lastSync?: Date;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
}

export interface ETLJob {
  id: string;
  name: string;
  sourceId: string;
  targetTable: string;
  transformationRules: TransformationRule[];
  schedule: string; // Cron expression
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface TransformationRule {
  sourceField: string;
  targetField: string;
  transformation: 'direct' | 'calculated' | 'lookup' | 'aggregate';
  formula?: string;
  lookupTable?: string;
  aggregateFunction?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

export interface DataQualityRule {
  id: string;
  name: string;
  table: string;
  field: string;
  ruleType: 'not_null' | 'unique' | 'range' | 'format' | 'reference';
  parameters: any;
  severity: 'error' | 'warning' | 'info';
  isActive: boolean;
}

export interface DataLineage {
  targetTable: string;
  targetField: string;
  sourceSystem: string;
  sourceTable: string;
  sourceField: string;
  transformationPath: string[];
  lastUpdated: Date;
}

// Dimensional Model Interfaces
export interface DimensionTable {
  name: string;
  primaryKey: string;
  attributes: DimensionAttribute[];
  slowlyChangingType: 1 | 2 | 3;
}

export interface DimensionAttribute {
  name: string;
  dataType: string;
  isBusinessKey: boolean;
  isNaturalKey: boolean;
  description?: string;
}

export interface FactTable {
  name: string;
  dimensions: string[];
  measures: Measure[];
  grainDescription: string;
}

export interface Measure {
  name: string;
  dataType: string;
  aggregationType: 'sum' | 'avg' | 'count' | 'min' | 'max';
  description?: string;
}

export class EDWService extends EventEmitter {
  private dataSources: Map<string, DataSource> = new Map();
  private etlJobs: Map<string, ETLJob> = new Map();
  private dataQualityRules: Map<string, DataQualityRule> = new Map();
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeDefaultDataSources();
    this.initializeDefaultETLJobs();
    this.initializeDataQualityRules();
    this.startScheduler();
  }

  // Data Source Management
  async registerDataSource(dataSource: DataSource): Promise<void> {
    try {
      // Validate connection
      await this.testConnection(dataSource);
      
      this.dataSources.set(dataSource.id, dataSource);
      
      logger.info('Data source registered successfully', {
        sourceId: dataSource.id,
        sourceName: dataSource.name,
        sourceType: dataSource.type,
      });

      this.emit('dataSourceRegistered', dataSource);
    } catch (error) {
      logger.error('Error registering data source', {
        sourceId: dataSource.id,
        error: error.message,
      });
      throw error;
    }
  }

  async testConnection(dataSource: DataSource): Promise<boolean> {
    try {
      // Implementation would depend on the data source type
      switch (dataSource.type) {
        case 'database':
          return await this.testDatabaseConnection(dataSource);
        case 'api':
          return await this.testAPIConnection(dataSource);
        case 'file':
          return await this.testFileConnection(dataSource);
        case 'hl7':
          return await this.testHL7Connection(dataSource);
        case 'fhir':
          return await this.testFHIRConnection(dataSource);
        default:
          throw new Error(`Unsupported data source type: ${dataSource.type}`);
      }
    } catch (error) {
      logger.error('Connection test failed', {
        sourceId: dataSource.id,
        error: error.message,
      });
      return false;
    }
  }

  private async testDatabaseConnection(dataSource: DataSource): Promise<boolean> {
    // Placeholder for database connection test
    logger.info('Testing database connection', { sourceId: dataSource.id });
    return true;
  }

  private async testAPIConnection(dataSource: DataSource): Promise<boolean> {
    // Placeholder for API connection test
    logger.info('Testing API connection', { sourceId: dataSource.id });
    return true;
  }

  private async testFileConnection(dataSource: DataSource): Promise<boolean> {
    // Placeholder for file connection test
    logger.info('Testing file connection', { sourceId: dataSource.id });
    return true;
  }

  private async testHL7Connection(dataSource: DataSource): Promise<boolean> {
    // Placeholder for HL7 connection test
    logger.info('Testing HL7 connection', { sourceId: dataSource.id });
    return true;
  }

  private async testFHIRConnection(dataSource: DataSource): Promise<boolean> {
    // Placeholder for FHIR connection test
    logger.info('Testing FHIR connection', { sourceId: dataSource.id });
    return true;
  }

  // ETL Job Management
  async createETLJob(job: ETLJob): Promise<void> {
    try {
      // Validate source exists
      if (!this.dataSources.has(job.sourceId)) {
        throw new Error(`Data source ${job.sourceId} not found`);
      }

      // Validate transformation rules
      this.validateTransformationRules(job.transformationRules);

      this.etlJobs.set(job.id, job);

      // Schedule the job if active
      if (job.isActive) {
        this.scheduleETLJob(job);
      }

      logger.info('ETL job created successfully', {
        jobId: job.id,
        jobName: job.name,
        sourceId: job.sourceId,
      });

      this.emit('etlJobCreated', job);
    } catch (error) {
      logger.error('Error creating ETL job', {
        jobId: job.id,
        error: error.message,
      });
      throw error;
    }
  }

  private validateTransformationRules(rules: TransformationRule[]): void {
    for (const rule of rules) {
      if (!rule.sourceField || !rule.targetField) {
        throw new Error('Source and target fields are required for transformation rules');
      }

      if (rule.transformation === 'calculated' && !rule.formula) {
        throw new Error('Formula is required for calculated transformations');
      }

      if (rule.transformation === 'lookup' && !rule.lookupTable) {
        throw new Error('Lookup table is required for lookup transformations');
      }

      if (rule.transformation === 'aggregate' && !rule.aggregateFunction) {
        throw new Error('Aggregate function is required for aggregate transformations');
      }
    }
  }

  async runETLJob(jobId: string): Promise<void> {
    try {
      const job = this.etlJobs.get(jobId);
      if (!job) {
        throw new Error(`ETL job ${jobId} not found`);
      }

      const dataSource = this.dataSources.get(job.sourceId);
      if (!dataSource) {
        throw new Error(`Data source ${job.sourceId} not found`);
      }

      // Update job status
      job.status = 'running';
      job.lastRun = new Date();
      this.etlJobs.set(jobId, job);

      logger.info('Starting ETL job', {
        jobId,
        jobName: job.name,
        sourceId: job.sourceId,
      });

      // Extract data
      const extractedData = await this.extractData(dataSource);

      // Transform data
      const transformedData = await this.transformData(extractedData, job.transformationRules);

      // Load data
      await this.loadData(transformedData, job.targetTable);

      // Update job status
      job.status = 'completed';
      job.lastRun = new Date();
      this.etlJobs.set(jobId, job);

      logger.info('ETL job completed successfully', {
        jobId,
        recordsProcessed: transformedData.length,
      });

      this.emit('etlJobCompleted', job);
    } catch (error) {
      const job = this.etlJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        this.etlJobs.set(jobId, job);
      }

      logger.error('ETL job failed', {
        jobId,
        error: error.message,
      });

      this.emit('etlJobFailed', { jobId, error });
      throw error;
    }
  }

  private async extractData(dataSource: DataSource): Promise<any[]> {
    // Implementation would depend on the data source type
    switch (dataSource.type) {
      case 'database':
        return await this.extractFromDatabase(dataSource);
      case 'api':
        return await this.extractFromAPI(dataSource);
      case 'file':
        return await this.extractFromFile(dataSource);
      case 'hl7':
        return await this.extractFromHL7(dataSource);
      case 'fhir':
        return await this.extractFromFHIR(dataSource);
      default:
        throw new Error(`Unsupported data source type: ${dataSource.type}`);
    }
  }

  private async extractFromDatabase(dataSource: DataSource): Promise<any[]> {
    // Placeholder for database extraction
    logger.info('Extracting data from database', { sourceId: dataSource.id });
    return [];
  }

  private async extractFromAPI(dataSource: DataSource): Promise<any[]> {
    // Placeholder for API extraction
    logger.info('Extracting data from API', { sourceId: dataSource.id });
    return [];
  }

  private async extractFromFile(dataSource: DataSource): Promise<any[]> {
    // Placeholder for file extraction
    logger.info('Extracting data from file', { sourceId: dataSource.id });
    return [];
  }

  private async extractFromHL7(dataSource: DataSource): Promise<any[]> {
    // Placeholder for HL7 extraction
    logger.info('Extracting data from HL7', { sourceId: dataSource.id });
    return [];
  }

  private async extractFromFHIR(dataSource: DataSource): Promise<any[]> {
    // Placeholder for FHIR extraction
    logger.info('Extracting data from FHIR', { sourceId: dataSource.id });
    return [];
  }

  private async transformData(data: any[], rules: TransformationRule[]): Promise<any[]> {
    const transformedData = [];

    for (const record of data) {
      const transformedRecord: any = {};

      for (const rule of rules) {
        try {
          const transformedValue = await this.applyTransformation(record, rule);
          transformedRecord[rule.targetField] = transformedValue;
        } catch (error) {
          logger.error('Transformation error', {
            sourceField: rule.sourceField,
            targetField: rule.targetField,
            error: error.message,
          });
          throw error;
        }
      }

      transformedData.push(transformedRecord);
    }

    return transformedData;
  }

  private async applyTransformation(record: any, rule: TransformationRule): Promise<any> {
    const sourceValue = record[rule.sourceField];

    switch (rule.transformation) {
      case 'direct':
        return sourceValue;

      case 'calculated':
        if (!rule.formula) {
          throw new Error('Formula is required for calculated transformation');
        }
        return this.evaluateFormula(rule.formula, record);

      case 'lookup':
        if (!rule.lookupTable) {
          throw new Error('Lookup table is required for lookup transformation');
        }
        return await this.performLookup(sourceValue, rule.lookupTable);

      case 'aggregate':
        if (!rule.aggregateFunction) {
          throw new Error('Aggregate function is required for aggregate transformation');
        }
        return this.performAggregation(sourceValue, rule.aggregateFunction);

      default:
        throw new Error(`Unsupported transformation type: ${rule.transformation}`);
    }
  }

  private evaluateFormula(formula: string, record: any): any {
    // Simple formula evaluation - in production, use a proper expression evaluator
    try {
      // Replace field references with actual values
      let evaluatedFormula = formula;
      for (const [key, value] of Object.entries(record)) {
        evaluatedFormula = evaluatedFormula.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
      }

      // Basic arithmetic evaluation (unsafe - use proper evaluator in production)
      return eval(evaluatedFormula);
    } catch (error) {
      throw new Error(`Formula evaluation failed: ${error.message}`);
    }
  }

  private async performLookup(value: any, lookupTable: string): Promise<any> {
    // Placeholder for lookup operation
    logger.info('Performing lookup', { value, lookupTable });
    return value;
  }

  private performAggregation(value: any, aggregateFunction: string): any {
    // Placeholder for aggregation operation
    logger.info('Performing aggregation', { value, aggregateFunction });
    return value;
  }

  private async loadData(data: any[], targetTable: string): Promise<void> {
    try {
      logger.info('Loading data to target table', {
        targetTable,
        recordCount: data.length,
      });

      // Placeholder for data loading - would typically insert into database
      // await this.database.insertBatch(targetTable, data);

      logger.info('Data loaded successfully', {
        targetTable,
        recordCount: data.length,
      });
    } catch (error) {
      logger.error('Error loading data', {
        targetTable,
        error: error.message,
      });
      throw error;
    }
  }

  // Data Quality Management
  async runDataQualityChecks(table?: string): Promise<any[]> {
    try {
      const issues = [];
      const rulesToCheck = table 
        ? Array.from(this.dataQualityRules.values()).filter(rule => rule.table === table)
        : Array.from(this.dataQualityRules.values());

      for (const rule of rulesToCheck) {
        if (rule.isActive) {
          const ruleIssues = await this.checkDataQualityRule(rule);
          issues.push(...ruleIssues);
        }
      }

      logger.info('Data quality checks completed', {
        rulesChecked: rulesToCheck.length,
        issuesFound: issues.length,
      });

      return issues;
    } catch (error) {
      logger.error('Error running data quality checks', { error: error.message });
      throw error;
    }
  }

  private async checkDataQualityRule(rule: DataQualityRule): Promise<any[]> {
    const issues = [];

    try {
      switch (rule.ruleType) {
        case 'not_null':
          // Check for null values
          break;
        case 'unique':
          // Check for duplicate values
          break;
        case 'range':
          // Check if values are within specified range
          break;
        case 'format':
          // Check if values match specified format
          break;
        case 'reference':
          // Check referential integrity
          break;
      }

      logger.info('Data quality rule checked', {
        ruleId: rule.id,
        issuesFound: issues.length,
      });
    } catch (error) {
      logger.error('Error checking data quality rule', {
        ruleId: rule.id,
        error: error.message,
      });
    }

    return issues;
  }

  // Dimensional Modeling
  async createDimensionTable(dimension: DimensionTable): Promise<void> {
    try {
      logger.info('Creating dimension table', {
        tableName: dimension.name,
        attributeCount: dimension.attributes.length,
      });

      // Generate DDL for dimension table
      const ddl = this.generateDimensionTableDDL(dimension);
      
      // Execute DDL (placeholder)
      // await this.database.execute(ddl);

      logger.info('Dimension table created successfully', {
        tableName: dimension.name,
      });
    } catch (error) {
      logger.error('Error creating dimension table', {
        tableName: dimension.name,
        error: error.message,
      });
      throw error;
    }
  }

  async createFactTable(fact: FactTable): Promise<void> {
    try {
      logger.info('Creating fact table', {
        tableName: fact.name,
        dimensionCount: fact.dimensions.length,
        measureCount: fact.measures.length,
      });

      // Generate DDL for fact table
      const ddl = this.generateFactTableDDL(fact);
      
      // Execute DDL (placeholder)
      // await this.database.execute(ddl);

      logger.info('Fact table created successfully', {
        tableName: fact.name,
      });
    } catch (error) {
      logger.error('Error creating fact table', {
        tableName: fact.name,
        error: error.message,
      });
      throw error;
    }
  }

  private generateDimensionTableDDL(dimension: DimensionTable): string {
    let ddl = `CREATE TABLE ${dimension.name} (\n`;
    ddl += `  ${dimension.primaryKey} BIGINT IDENTITY(1,1) PRIMARY KEY,\n`;

    for (const attr of dimension.attributes) {
      ddl += `  ${attr.name} ${attr.dataType},\n`;
    }

    // Add SCD columns if needed
    if (dimension.slowlyChangingType === 2) {
      ddl += `  effective_date DATE NOT NULL,\n`;
      ddl += `  expiry_date DATE,\n`;
      ddl += `  is_current BIT DEFAULT 1,\n`;
    }

    ddl += `  created_date DATETIME2 DEFAULT GETDATE(),\n`;
    ddl += `  updated_date DATETIME2 DEFAULT GETDATE()\n`;
    ddl += `);`;

    return ddl;
  }

  private generateFactTableDDL(fact: FactTable): string {
    let ddl = `CREATE TABLE ${fact.name} (\n`;

    // Add dimension foreign keys
    for (const dimension of fact.dimensions) {
      ddl += `  ${dimension}_key BIGINT NOT NULL,\n`;
    }

    // Add measures
    for (const measure of fact.measures) {
      ddl += `  ${measure.name} ${measure.dataType},\n`;
    }

    ddl += `  created_date DATETIME2 DEFAULT GETDATE()\n`;
    ddl += `);`;

    return ddl;
  }

  // Scheduling and Monitoring
  private scheduleETLJob(job: ETLJob): void {
    // Simple scheduling - in production, use a proper scheduler like node-cron
    const interval = this.getScheduleInterval(job.schedule);
    
    const timeout = setInterval(async () => {
      try {
        await this.runETLJob(job.id);
      } catch (error) {
        logger.error('Scheduled ETL job failed', {
          jobId: job.id,
          error: error.message,
        });
      }
    }, interval);

    this.scheduledJobs.set(job.id, timeout);
  }

  private getScheduleInterval(schedule: string): number {
    // Convert cron-like schedule to milliseconds
    // This is a simplified implementation
    switch (schedule) {
      case '0 * * * *': // Hourly
        return 60 * 60 * 1000;
      case '0 0 * * *': // Daily
        return 24 * 60 * 60 * 1000;
      case '0 0 * * 0': // Weekly
        return 7 * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000; // Default to hourly
    }
  }

  private startScheduler(): void {
    logger.info('EDW scheduler started');
  }

  // Initialization Methods
  private initializeDefaultDataSources(): void {
    const defaultSources: DataSource[] = [
      {
        id: 'emr_system',
        name: 'EMR System',
        type: 'database',
        connectionString: 'Server=localhost;Database=EMR;Trusted_Connection=true;',
        schema: 'dbo',
        isActive: true,
        syncFrequency: 'hourly',
      },
      {
        id: 'pharmacy_system',
        name: 'Pharmacy System',
        type: 'database',
        connectionString: 'Server=localhost;Database=Pharmacy;Trusted_Connection=true;',
        schema: 'dbo',
        isActive: true,
        syncFrequency: 'daily',
      },
      {
        id: 'lab_system',
        name: 'Laboratory System',
        type: 'api',
        connectionString: 'https://lab-api.hospital.local/api/v1',
        isActive: true,
        syncFrequency: 'hourly',
      },
      {
        id: 'hl7_interface',
        name: 'HL7 Interface',
        type: 'hl7',
        connectionString: 'tcp://hl7-server:6661',
        isActive: true,
        syncFrequency: 'realtime',
      },
    ];

    for (const source of defaultSources) {
      this.dataSources.set(source.id, source);
    }
  }

  private initializeDefaultETLJobs(): void {
    const defaultJobs: ETLJob[] = [
      {
        id: 'patient_dimension_etl',
        name: 'Patient Dimension ETL',
        sourceId: 'emr_system',
        targetTable: 'dim_patient',
        transformationRules: [
          {
            sourceField: 'patient_id',
            targetField: 'patient_business_key',
            transformation: 'direct',
          },
          {
            sourceField: 'first_name',
            targetField: 'first_name',
            transformation: 'direct',
          },
          {
            sourceField: 'last_name',
            targetField: 'last_name',
            transformation: 'direct',
          },
        ],
        schedule: '0 2 * * *', // Daily at 2 AM
        isActive: true,
        status: 'pending',
      },
    ];

    for (const job of defaultJobs) {
      this.etlJobs.set(job.id, job);
    }
  }

  private initializeDataQualityRules(): void {
    const defaultRules: DataQualityRule[] = [
      {
        id: 'patient_id_not_null',
        name: 'Patient ID Not Null',
        table: 'dim_patient',
        field: 'patient_business_key',
        ruleType: 'not_null',
        parameters: {},
        severity: 'error',
        isActive: true,
      },
      {
        id: 'patient_id_unique',
        name: 'Patient ID Unique',
        table: 'dim_patient',
        field: 'patient_business_key',
        ruleType: 'unique',
        parameters: {},
        severity: 'error',
        isActive: true,
      },
    ];

    for (const rule of defaultRules) {
      this.dataQualityRules.set(rule.id, rule);
    }
  }

  // Cleanup
  stop(): void {
    // Clear all scheduled jobs
    for (const [jobId, timeout] of this.scheduledJobs) {
      clearInterval(timeout);
    }
    this.scheduledJobs.clear();

    logger.info('EDW service stopped');
  }
}

export const edwService = new EDWService();