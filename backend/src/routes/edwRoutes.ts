import express from 'express';
import { edwService } from '../services/edwService';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Data Source Management Routes

// Get all data sources
router.get('/data-sources', async (req, res) => {
  try {
    const dataSources = Array.from(edwService['dataSources'].values());
    
    res.status(200).json({
      success: true,
      data: dataSources,
      total: dataSources.length,
    });
  } catch (error) {
    logger.error('Error fetching data sources', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching data sources',
      error: error.message,
    });
  }
});

// Register new data source
router.post('/data-sources', async (req, res) => {
  try {
    const dataSource = req.body;

    if (!dataSource.id || !dataSource.name || !dataSource.type || !dataSource.connectionString) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: id, name, type, connectionString',
      });
    }

    await edwService.registerDataSource(dataSource);

    res.status(201).json({
      success: true,
      message: 'Data source registered successfully',
      data: dataSource,
    });
  } catch (error) {
    logger.error('Error registering data source', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error registering data source',
      error: error.message,
    });
  }
});

// Test data source connection
router.post('/data-sources/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const dataSource = edwService['dataSources'].get(id);

    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found',
      });
    }

    const isConnected = await edwService.testConnection(dataSource);

    res.status(200).json({
      success: true,
      message: 'Connection test completed',
      data: {
        sourceId: id,
        isConnected,
        testedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error testing data source connection', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error testing data source connection',
      error: error.message,
    });
  }
});

// ETL Job Management Routes

// Get all ETL jobs
router.get('/etl-jobs', async (req, res) => {
  try {
    const etlJobs = Array.from(edwService['etlJobs'].values());
    
    res.status(200).json({
      success: true,
      data: etlJobs,
      total: etlJobs.length,
    });
  } catch (error) {
    logger.error('Error fetching ETL jobs', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching ETL jobs',
      error: error.message,
    });
  }
});

// Create new ETL job
router.post('/etl-jobs', async (req, res) => {
  try {
    const etlJob = req.body;

    if (!etlJob.id || !etlJob.name || !etlJob.sourceId || !etlJob.targetTable) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: id, name, sourceId, targetTable',
      });
    }

    await edwService.createETLJob(etlJob);

    res.status(201).json({
      success: true,
      message: 'ETL job created successfully',
      data: etlJob,
    });
  } catch (error) {
    logger.error('Error creating ETL job', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error creating ETL job',
      error: error.message,
    });
  }
});

// Run ETL job manually
router.post('/etl-jobs/:id/run', async (req, res) => {
  try {
    const { id } = req.params;

    await edwService.runETLJob(id);

    res.status(200).json({
      success: true,
      message: 'ETL job started successfully',
      jobId: id,
      startedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error running ETL job', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error running ETL job',
      error: error.message,
    });
  }
});

// Get ETL job status
router.get('/etl-jobs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const etlJob = edwService['etlJobs'].get(id);

    if (!etlJob) {
      return res.status(404).json({
        success: false,
        message: 'ETL job not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        jobId: id,
        status: etlJob.status,
        lastRun: etlJob.lastRun,
        nextRun: etlJob.nextRun,
        isActive: etlJob.isActive,
      },
    });
  } catch (error) {
    logger.error('Error fetching ETL job status', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching ETL job status',
      error: error.message,
    });
  }
});

// Data Quality Management Routes

// Run data quality checks
router.post('/data-quality/check', async (req, res) => {
  try {
    const { table } = req.body;

    const issues = await edwService.runDataQualityChecks(table);

    res.status(200).json({
      success: true,
      message: 'Data quality checks completed',
      data: {
        issuesFound: issues.length,
        issues,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error running data quality checks', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error running data quality checks',
      error: error.message,
    });
  }
});

// Get data quality rules
router.get('/data-quality/rules', async (req, res) => {
  try {
    const rules = Array.from(edwService['dataQualityRules'].values());
    
    res.status(200).json({
      success: true,
      data: rules,
      total: rules.length,
    });
  } catch (error) {
    logger.error('Error fetching data quality rules', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching data quality rules',
      error: error.message,
    });
  }
});

// Dimensional Modeling Routes

