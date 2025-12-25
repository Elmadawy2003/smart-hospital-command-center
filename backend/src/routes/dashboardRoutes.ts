import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import DashboardService from '../services/dashboardService';

const router = express.Router();
const dashboardService = new DashboardService();

// Apply authentication to all routes
router.use(authenticateToken);

// Dashboard Management
router.get('/dashboards', async (req, res) => {
  try {
    const { category, userId } = req.query;
    const dashboards = await dashboardService.getDashboards(
      userId as string,
      category as string
    );
    
    res.json({
      success: true,
      data: dashboards
    });
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboards'
    });
  }
});

router.get('/dashboards/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const dashboard = await dashboardService.getDashboard(dashboardId);
    
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard'
    });
  }
});

router.post('/dashboards', requireRole(['admin', 'dashboard_manager']), async (req, res) => {
  try {
    const dashboard = await dashboardService.createDashboard(req.body);
    res.status(201).json({
      success: true,
      data: dashboard,
      message: 'Dashboard created successfully'
    });
  } catch (error) {
    console.error('Error creating dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dashboard'
    });
  }
});

router.put('/dashboards/:dashboardId', requireRole(['admin', 'dashboard_manager']), async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const dashboard = await dashboardService.updateDashboard(dashboardId, req.body);
    
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }
    
    res.json({
      success: true,
      data: dashboard,
      message: 'Dashboard updated successfully'
    });
  } catch (error) {
    console.error('Error updating dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update dashboard'
    });
  }
});

router.delete('/dashboards/:dashboardId', requireRole(['admin', 'dashboard_manager']), async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const deleted = await dashboardService.deleteDashboard(dashboardId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Dashboard deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete dashboard'
    });
  }
});

// Widget Management
router.post('/dashboards/:dashboardId/widgets', requireRole(['admin', 'dashboard_manager']), async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const widget = await dashboardService.addWidget(dashboardId, req.body);
    
    if (!widget) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }
    
    res.status(201).json({
      success: true,
      data: widget,
      message: 'Widget added successfully'
    });
  } catch (error) {
    console.error('Error adding widget:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add widget'
    });
  }
});

router.put('/widgets/:widgetId', requireRole(['admin', 'dashboard_manager']), async (req, res) => {
  try {
    const { widgetId } = req.params;
    const widget = await dashboardService.updateWidget(widgetId, req.body);
    
    if (!widget) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found'
      });
    }
    
    res.json({
      success: true,
      data: widget,
      message: 'Widget updated successfully'
    });
  } catch (error) {
    console.error('Error updating widget:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update widget'
    });
  }
});

router.delete('/dashboards/:dashboardId/widgets/:widgetId', requireRole(['admin', 'dashboard_manager']), async (req, res) => {
  try {
    const { dashboardId, widgetId } = req.params;
    const removed = await dashboardService.removeWidget(dashboardId, widgetId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Widget or dashboard not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Widget removed successfully'
    });
  } catch (error) {
    console.error('Error removing widget:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove widget'
    });
  }
});

// KPI Management
router.get('/kpis', async (req, res) => {
  try {
    const { category } = req.query;
    const kpis = await dashboardService.getKPIMetrics(category as string);
    
    res.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch KPIs'
    });
  }
});

router.put('/kpis/:metricId', requireRole(['admin', 'data_manager']), async (req, res) => {
  try {
    const { metricId } = req.params;
    const { value } = req.body;
    
    if (typeof value !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Value must be a number'
      });
    }
    
    const metric = await dashboardService.updateKPIMetric(metricId, value);
    
    if (!metric) {
      return res.status(404).json({
        success: false,
        message: 'KPI metric not found'
      });
    }
    
    res.json({
      success: true,
      data: metric,
      message: 'KPI metric updated successfully'
    });
  } catch (error) {
    console.error('Error updating KPI metric:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update KPI metric'
    });
  }
});

// Alert Management
router.get('/alerts', async (req, res) => {
  try {
    const { status } = req.query;
    const alerts = await dashboardService.getAlerts(status as string);
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts'
    });
  }
});

router.get('/alert-rules', requireRole(['admin', 'alert_manager']), async (req, res) => {
  try {
    const rules = await dashboardService.getAlertRules();
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error fetching alert rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert rules'
    });
  }
});

router.post('/alert-rules', requireRole(['admin', 'alert_manager']), async (req, res) => {
  try {
    const rule = await dashboardService.createAlertRule(req.body);
    
    res.status(201).json({
      success: true,
      data: rule,
      message: 'Alert rule created successfully'
    });
  } catch (error) {
    console.error('Error creating alert rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert rule'
    });
  }
});

