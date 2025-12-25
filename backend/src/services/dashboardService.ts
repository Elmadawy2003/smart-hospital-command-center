import { v4 as uuidv4 } from 'uuid';

// Dashboard Interfaces
export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'gauge' | 'map' | 'calendar' | 'alert';
  title: string;
  description?: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  config: {
    dataSource: string;
    chartType?: 'line' | 'bar' | 'pie' | 'doughnut' | 'area' | 'scatter';
    metrics: string[];
    filters?: Record<string, any>;
    refreshInterval?: number; // in seconds
    thresholds?: {
      warning: number;
      critical: number;
    };
  };
  permissions: string[];
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  category: 'executive' | 'operational' | 'clinical' | 'financial' | 'quality' | 'custom';
  layout: 'grid' | 'flexible';
  widgets: DashboardWidget[];
  permissions: string[];
  isPublic: boolean;
  ownerId: string;
  tags: string[];
  refreshInterval: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIMetric {
  id: string;
  name: string;
  category: string;
  value: number;
  previousValue?: number;
  target?: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  changePercentage: number;
  status: 'good' | 'warning' | 'critical';
  description?: string;
  calculationMethod: string;
  lastUpdated: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'between';
  threshold: number | [number, number];
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  recipients: string[];
  channels: ('email' | 'sms' | 'push' | 'slack')[];
  cooldownPeriod: number; // in minutes
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  currentValue: number;
  threshold: number | [number, number];
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'scheduled' | 'on_demand';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  sections: ReportSection[];
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  recipients: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'chart' | 'table' | 'text' | 'metrics';
  dataSource: string;
  config: Record<string, any>;
  order: number;
}

export interface ExecutiveSummary {
  period: {
    start: Date;
    end: Date;
  };
  keyMetrics: {
    patientSatisfaction: number;
    operationalEfficiency: number;
    financialPerformance: number;
    qualityScore: number;
    staffUtilization: number;
  };
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  trends: {
    metric: string;
    direction: 'improving' | 'declining' | 'stable';
    impact: 'high' | 'medium' | 'low';
  }[];
}

class DashboardService {
  private dashboards: Map<string, Dashboard> = new Map();
  private widgets: Map<string, DashboardWidget> = new Map();
  private kpiMetrics: Map<string, KPIMetric> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, DashboardAlert> = new Map();
  private reportTemplates: Map<string, ReportTemplate> = new Map();

  constructor() {
    this.initializeDefaultDashboards();
    this.initializeDefaultKPIs();
    this.initializeDefaultAlerts();
  }

  // Dashboard Management
  async getDashboards(userId?: string, category?: string): Promise<Dashboard[]> {
    let dashboards = Array.from(this.dashboards.values());
    
    if (category) {
      dashboards = dashboards.filter(d => d.category === category);
    }
    
    if (userId) {
      dashboards = dashboards.filter(d => 
        d.isPublic || d.ownerId === userId || d.permissions.includes(userId)
      );
    }
    
    return dashboards.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    return this.dashboards.get(dashboardId) || null;
  }

  async createDashboard(dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    const dashboard: Dashboard = {
      ...dashboardData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.dashboards.set(dashboard.id, dashboard);
    return dashboard;
  }

  async updateDashboard(dashboardId: string, updates: Partial<Dashboard>): Promise<Dashboard | null> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;
    
    const updatedDashboard = {
      ...dashboard,
      ...updates,
      updatedAt: new Date()
    };
    
    this.dashboards.set(dashboardId, updatedDashboard);
    return updatedDashboard;
  }

  async deleteDashboard(dashboardId: string): Promise<boolean> {
    return this.dashboards.delete(dashboardId);
  }

  // Widget Management
  async addWidget(dashboardId: string, widgetData: Omit<DashboardWidget, 'id' | 'createdAt' | 'updatedAt'>): Promise<DashboardWidget | null> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;
    
    const widget: DashboardWidget = {
      ...widgetData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    dashboard.widgets.push(widget);
    dashboard.updatedAt = new Date();
    
    this.widgets.set(widget.id, widget);
    this.dashboards.set(dashboardId, dashboard);
    
    return widget;
  }

  async updateWidget(widgetId: string, updates: Partial<DashboardWidget>): Promise<DashboardWidget | null> {
    const widget = this.widgets.get(widgetId);
    if (!widget) return null;
    
    const updatedWidget = {
      ...widget,
      ...updates,
      updatedAt: new Date()
    };
    
    this.widgets.set(widgetId, updatedWidget);
    
    // Update in dashboard
    for (const dashboard of this.dashboards.values()) {
      const widgetIndex = dashboard.widgets.findIndex(w => w.id === widgetId);
      if (widgetIndex !== -1) {
        dashboard.widgets[widgetIndex] = updatedWidget;
        dashboard.updatedAt = new Date();
        break;
      }
    }
    
    return updatedWidget;
  }