// Create dimension table
router.post('/dimensions', async (req, res) => {
  try {
    const dimension = req.body;

    if (!dimension.name || !dimension.primaryKey || !dimension.attributes) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, primaryKey, attributes',
      });
    }

    await edwService.createDimensionTable(dimension);

    res.status(201).json({
      success: true,
      message: 'Dimension table created successfully',
      data: dimension,
    });
  } catch (error) {
    logger.error('Error creating dimension table', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error creating dimension table',
      error: error.message,
    });
  }
});

// Create fact table
router.post('/facts', async (req, res) => {
  try {
    const fact = req.body;

    if (!fact.name || !fact.dimensions || !fact.measures) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, dimensions, measures',
      });
    }

    await edwService.createFactTable(fact);

    res.status(201).json({
      success: true,
      message: 'Fact table created successfully',
      data: fact,
    });
  } catch (error) {
    logger.error('Error creating fact table', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error creating fact table',
      error: error.message,
    });
  }
});

// Analytics and Reporting Routes

// Get data warehouse statistics
router.get('/statistics', async (req, res) => {
  try {
    const dataSources = Array.from(edwService['dataSources'].values());
    const etlJobs = Array.from(edwService['etlJobs'].values());
    const dataQualityRules = Array.from(edwService['dataQualityRules'].values());

    const statistics = {
      dataSources: {
        total: dataSources.length,
        active: dataSources.filter(ds => ds.isActive).length,
        byType: dataSources.reduce((acc, ds) => {
          acc[ds.type] = (acc[ds.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      etlJobs: {
        total: etlJobs.length,
        active: etlJobs.filter(job => job.isActive).length,
        byStatus: etlJobs.reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      dataQuality: {
        totalRules: dataQualityRules.length,
        activeRules: dataQualityRules.filter(rule => rule.isActive).length,
        bySeverity: dataQualityRules.reduce((acc, rule) => {
          acc[rule.severity] = (acc[rule.severity] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    };

    res.status(200).json({
      success: true,
      data: statistics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching EDW statistics', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching EDW statistics',
      error: error.message,
    });
  }
});

// Get data lineage
router.get('/lineage/:table', async (req, res) => {
  try {
    const { table } = req.params;

    // This would typically query a metadata repository
    const lineage = {
      targetTable: table,
      sources: [
        {
          sourceSystem: 'EMR System',
          sourceTable: 'patients',
          lastUpdated: new Date().toISOString(),
          transformationPath: ['extract', 'clean', 'transform', 'load'],
        },
        {
          sourceSystem: 'Lab System',
          sourceTable: 'lab_results',
          lastUpdated: new Date().toISOString(),
          transformationPath: ['extract', 'validate', 'transform', 'load'],
        },
      ],
    };

    res.status(200).json({
      success: true,
      data: lineage,
    });
  } catch (error) {
    logger.error('Error fetching data lineage', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching data lineage',
      error: error.message,
    });
  }
});

// Data Profiling Routes

// Profile data source
router.post('/profile/:sourceId', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { table, columns } = req.body;

    const dataSource = edwService['dataSources'].get(sourceId);
    if (!dataSource) {
      return res.status(404).json({
        success: false,
        message: 'Data source not found',
      });
    }

    // This would typically analyze the data and return profiling results
    const profile = {
      sourceId,
      table,
      columns: columns?.map((col: string) => ({
        name: col,
        dataType: 'VARCHAR',
        nullCount: 0,
        uniqueCount: 100,
        minLength: 1,
        maxLength: 50,
        avgLength: 25,
        sampleValues: ['Sample1', 'Sample2', 'Sample3'],
      })) || [],
      rowCount: 1000,
      profiledAt: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error('Error profiling data source', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error profiling data source',
      error: error.message,
    });
  }
});

// Health Check Routes

// Get EDW service health
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        etlScheduler: 'running',
        dataQualityMonitor: 'running',
        metadataRepository: 'connected',
      },
      uptime: process.uptime(),
    };

    res.status(200).json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error('Error checking EDW health', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error checking EDW health',
      error: error.message,
    });
  }
});

export default router;