router.put('/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { alertId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }
    
    const alert = await dashboardService.acknowledgeAlert(alertId, userId);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }
    
    res.json({
      success: true,
      data: alert,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert'
    });
  }
});

// Executive Summary
router.get('/executive-summary', requireRole(['admin', 'executive', 'ceo', 'cfo']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const summary = await dashboardService.getExecutiveSummary(start, end);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching executive summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch executive summary'
    });
  }
});

// Real-time Metrics
router.get('/real-time', async (req, res) => {
  try {
    const metrics = await dashboardService.getRealTimeMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching real-time metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch real-time metrics'
    });
  }
});

// Data Export
router.get('/dashboards/:dashboardId/export', requireRole(['admin', 'dashboard_manager']), async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { format = 'json' } = req.query;
    
    if (!['json', 'csv', 'excel'].includes(format as string)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Supported formats: json, csv, excel'
      });
    }
    
    const exportData = await dashboardService.exportDashboardData(
      dashboardId,
      format as 'json' | 'csv' | 'excel'
    );
    
    if (!exportData) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }
    
    res.json({
      success: true,
      data: exportData,
      message: 'Dashboard data exported successfully'
    });
  } catch (error) {
    console.error('Error exporting dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export dashboard data'
    });
  }
});

// Dashboard Categories
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { id: 'executive', name: 'Executive', description: 'High-level strategic dashboards' },
      { id: 'operational', name: 'Operational', description: 'Day-to-day operations monitoring' },
      { id: 'clinical', name: 'Clinical', description: 'Patient care and clinical metrics' },
      { id: 'financial', name: 'Financial', description: 'Financial performance and analytics' },
      { id: 'quality', name: 'Quality', description: 'Quality assurance and improvement' },
      { id: 'custom', name: 'Custom', description: 'User-defined custom dashboards' }
    ];
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// Widget Types
router.get('/widget-types', async (req, res) => {
  try {
    const widgetTypes = [
      {
        type: 'chart',
        name: 'Chart',
        description: 'Various chart types for data visualization',
        subtypes: ['line', 'bar', 'pie', 'doughnut', 'area', 'scatter']
      },
      {
        type: 'metric',
        name: 'Metric',
        description: 'Single value metrics with trends',
        subtypes: []
      },
      {
        type: 'table',
        name: 'Table',
        description: 'Tabular data display',
        subtypes: []
      },
      {
        type: 'gauge',
        name: 'Gauge',
        description: 'Gauge charts for progress indicators',
        subtypes: []
      },
      {
        type: 'map',
        name: 'Map',
        description: 'Geographic data visualization',
        subtypes: []
      },
      {
        type: 'calendar',
        name: 'Calendar',
        description: 'Calendar-based data display',
        subtypes: []
      },
      {
        type: 'alert',
        name: 'Alert',
        description: 'Alert and notification widgets',
        subtypes: []
      }
    ];
    
    res.json({
      success: true,
      data: widgetTypes
    });
  } catch (error) {
    console.error('Error fetching widget types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch widget types'
    });
  }
});

// Dashboard Templates
router.get('/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'executive-template',
        name: 'Executive Dashboard Template',
        description: 'Pre-configured executive dashboard with key metrics',
        category: 'executive',
        widgets: [
          {
            type: 'metric',
            title: 'Patient Satisfaction',
            position: { x: 0, y: 0, width: 3, height: 2 }
          },
          {
            type: 'chart',
            title: 'Revenue Trend',
            position: { x: 3, y: 0, width: 6, height: 4 }
          },
          {
            type: 'gauge',
            title: 'Bed Occupancy',
            position: { x: 9, y: 0, width: 3, height: 2 }
          }
        ]
      },
      {
        id: 'operational-template',
        name: 'Operational Dashboard Template',
        description: 'Real-time operational monitoring dashboard',
        category: 'operational',
        widgets: [
          {
            type: 'metric',
            title: 'Current Patients',
            position: { x: 0, y: 0, width: 2, height: 2 }
          },
          {
            type: 'table',
            title: 'Emergency Queue',
            position: { x: 2, y: 0, width: 6, height: 4 }
          },
          {
            type: 'alert',
            title: 'System Alerts',
            position: { x: 8, y: 0, width: 4, height: 4 }
          }
        ]
      }
    ];
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates'
    });
  }
});

// Health Check
router.get('/health', async (req, res) => {
  try {
    const dashboards = await dashboardService.getDashboards();
    const kpis = await dashboardService.getKPIMetrics();
    const alerts = await dashboardService.getAlerts('active');
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        totalDashboards: dashboards.length,
        totalKPIs: kpis.length,
        activeAlerts: alerts.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({
      success: false,
      message: 'Dashboard service health check failed'
    });
  }
});

export default router;