  async removeWidget(dashboardId: string, widgetId: string): Promise<boolean> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return false;
    
    dashboard.widgets = dashboard.widgets.filter(w => w.id !== widgetId);
    dashboard.updatedAt = new Date();
    
    this.widgets.delete(widgetId);
    this.dashboards.set(dashboardId, dashboard);
    
    return true;
  }

  // KPI Management
  async getKPIMetrics(category?: string): Promise<KPIMetric[]> {
    let metrics = Array.from(this.kpiMetrics.values());
    
    if (category) {
      metrics = metrics.filter(m => m.category === category);
    }
    
    return metrics.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  async updateKPIMetric(metricId: string, value: number): Promise<KPIMetric | null> {
    const metric = this.kpiMetrics.get(metricId);
    if (!metric) return null;
    
    const previousValue = metric.value;
    const changePercentage = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (changePercentage > 1) trend = 'up';
    else if (changePercentage < -1) trend = 'down';
    
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (metric.target) {
      const targetDiff = Math.abs(value - metric.target) / metric.target;
      if (targetDiff > 0.2) status = 'critical';
      else if (targetDiff > 0.1) status = 'warning';
    }
    
    const updatedMetric = {
      ...metric,
      previousValue,
      value,
      changePercentage,
      trend,
      status,
      lastUpdated: new Date()
    };
    
    this.kpiMetrics.set(metricId, updatedMetric);
    
    // Check alert rules
    await this.checkAlertRules(metricId, value);
    
    return updatedMetric;
  }

  // Alert Management
  async getAlertRules(): Promise<AlertRule[]> {
    return Array.from(this.alertRules.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async createAlertRule(ruleData: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertRule> {
    const rule: AlertRule = {
      ...ruleData,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.alertRules.set(rule.id, rule);
    return rule;
  }

  async getAlerts(status?: string): Promise<DashboardAlert[]> {
    let alerts = Array.from(this.alerts.values());
    
    if (status) {
      alerts = alerts.filter(a => a.status === status);
    }
    
    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<DashboardAlert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;
    
    const updatedAlert = {
      ...alert,
      status: 'acknowledged' as const,
      acknowledgedBy: userId,
      acknowledgedAt: new Date()
    };
    
    this.alerts.set(alertId, updatedAlert);
    return updatedAlert;
  }

  private async checkAlertRules(metricId: string, value: number): Promise<void> {
    const rules = Array.from(this.alertRules.values())
      .filter(rule => rule.metric === metricId && rule.isActive);
    
    for (const rule of rules) {
      let shouldTrigger = false;
      
      switch (rule.condition) {
        case 'greater_than':
          shouldTrigger = value > (rule.threshold as number);
          break;
        case 'less_than':
          shouldTrigger = value < (rule.threshold as number);
          break;
        case 'equals':
          shouldTrigger = value === (rule.threshold as number);
          break;
        case 'between':
          const [min, max] = rule.threshold as [number, number];
          shouldTrigger = value >= min && value <= max;
          break;
      }
      
      if (shouldTrigger) {
        // Check cooldown period
        if (rule.lastTriggered) {
          const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
          if (timeSinceLastTrigger < rule.cooldownPeriod * 60 * 1000) {
            continue;
          }
        }
        
        await this.createAlert(rule, value);
        
        // Update last triggered time
        rule.lastTriggered = new Date();
        this.alertRules.set(rule.id, rule);
      }
    }
  }

  private async createAlert(rule: AlertRule, currentValue: number): Promise<void> {
    const alert: DashboardAlert = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      message: `${rule.name}: Current value ${currentValue} ${rule.condition} ${rule.threshold}`,
      severity: rule.severity,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      status: 'active',
      createdAt: new Date()
    };
    
    this.alerts.set(alert.id, alert);
  }

  // Executive Summary
  async getExecutiveSummary(startDate: Date, endDate: Date): Promise<ExecutiveSummary> {
    // This would typically aggregate data from various sources
    return {
      period: { start: startDate, end: endDate },
      keyMetrics: {
        patientSatisfaction: 4.2,
        operationalEfficiency: 85.5,
        financialPerformance: 92.3,
        qualityScore: 88.7,
        staffUtilization: 78.9
      },
      highlights: [
        'Patient satisfaction increased by 5% this quarter',
        'Emergency department wait times reduced by 15 minutes',
        'Revenue increased by 8% compared to last quarter'
      ],
      concerns: [
        'Staff turnover rate increased to 12%',
        'Equipment maintenance costs exceeded budget by 15%'
      ],
      recommendations: [
        'Implement staff retention program',
        'Review equipment maintenance contracts',
        'Expand telemedicine services'
      ],
      trends: [
        { metric: 'Patient Volume', direction: 'improving', impact: 'high' },
        { metric: 'Cost per Patient', direction: 'stable', impact: 'medium' },
        { metric: 'Staff Satisfaction', direction: 'declining', impact: 'high' }
      ]
    };
  }

  // Real-time Data
  async getRealTimeMetrics(): Promise<Record<string, any>> {
    return {
      currentPatients: 245,
      availableBeds: 23,
      emergencyWaitTime: 18, // minutes
      surgeryRoomsInUse: 8,
      totalSurgeryRooms: 12,
      staffOnDuty: 156,
      criticalAlerts: this.alerts.size,
      systemStatus: 'operational',
      lastUpdated: new Date()
    };
  }

  // Data Export
  async exportDashboardData(dashboardId: string, format: 'json' | 'csv' | 'excel'): Promise<any> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;
    
    // This would implement actual data export logic
    return {
      dashboard,
      exportedAt: new Date(),
      format
    };
  }

  private initializeDefaultDashboards(): void {
    // Executive Dashboard
    const executiveDashboard: Dashboard = {
      id: 'exec-dashboard-001',
      name: 'Executive Dashboard',
      description: 'High-level overview for hospital executives',
      category: 'executive',
      layout: 'grid',
      widgets: [],
      permissions: ['admin', 'executive', 'ceo', 'cfo'],
      isPublic: false,
      ownerId: 'system',
      tags: ['executive', 'overview', 'kpi'],
      refreshInterval: 300, // 5 minutes
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Operational Dashboard
    const operationalDashboard: Dashboard = {
      id: 'ops-dashboard-001',
      name: 'Operational Dashboard',
      description: 'Real-time operational metrics and monitoring',
      category: 'operational',
      layout: 'flexible',
      widgets: [],
      permissions: ['admin', 'operations_manager', 'nurse_manager'],
      isPublic: true,
      ownerId: 'system',
      tags: ['operations', 'real-time', 'monitoring'],
      refreshInterval: 60, // 1 minute
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.dashboards.set(executiveDashboard.id, executiveDashboard);
    this.dashboards.set(operationalDashboard.id, operationalDashboard);
  }

  private initializeDefaultKPIs(): void {
    const kpis: KPIMetric[] = [
      {
        id: 'patient-satisfaction',
        name: 'Patient Satisfaction Score',
        category: 'quality',
        value: 4.2,
        target: 4.5,
        unit: '/5',
        trend: 'up',
        changePercentage: 5.2,
        status: 'warning',
        description: 'Average patient satisfaction rating',
        calculationMethod: 'Average of all patient survey scores',
        lastUpdated: new Date()
      },
      {
        id: 'bed-occupancy',
        name: 'Bed Occupancy Rate',
        category: 'operational',
        value: 85.5,
        target: 80,
        unit: '%',
        trend: 'up',
        changePercentage: 2.1,
        status: 'warning',
        description: 'Percentage of beds currently occupied',
        calculationMethod: 'Occupied beds / Total beds * 100',
        lastUpdated: new Date()
      },
      {
        id: 'revenue-per-patient',
        name: 'Revenue per Patient',
        category: 'financial',
        value: 2850,
        target: 3000,
        unit: '$',
        trend: 'stable',
        changePercentage: 0.5,
        status: 'warning',
        description: 'Average revenue generated per patient',
        calculationMethod: 'Total revenue / Total patients',
        lastUpdated: new Date()
      }
    ];
    
    kpis.forEach(kpi => this.kpiMetrics.set(kpi.id, kpi));
  }

  private initializeDefaultAlerts(): void {
    const alertRules: AlertRule[] = [
      {
        id: 'bed-occupancy-high',
        name: 'High Bed Occupancy',
        description: 'Alert when bed occupancy exceeds 90%',
        metric: 'bed-occupancy',
        condition: 'greater_than',
        threshold: 90,
        severity: 'high',
        isActive: true,
        recipients: ['operations@hospital.com'],
        channels: ['email', 'push'],
        cooldownPeriod: 30,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'patient-satisfaction-low',
        name: 'Low Patient Satisfaction',
        description: 'Alert when patient satisfaction drops below 3.5',
        metric: 'patient-satisfaction',
        condition: 'less_than',
        threshold: 3.5,
        severity: 'medium',
        isActive: true,
        recipients: ['quality@hospital.com'],
        channels: ['email'],
        cooldownPeriod: 60,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    alertRules.forEach(rule => this.alertRules.set(rule.id, rule));
  }
}

export default DashboardService;