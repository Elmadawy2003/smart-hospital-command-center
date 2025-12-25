# دليل الصيانة والدعم الفني - نظام إدارة المستشفيات

## 📋 جدول المحتويات

1. [نظرة عامة على الصيانة](#نظرة-عامة-على-الصيانة)
2. [الصيانة الوقائية](#الصيانة-الوقائية)
3. [مراقبة النظام](#مراقبة-النظام)
4. [إدارة قواعد البيانات](#إدارة-قواعد-البيانات)
5. [إدارة الخوادم](#إدارة-الخوادم)
6. [النسخ الاحتياطية](#النسخ-الاحتياطية)
7. [استكشاف الأخطاء وإصلاحها](#استكشاف-الأخطاء-وإصلاحها)
8. [التحديثات والترقيات](#التحديثات-والترقيات)
9. [الدعم الفني](#الدعم-الفني)
10. [إجراءات الطوارئ](#إجراءات-الطوارئ)

## نظرة عامة على الصيانة

### أهداف الصيانة

#### الأهداف الأساسية
- **الموثوقية**: ضمان عمل النظام بشكل مستمر
- **الأداء**: الحفاظ على سرعة الاستجابة المثلى
- **الأمان**: حماية البيانات والنظام
- **التوفر**: تقليل فترات التوقف

#### مستويات الخدمة (SLA)
```yaml
service_levels:
  availability:
    target: 99.9%
    measurement: monthly
    
  response_time:
    api_calls: < 200ms
    page_load: < 2s
    database_queries: < 100ms
    
  recovery_time:
    planned_downtime: < 4 hours
    unplanned_downtime: < 1 hour
    
  backup_frequency:
    critical_data: daily
    full_system: weekly
    archive: monthly
```

### جدولة الصيانة

#### الصيانة اليومية
```bash
#!/bin/bash
# daily-maintenance.sh

# فحص حالة الخدمات
systemctl status hospital-erp nginx mongod redis

# فحص استخدام القرص
df -h | grep -E "(80%|90%|95%)"

# فحص استخدام الذاكرة
free -h

# فحص السجلات للأخطاء
tail -n 100 /var/log/hospital-erp/error.log | grep -i error

# فحص الاتصالات النشطة
netstat -tuln | grep -E "(3000|27017|6379)"

# تنظيف الملفات المؤقتة
find /tmp -name "*.tmp" -mtime +1 -delete
find /var/log -name "*.log" -size +100M -exec gzip {} \;
```

#### الصيانة الأسبوعية
```bash
#!/bin/bash
# weekly-maintenance.sh

# تحديث النظام
apt update && apt upgrade -y

# فحص تكامل قاعدة البيانات
mongod --dbpath /var/lib/mongodb --repair

# تحسين قاعدة البيانات
mongo hospital_erp --eval "db.runCommand({compact: 'patients'})"
mongo hospital_erp --eval "db.runCommand({compact: 'medical_records'})"

# فحص الشهادات الرقمية
openssl x509 -in /etc/ssl/certs/hospital-erp.crt -noout -dates

# تحليل السجلات
logrotate /etc/logrotate.d/hospital-erp

# فحص الأمان
rkhunter --check --skip-keypress
```

#### الصيانة الشهرية
```bash
#!/bin/bash
# monthly-maintenance.sh

# تحليل الأداء
iostat -x 1 10 > /var/log/performance/iostat-$(date +%Y%m).log
sar -u 1 10 > /var/log/performance/cpu-$(date +%Y%m).log

# فحص شامل للقرص
fsck -n /dev/sda1

# تحديث قواعد الأمان
freshclam
rkhunter --update

# مراجعة المستخدمين والصلاحيات
mongo hospital_erp --eval "db.users.find({lastLogin: {$lt: new Date(Date.now() - 90*24*60*60*1000)}})"

# تحليل استخدام الموارد
du -sh /var/hospital-erp/* | sort -hr
```

## الصيانة الوقائية

### مراقبة الأداء

#### مراقبة الخادم
```javascript
// server-monitoring.js
const os = require('os');
const fs = require('fs');

class ServerMonitor {
  constructor() {
    this.thresholds = {
      cpu: 80,
      memory: 85,
      disk: 90,
      load: 2.0
    };
  }

  async checkSystemHealth() {
    const health = {
      timestamp: new Date(),
      cpu: this.getCPUUsage(),
      memory: this.getMemoryUsage(),
      disk: await this.getDiskUsage(),
      load: this.getLoadAverage(),
      uptime: this.getUptime()
    };

    // فحص التحذيرات
    const alerts = this.checkThresholds(health);
    
    if (alerts.length > 0) {
      await this.sendAlerts(alerts);
    }

    return health;
  }

  getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return {
      usage: usage,
      cores: cpus.length,
      model: cpus[0].model
    };
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = (used / total) * 100;

    return {
      total: Math.round(total / 1024 / 1024 / 1024 * 100) / 100,
      used: Math.round(used / 1024 / 1024 / 1024 * 100) / 100,
      free: Math.round(free / 1024 / 1024 / 1024 * 100) / 100,
      usage: Math.round(usage * 100) / 100
    };
  }

  async getDiskUsage() {
    return new Promise((resolve, reject) => {
      fs.statvfs('/', (err, stats) => {
        if (err) return reject(err);

        const total = stats.blocks * stats.frsize;
        const free = stats.bavail * stats.frsize;
        const used = total - free;
        const usage = (used / total) * 100;

        resolve({
          total: Math.round(total / 1024 / 1024 / 1024 * 100) / 100,
          used: Math.round(used / 1024 / 1024 / 1024 * 100) / 100,
          free: Math.round(free / 1024 / 1024 / 1024 * 100) / 100,
          usage: Math.round(usage * 100) / 100
        });
      });
    });
  }

  getLoadAverage() {
    const load = os.loadavg();
    return {
      '1min': load[0],
      '5min': load[1],
      '15min': load[2]
    };
  }

  getUptime() {
    const uptime = os.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return {
      seconds: uptime,
      formatted: `${days}d ${hours}h ${minutes}m`
    };
  }

  checkThresholds(health) {
    const alerts = [];

    if (health.cpu.usage > this.thresholds.cpu) {
      alerts.push({
        type: 'CPU_HIGH',
        value: health.cpu.usage,
        threshold: this.thresholds.cpu,
        severity: 'warning'
      });
    }

    if (health.memory.usage > this.thresholds.memory) {
      alerts.push({
        type: 'MEMORY_HIGH',
        value: health.memory.usage,
        threshold: this.thresholds.memory,
        severity: 'warning'
      });
    }

    if (health.disk.usage > this.thresholds.disk) {
      alerts.push({
        type: 'DISK_HIGH',
        value: health.disk.usage,
        threshold: this.thresholds.disk,
        severity: 'critical'
      });
    }

    if (health.load['1min'] > this.thresholds.load) {
      alerts.push({
        type: 'LOAD_HIGH',
        value: health.load['1min'],
        threshold: this.thresholds.load,
        severity: 'warning'
      });
    }

    return alerts;
  }

  async sendAlerts(alerts) {
    for (const alert of alerts) {
      console.log(`تحذير: ${alert.type} - القيمة: ${alert.value}, الحد الأقصى: ${alert.threshold}`);
      
      // إرسال تنبيه للمديرين
      await this.notifyAdministrators(alert);
    }
  }

  async notifyAdministrators(alert) {
    // إرسال عبر WebSocket
    io.to('system_admins').emit('system_alert', alert);
    
    // إرسال بريد إلكتروني للحالات الحرجة
    if (alert.severity === 'critical') {
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `تحذير نظام حرج: ${alert.type}`,
        body: `تم اكتشاف مشكلة في النظام:\n\nالنوع: ${alert.type}\nالقيمة: ${alert.value}\nالحد الأقصى: ${alert.threshold}\n\nيرجى اتخاذ الإجراء المناسب فوراً.`
      });
    }
  }
}

// تشغيل المراقبة كل دقيقة
const monitor = new ServerMonitor();
setInterval(async () => {
  try {
    await monitor.checkSystemHealth();
  } catch (error) {
    console.error('خطأ في مراقبة النظام:', error);
  }
}, 60000);
```

#### مراقبة قاعدة البيانات
```javascript
// database-monitoring.js
const mongoose = require('mongoose');

class DatabaseMonitor {
  constructor() {
    this.thresholds = {
      connectionCount: 100,
      queryTime: 1000, // milliseconds
      lockTime: 500,
      replicationLag: 10000
    };
  }

  async checkDatabaseHealth() {
    const db = mongoose.connection.db;
    
    const stats = await db.admin().serverStatus();
    const dbStats = await db.stats();
    
    const health = {
      timestamp: new Date(),
      connections: stats.connections,
      operations: stats.opcounters,
      memory: stats.mem,
      locks: stats.locks,
      database: {
        collections: dbStats.collections,
        dataSize: dbStats.dataSize,
        indexSize: dbStats.indexSize,
        storageSize: dbStats.storageSize
      }
    };

    // فحص الاستعلامات البطيئة
    const slowQueries = await this.getSlowQueries();
    health.slowQueries = slowQueries;

    // فحص التحذيرات
    const alerts = this.checkDatabaseThresholds(health);
    
    if (alerts.length > 0) {
      await this.sendDatabaseAlerts(alerts);
    }

    return health;
  }

  async getSlowQueries() {
    const db = mongoose.connection.db;
    
    // تفعيل profiler للاستعلامات البطيئة
    await db.admin().command({
      profile: 2,
      slowms: this.thresholds.queryTime
    });

    // جلب الاستعلامات البطيئة
    const profilerData = await db.collection('system.profile')
      .find({ ts: { $gte: new Date(Date.now() - 3600000) } }) // آخر ساعة
      .sort({ ts: -1 })
      .limit(10)
      .toArray();

    return profilerData.map(query => ({
      timestamp: query.ts,
      duration: query.millis,
      command: query.command,
      collection: query.ns
    }));
  }

  checkDatabaseThresholds(health) {
    const alerts = [];

    if (health.connections.current > this.thresholds.connectionCount) {
      alerts.push({
        type: 'DB_CONNECTIONS_HIGH',
        value: health.connections.current,
        threshold: this.thresholds.connectionCount,
        severity: 'warning'
      });
    }

    if (health.slowQueries.length > 5) {
      alerts.push({
        type: 'DB_SLOW_QUERIES',
        value: health.slowQueries.length,
        threshold: 5,
        severity: 'warning'
      });
    }

    // فحص استخدام الذاكرة
    const memoryUsage = (health.memory.resident / health.memory.virtual) * 100;
    if (memoryUsage > 80) {
      alerts.push({
        type: 'DB_MEMORY_HIGH',
        value: memoryUsage,
        threshold: 80,
        severity: 'warning'
      });
    }

    return alerts;
  }

  async sendDatabaseAlerts(alerts) {
    for (const alert of alerts) {
      console.log(`تحذير قاعدة البيانات: ${alert.type} - القيمة: ${alert.value}`);
      
      // إرسال تنبيه
      io.to('db_admins').emit('database_alert', alert);
    }
  }

  async optimizeDatabase() {
    const db = mongoose.connection.db;
    
    // إعادة بناء الفهارس
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      try {
        await db.collection(collection.name).reIndex();
        console.log(`تم تحسين فهارس مجموعة: ${collection.name}`);
      } catch (error) {
        console.error(`خطأ في تحسين فهارس ${collection.name}:`, error);
      }
    }

    // ضغط قاعدة البيانات
    try {
      await db.admin().command({ compact: 'patients' });
      await db.admin().command({ compact: 'medical_records' });
      await db.admin().command({ compact: 'appointments' });
      console.log('تم ضغط قاعدة البيانات بنجاح');
    } catch (error) {
      console.error('خطأ في ضغط قاعدة البيانات:', error);
    }
  }
}

// تشغيل مراقبة قاعدة البيانات كل 5 دقائق
const dbMonitor = new DatabaseMonitor();
setInterval(async () => {
  try {
    await dbMonitor.checkDatabaseHealth();
  } catch (error) {
    console.error('خطأ في مراقبة قاعدة البيانات:', error);
  }
}, 300000);

// تحسين قاعدة البيانات يومياً في الساعة 2 صباحاً
const schedule = require('node-schedule');
schedule.scheduleJob('0 2 * * *', async () => {
  console.log('بدء تحسين قاعدة البيانات اليومي');
  await dbMonitor.optimizeDatabase();
});
```

## مراقبة النظام

### إعداد Prometheus و Grafana

#### تكوين Prometheus
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "hospital_erp_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'hospital-erp'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'mongodb-exporter'
    static_configs:
      - targets: ['localhost:9216']

  - job_name: 'nginx-exporter'
    static_configs:
      - targets: ['localhost:9113']
```

#### قواعد التنبيه
```yaml
# hospital_erp_rules.yml
groups:
  - name: hospital_erp_alerts
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "استخدام عالي للمعالج"
          description: "استخدام المعالج {{ $value }}% لأكثر من 5 دقائق"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "استخدام عالي للذاكرة"
          description: "استخدام الذاكرة {{ $value }}%"

      - alert: DiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100 > 90
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "مساحة القرص منخفضة"
          description: "مساحة القرص المتبقية أقل من 10%"

      - alert: DatabaseConnectionsHigh
        expr: mongodb_connections{state="current"} > 100
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "عدد كبير من اتصالات قاعدة البيانات"
          description: "عدد الاتصالات الحالية: {{ $value }}"

      - alert: ApplicationDown
        expr: up{job="hospital-erp"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "تطبيق المستشفى متوقف"
          description: "التطبيق غير متاح"
```

#### لوحة مراقبة Grafana
```json
{
  "dashboard": {
    "title": "Hospital ERP System Monitoring",
    "panels": [
      {
        "title": "System Overview",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"hospital-erp\"}",
            "legendFormat": "Application Status"
          },
          {
            "expr": "100 - (avg(irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "CPU Usage %"
          },
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "legendFormat": "Memory Usage %"
          }
        ]
      },
      {
        "title": "Database Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "mongodb_connections{state=\"current\"}",
            "legendFormat": "Active Connections"
          },
          {
            "expr": "rate(mongodb_op_counters_total[5m])",
            "legendFormat": "Operations/sec"
          }
        ]
      },
      {
        "title": "API Response Times",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      }
    ]
  }
}
```

### مراقبة السجلات

#### إعداد ELK Stack
```yaml
# docker-compose.yml للـ ELK Stack
version: '3.7'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.15.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:7.15.0
    ports:
      - "5044:5044"
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:7.15.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

#### تكوين Logstash
```ruby
# logstash.conf
input {
  file {
    path => "/var/log/hospital-erp/*.log"
    start_position => "beginning"
    codec => "json"
  }
  
  beats {
    port => 5044
  }
}

filter {
  if [fields][log_type] == "application" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}" }
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
  }
  
  if [fields][log_type] == "access" {
    grok {
      match => { "message" => "%{COMBINEDAPACHELOG}" }
    }
  }
  
  if [fields][log_type] == "security" {
    if [event_type] == "login_attempt" {
      mutate {
        add_tag => [ "security", "authentication" ]
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "hospital-erp-%{+YYYY.MM.dd}"
  }
  
  if "security" in [tags] {
    elasticsearch {
      hosts => ["elasticsearch:9200"]
      index => "security-logs-%{+YYYY.MM.dd}"
    }
  }
}
```

## إدارة قواعد البيانات

### صيانة MongoDB

#### تحسين الأداء
```javascript
// database-optimization.js
const optimizationTasks = {
  // إعادة بناء الفهارس
  rebuildIndexes: async () => {
    const collections = ['patients', 'medical_records', 'appointments', 'prescriptions'];
    
    for (const collectionName of collections) {
      try {
        console.log(`إعادة بناء فهارس: ${collectionName}`);
        await db.collection(collectionName).reIndex();
        console.log(`تم بنجاح: ${collectionName}`);
      } catch (error) {
        console.error(`خطأ في ${collectionName}:`, error);
      }
    }
  },

  // تحليل استخدام الفهارس
  analyzeIndexUsage: async () => {
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      const stats = await db.collection(collection.name).aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      console.log(`إحصائيات فهارس ${collection.name}:`);
      stats.forEach(stat => {
        console.log(`  ${stat.name}: ${stat.accesses.ops} استخدام`);
      });
    }
  },

  // ضغط البيانات
  compactCollections: async () => {
    const collections = ['patients', 'medical_records', 'appointments'];
    
    for (const collectionName of collections) {
      try {
        console.log(`ضغط مجموعة: ${collectionName}`);
        await db.runCommand({ compact: collectionName });
        console.log(`تم ضغط: ${collectionName}`);
      } catch (error) {
        console.error(`خطأ في ضغط ${collectionName}:`, error);
      }
    }
  },

  // تنظيف البيانات القديمة
  cleanupOldData: async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    
    // حذف جلسات منتهية الصلاحية
    const expiredSessions = await db.collection('sessions').deleteMany({
      expiresAt: { $lt: new Date() }
    });
    console.log(`تم حذف ${expiredSessions.deletedCount} جلسة منتهية الصلاحية`);
    
    // أرشفة السجلات القديمة
    const oldLogs = await db.collection('audit_logs').find({
      timestamp: { $lt: oneYearAgo }
    }).toArray();
    
    if (oldLogs.length > 0) {
      await db.collection('audit_logs_archive').insertMany(oldLogs);
      await db.collection('audit_logs').deleteMany({
        timestamp: { $lt: oneYearAgo }
      });
      console.log(`تم أرشفة ${oldLogs.length} سجل قديم`);
    }
    
    // حذف الملفات المؤقتة القديمة
    const oldTempFiles = await db.collection('temp_files').deleteMany({
      createdAt: { $lt: thirtyDaysAgo }
    });
    console.log(`تم حذف ${oldTempFiles.deletedCount} ملف مؤقت قديم`);
  }
};

// تشغيل مهام التحسين
const runOptimization = async () => {
  console.log('بدء مهام تحسين قاعدة البيانات');
  
  try {
    await optimizationTasks.analyzeIndexUsage();
    await optimizationTasks.cleanupOldData();
    await optimizationTasks.compactCollections();
    await optimizationTasks.rebuildIndexes();
    
    console.log('تم إنجاز جميع مهام التحسين');
  } catch (error) {
    console.error('خطأ في مهام التحسين:', error);
  }
};

// جدولة التحسين الأسبوعي
const schedule = require('node-schedule');
schedule.scheduleJob('0 3 * * 0', runOptimization); // كل أحد الساعة 3 صباحاً
```

#### مراقبة الأداء
```javascript
// database-performance-monitor.js
class DatabasePerformanceMonitor {
  constructor() {
    this.metrics = {
      slowQueries: [],
      connectionPool: {},
      indexUsage: {},
      collectionStats: {}
    };
  }

  async startMonitoring() {
    // مراقبة الاستعلامات البطيئة
    setInterval(async () => {
      await this.monitorSlowQueries();
    }, 60000); // كل دقيقة

    // مراقبة pool الاتصالات
    setInterval(async () => {
      await this.monitorConnectionPool();
    }, 30000); // كل 30 ثانية

    // مراقبة إحصائيات المجموعات
    setInterval(async () => {
      await this.monitorCollectionStats();
    }, 300000); // كل 5 دقائق
  }

  async monitorSlowQueries() {
    try {
      // تفعيل profiler للاستعلامات البطيئة (> 100ms)
      await db.admin().command({ profile: 2, slowms: 100 });

      // جلب الاستعلامات البطيئة من آخر دقيقة
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const slowQueries = await db.collection('system.profile')
        .find({ 
          ts: { $gte: oneMinuteAgo },
          millis: { $gte: 100 }
        })
        .sort({ millis: -1 })
        .limit(10)
        .toArray();

      if (slowQueries.length > 0) {
        console.log(`تم اكتشاف ${slowQueries.length} استعلام بطيء:`);
        slowQueries.forEach(query => {
          console.log(`  - ${query.ns}: ${query.millis}ms`);
          console.log(`    الأمر: ${JSON.stringify(query.command)}`);
        });

        // إرسال تنبيه إذا كان هناك أكثر من 5 استعلامات بطيئة
        if (slowQueries.length > 5) {
          await this.sendPerformanceAlert('SLOW_QUERIES', {
            count: slowQueries.length,
            queries: slowQueries
          });
        }
      }

      this.metrics.slowQueries = slowQueries;
    } catch (error) {
      console.error('خطأ في مراقبة الاستعلامات البطيئة:', error);
    }
  }

  async monitorConnectionPool() {
    try {
      const serverStatus = await db.admin().serverStatus();
      const connections = serverStatus.connections;

      this.metrics.connectionPool = {
        current: connections.current,
        available: connections.available,
        totalCreated: connections.totalCreated,
        usage: (connections.current / (connections.current + connections.available)) * 100
      };

      // تحذير إذا كان استخدام الاتصالات عالي
      if (this.metrics.connectionPool.usage > 80) {
        await this.sendPerformanceAlert('HIGH_CONNECTION_USAGE', this.metrics.connectionPool);
      }

      console.log(`اتصالات قاعدة البيانات: ${connections.current}/${connections.current + connections.available} (${this.metrics.connectionPool.usage.toFixed(1)}%)`);
    } catch (error) {
      console.error('خطأ في مراقبة pool الاتصالات:', error);
    }
  }

  async monitorCollectionStats() {
    try {
      const collections = ['patients', 'medical_records', 'appointments', 'prescriptions'];
      
      for (const collectionName of collections) {
        const stats = await db.collection(collectionName).stats();
        
        this.metrics.collectionStats[collectionName] = {
          count: stats.count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          storageSize: stats.storageSize,
          indexSizes: stats.indexSizes,
          totalIndexSize: stats.totalIndexSize
        };

        // تحذير إذا كان حجم المجموعة كبير جداً
        const sizeInGB = stats.storageSize / (1024 * 1024 * 1024);
        if (sizeInGB > 10) {
          await this.sendPerformanceAlert('LARGE_COLLECTION', {
            collection: collectionName,
            sizeGB: sizeInGB
          });
        }
      }
    } catch (error) {
      console.error('خطأ في مراقبة إحصائيات المجموعات:', error);
    }
  }

  async sendPerformanceAlert(type, data) {
    const alert = {
      type,
      timestamp: new Date(),
      data,
      severity: this.getAlertSeverity(type)
    };

    console.log(`تحذير أداء قاعدة البيانات: ${type}`);
    
    // إرسال عبر WebSocket
    io.to('db_admins').emit('db_performance_alert', alert);

    // حفظ في سجل التنبيهات
    await db.collection('performance_alerts').insertOne(alert);
  }

  getAlertSeverity(type) {
    const severityMap = {
      'SLOW_QUERIES': 'medium',
      'HIGH_CONNECTION_USAGE': 'high',
      'LARGE_COLLECTION': 'medium'
    };
    return severityMap[type] || 'low';
  }

  getMetrics() {
    return this.metrics;
  }
}

// بدء مراقبة الأداء
const performanceMonitor = new DatabasePerformanceMonitor();
performanceMonitor.startMonitoring();
```

## إدارة الخوادم

### إعداد Load Balancer

#### تكوين Nginx Load Balancer
```nginx
# /etc/nginx/sites-available/hospital-erp-lb
upstream hospital_erp_backend {
    least_conn;
    server 192.168.1.10:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 192.168.1.11:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 192.168.1.12:3000 weight=2 max_fails=3 fail_timeout=30s backup;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name hospital-erp.example.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/hospital-erp.crt;
    ssl_certificate_key /etc/ssl/private/hospital-erp.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Health Check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # API Routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://hospital_erp_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Login endpoint with stricter rate limiting
    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        
        proxy_pass http://hospital_erp_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        root /var/www/hospital-erp;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://hospital_erp_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Redirect HTTP to HTTPS
    if ($scheme != "https") {
        return 301 https://$host$request_uri;
    }
}
```

#### مراقبة صحة الخوادم
```bash
#!/bin/bash
# health-check.sh

SERVERS=("192.168.1.10:3000" "192.168.1.11:3000" "192.168.1.12:3000")
LOG_FILE="/var/log/health-check.log"
ALERT_EMAIL="admin@hospital.com"

check_server_health() {
    local server=$1
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # فحص HTTP health endpoint
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://$server/health")
    
    if [ "$response" = "200" ]; then
        echo "$timestamp - $server: صحي" >> $LOG_FILE
        return 0
    else
        echo "$timestamp - $server: غير صحي (HTTP $response)" >> $LOG_FILE
        return 1
    fi
}

check_all_servers() {
    local failed_servers=()
    
    for server in "${SERVERS[@]}"; do
        if ! check_server_health "$server"; then
            failed_servers+=("$server")
        fi
    done
    
    if [ ${#failed_servers[@]} -gt 0 ]; then
        local message="تحذير: الخوادم التالية غير متاحة:\n"
        for server in "${failed_servers[@]}"; do
            message="$message- $server\n"
        done
        
        echo -e "$message" | mail -s "تحذير: خوادم غير متاحة" $ALERT_EMAIL
        
        # إرسال تنبيه عبر Slack أو Discord (اختياري)
        # curl -X POST -H 'Content-type: application/json' \
        #   --data "{\"text\":\"$message\"}" \
        #   $SLACK_WEBHOOK_URL
    fi
}

# تشغيل الفحص
check_all_servers
```

### إدارة الحاويات (Docker)

#### Docker Compose للإنتاج
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app1:
    build: .
    container_name: hospital-erp-app1
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MONGODB_URI=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/hospital_erp?replicaSet=rs0
      - REDIS_URL=redis://redis-cluster:6379
    networks:
      - hospital-network
    depends_on:
      - mongo1
      - redis-cluster
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  app2:
    build: .
    container_name: hospital-erp-app2
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MONGODB_URI=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/hospital_erp?replicaSet=rs0
      - REDIS_URL=redis://redis-cluster:6379
    networks:
      - hospital-network
    depends_on:
      - mongo1
      - redis-cluster
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: hospital-erp-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    networks:
      - hospital-network
    depends_on:
      - app1
      - app2

  mongo1:
    image: mongo:5.0
    container_name: hospital-erp-mongo1
    restart: unless-stopped
    command: mongod --replSet rs0 --bind_ip_all
    volumes:
      - mongo1_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js
    networks:
      - hospital-network
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}

  mongo2:
    image: mongo:5.0
    container_name: hospital-erp-mongo2
    restart: unless-stopped
    command: mongod --replSet rs0 --bind_ip_all
    volumes:
      - mongo2_data:/data/db
    networks:
      - hospital-network

  mongo3:
    image: mongo:5.0
    container_name: hospital-erp-mongo3
    restart: unless-stopped
    command: mongod --replSet rs0 --bind_ip_all
    volumes:
      - mongo3_data:/data/db
    networks:
      - hospital-network

  redis-cluster:
    image: redis:alpine
    container_name: hospital-erp-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - hospital-network

  prometheus:
    image: prom/prometheus
    container_name: hospital-erp-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - hospital-network

  grafana:
    image: grafana/grafana
    container_name: hospital-erp-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    networks:
      - hospital-network

volumes:
  mongo1_data:
  mongo2_data:
  mongo3_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  hospital-network:
    driver: bridge
```

#### سكريبت إدارة الحاويات
```bash
#!/bin/bash
# container-management.sh

COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="hospital-erp"

# دوال مساعدة
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# بدء الخدمات
start_services() {
    log "بدء خدمات المستشفى"
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
    
    # انتظار بدء الخدمات
    sleep 30
    
    # فحص حالة الخدمات
    check_services_health
}

# إيقاف الخدمات
stop_services() {
    log "إيقاف خدمات المستشفى"
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
}

# إعادة تشغيل الخدمات
restart_services() {
    log "إعادة تشغيل خدمات المستشفى"
    stop_services
    sleep 10
    start_services
}

# فحص صحة الخدمات
check_services_health() {
    log "فحص صحة الخدمات"
    
    services=("hospital-erp-app1" "hospital-erp-app2" "hospital-erp-nginx" "hospital-erp-mongo1" "hospital-erp-redis")
    
    for service in "${services[@]}"; do
        if docker ps --filter "name=$service" --filter "status=running" | grep -q $service; then
            log "✓ $service يعمل بشكل طبيعي"
        else
            log "✗ $service غير متاح"
            
            # محاولة إعادة تشغيل الخدمة
            docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME restart $service
        fi
    done
}

# تحديث التطبيق
update_application() {
    log "بدء تحديث التطبيق"
    
    # سحب أحدث إصدار
    git pull origin main
    
    # بناء صورة جديدة
    docker-compose -f $COMPOSE_FILE build --no-cache
    
    # إعادة تشغيل التطبيق فقط (بدون قواعد البيانات)
    docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d --no-deps app1 app2
    
    log "تم تحديث التطبيق بنجاح"
}

# نسخ احتياطي للحاويات
backup_containers() {
    log "بدء النسخ الاحتياطي للحاويات"
    
    BACKUP_DIR="/backup/containers/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    # نسخ احتياطي لبيانات MongoDB
    docker exec hospital-erp-mongo1 mongodump --out /tmp/backup
    docker cp hospital-erp-mongo1:/tmp/backup $BACKUP_DIR/mongodb
    
    # نسخ احتياطي لبيانات Redis
    docker exec hospital-erp-redis redis-cli BGSAVE
    docker cp hospital-erp-redis:/data/dump.rdb $BACKUP_DIR/redis/
    
    # ضغط النسخة الاحتياطية
    tar -czf $BACKUP_DIR.tar.gz -C $BACKUP_DIR .
    rm -rf $BACKUP_DIR
    
    log "تم إنشاء نسخة احتياطية: $BACKUP_DIR.tar.gz"
}

# عرض سجلات الخدمات
show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
    else
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f $service
    fi
}

# عرض إحصائيات الموارد
show_stats() {
    log "إحصائيات استخدام الموارد:"
    docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# معالجة المعاملات
case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    health)
        check_services_health
        ;;
    update)
        update_application
        ;;
    backup)
        backup_containers
        ;;
    logs)
        show_logs $2
        ;;
    stats)
        show_stats
        ;;
    *)
        echo "الاستخدام: $0 {start|stop|restart|health|update|backup|logs|stats}"
        exit 1
        ;;
esac
```

## النسخ الاحتياطية

### استراتيجية النسخ الاحتياطية المتقدمة

#### نسخ احتياطية تدريجية
```bash
#!/bin/bash
# incremental-backup.sh

BACKUP_BASE="/secure/backups"
FULL_BACKUP_DIR="$BACKUP_BASE/full"
INCREMENTAL_BACKUP_DIR="$BACKUP_BASE/incremental"
LOG_FILE="/var/log/backup-incremental.log"

# إعدادات
RETENTION_DAYS=30
FULL_BACKUP_INTERVAL=7 # أيام

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# فحص ما إذا كانت هناك حاجة لنسخة احتياطية كاملة
needs_full_backup() {
    local last_full_backup=$(find $FULL_BACKUP_DIR -name "*.tar.gz.enc" -mtime -$FULL_BACKUP_INTERVAL | wc -l)
    [ $last_full_backup -eq 0 ]
}

# إنشاء نسخة احتياطية كاملة
create_full_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$FULL_BACKUP_DIR/full_backup_$timestamp.tar.gz.enc"
    
    log "بدء النسخة الاحتياطية الكاملة"
    
    # إنشاء قائمة بجميع الملفات
    find /var/hospital-erp -type f > /tmp/full_backup_list_$timestamp
    
    # إنشاء النسخة الاحتياطية
    tar -czf - -T /tmp/full_backup_list_$timestamp | \
    openssl enc -aes-256-cbc -salt -k $(cat /secure/keys/backup.key) > $backup_file
    
    # حفظ قائمة الملفات للمقارنة
    cp /tmp/full_backup_list_$timestamp $FULL_BACKUP_DIR/files_$timestamp.list
    
    # تنظيف
    rm /tmp/full_backup_list_$timestamp
    
    log "تمت النسخة الاحتياطية الكاملة: $backup_file"
    echo $backup_file
}

# إنشاء نسخة احتياطية تدريجية
create_incremental_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$INCREMENTAL_BACKUP_DIR/incremental_backup_$timestamp.tar.gz.enc"
    
    # العثور على آخر نسخة احتياطية (كاملة أو تدريجية)
    local last_backup_list=$(ls -t $FULL_BACKUP_DIR/files_*.list $INCREMENTAL_BACKUP_DIR/files_*.list 2>/dev/null | head -1)
    
    if [ -z "$last_backup_list" ]; then
        log "لم يتم العثور على نسخة احتياطية سابقة، سيتم إنشاء نسخة كاملة"
        create_full_backup
        return
    fi
    
    log "بدء النسخة الاحتياطية التدريجية"
    
    # إنشاء قائمة بالملفات الحالية
    find /var/hospital-erp -type f > /tmp/current_files_$timestamp
    
    # العثور على الملفات المتغيرة أو الجديدة
    comm -13 <(sort $last_backup_list) <(sort /tmp/current_files_$timestamp) > /tmp/changed_files_$timestamp
    
    # إضافة الملفات المعدلة منذ آخر نسخة احتياطية
    local last_backup_time=$(stat -c %Y $last_backup_list)
    find /var/hospital-erp -type f -newer $last_backup_list >> /tmp/changed_files_$timestamp
    
    # إزالة التكرارات
    sort /tmp/changed_files_$timestamp | uniq > /tmp/incremental_files_$timestamp
    
    local changed_count=$(wc -l < /tmp/incremental_files_$timestamp)
    
    if [ $changed_count -eq 0 ]; then
        log "لا توجد ملفات متغيرة، تم تخطي النسخة الاحتياطية"
        rm /tmp/current_files_$timestamp /tmp/changed_files_$timestamp /tmp/incremental_files_$timestamp
        return
    fi
    
    log "تم العثور على $changed_count ملف متغير"
    
    # إنشاء النسخة الاحتياطية التدريجية
    tar -czf - -T /tmp/incremental_files_$timestamp | \
    openssl enc -aes-256-cbc -salt -k $(cat /secure/keys/backup.key) > $backup_file
    
    # حفظ قائمة الملفات
    cp /tmp/current_files_$timestamp $INCREMENTAL_BACKUP_DIR/files_$timestamp.list
    cp /tmp/incremental_files_$timestamp $INCREMENTAL_BACKUP_DIR/changed_files_$timestamp.list
    
    # تنظيف
    rm /tmp/current_files_$timestamp /tmp/changed_files_$timestamp /tmp/incremental_files_$timestamp
    
    log "تمت النسخة الاحتياطية التدريجية: $backup_file"
    echo $backup_file
}

# تنظيف النسخ القديمة
cleanup_old_backups() {
    log "تنظيف النسخ الاحتياطية القديمة"
    
    # حذف النسخ الكاملة القديمة
    find $FULL_BACKUP_DIR -name "*.tar.gz.enc" -mtime +$RETENTION_DAYS -delete
    find $FULL_BACKUP_DIR -name "files_*.list" -mtime +$RETENTION_DAYS -delete
    
    # حذف النسخ التدريجية القديمة
    find $INCREMENTAL_BACKUP_DIR -name "*.tar.gz.enc" -mtime +$RETENTION_DAYS -delete
    find $INCREMENTAL_BACKUP_DIR -name "files_*.list" -mtime +$RETENTION_DAYS -delete
    find $INCREMENTAL_BACKUP_DIR -name "changed_files_*.list" -mtime +$RETENTION_DAYS -delete
    
    log "تم تنظيف النسخ القديمة"
}

# التحقق من سلامة النسخ الاحتياطية
verify_backups() {
    log "التحقق من سلامة النسخ الاحتياطية"
    
    local failed_backups=0
    
    # فحص النسخ الكاملة
    for backup in $(find $FULL_BACKUP_DIR -name "*.tar.gz.enc" -mtime -7); do
        if openssl enc -aes-256-cbc -d -k $(cat /secure/keys/backup.key) -in $backup | tar -tzf - > /dev/null 2>&1; then
            log "✓ سليمة: $(basename $backup)"
        else
            log "✗ تالفة: $(basename $backup)"
            ((failed_backups++))
        fi
    done
    
    # فحص النسخ التدريجية
    for backup in $(find $INCREMENTAL_BACKUP_DIR -name "*.tar.gz.enc" -mtime -7); do
        if openssl enc -aes-256-cbc -d -k $(cat /secure/keys/backup.key) -in $backup | tar -tzf - > /dev/null 2>&1; then
            log "✓ سليمة: $(basename $backup)"
        else
            log "✗ تالفة: $(basename $backup)"
            ((failed_backups++))
        fi
    done
    
    if [ $failed_backups -gt 0 ]; then
        log "تحذير: تم العثور على $failed_backups نسخة احتياطية تالفة"
        # إرسال تنبيه
        echo "تم العثور على نسخ احتياطية تالفة" | mail -s "تحذير: نسخ احتياطية تالفة" admin@hospital.com
    fi
}

# الدالة الرئيسية
main() {
    log "بدء عملية النسخ الاحتياطي"
    
    # إنشاء المجلدات إذا لم تكن موجودة
    mkdir -p $FULL_BACKUP_DIR $INCREMENTAL_BACKUP_DIR
    
    # تحديد نوع النسخة الاحتياطية
    if needs_full_backup; then
        create_full_backup
    else
        create_incremental_backup
    fi
    
    # تنظيف النسخ القديمة
    cleanup_old_backups
    
    # التحقق من سلامة النسخ
    verify_backups
    
    log "انتهاء عملية النسخ الاحتياطي"
}

# تشغيل النسخ الاحتياطي
main "$@"
```

#### نسخ احتياطية لقاعدة البيانات
```bash
#!/bin/bash
# database-backup.sh

DB_HOST="localhost"
DB_PORT="27017"
DB_NAME="hospital_erp"
BACKUP_DIR="/secure/db-backups"
RETENTION_DAYS=30

# إنشاء نسخة احتياطية لقاعدة البيانات
create_db_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/mongodb_$timestamp"
    
    log "بدء النسخة الاحتياطية لقاعدة البيانات"
    
    # إنشاء النسخة الاحتياطية
    mongodump --host $DB_HOST:$DB_PORT --db $DB_NAME --out $backup_path
    
    # ضغط النسخة الاحتياطية
    tar -czf $backup_path.tar.gz -C $BACKUP_DIR $(basename $backup_path)
    rm -rf $backup_path
    
    # تشفير النسخة الاحتياطية
    openssl enc -aes-256-cbc -salt -k $(cat /secure/keys/db-backup.key) \
        -in $backup_path.tar.gz -out $backup_path.tar.gz.enc
    rm $backup_path.tar.gz
    
    log "تمت النسخة الاحتياطية: $backup_path.tar.gz.enc"
}

# استعادة قاعدة البيانات
restore_database() {
    local backup_file=$1
    local temp_dir="/tmp/db_restore_$(date +%s)"
    
    if [ ! -f "$backup_file" ]; then
        echo "ملف النسخة الاحتياطية غير موجود: $backup_file"
        exit 1
    fi
    
    log "بدء استعادة قاعدة البيانات من: $backup_file"
    
    # فك التشفير
    openssl enc -aes-256-cbc -d -k $(cat /secure/keys/db-backup.key) \
        -in $backup_file -out ${backup_file%.enc}
    
    # فك الضغط
    mkdir -p $temp_dir
    tar -xzf ${backup_file%.enc} -C $temp_dir
    
    # استعادة قاعدة البيانات
    mongorestore --host $DB_HOST:$DB_PORT --db $DB_NAME --drop $temp_dir/*/
    
    # تنظيف
    rm -rf $temp_dir ${backup_file%.enc}
    
    log "تمت استعادة قاعدة البيانات بنجاح"
}
```

## استكشاف الأخطاء وإصلاحها

### الأخطاء الشائعة وحلولها

#### مشاكل الأداء
```javascript
// performance-troubleshooting.js
class PerformanceTroubleshooter {
  constructor() {
    this.diagnostics = [];
  }

  async diagnosePerformanceIssues() {
    console.log('بدء تشخيص مشاكل الأداء...');
    
    // فحص استخدام المعالج
    await this.checkCPUUsage();
    
    // فحص استخدام الذاكرة
    await this.checkMemoryUsage();
    
    // فحص أداء قاعدة البيانات
    await this.checkDatabasePerformance();
    
    // فحص أداء الشبكة
    await this.checkNetworkPerformance();
    
    // تحليل السجلات
    await this.analyzeLogs();
    
    return this.generateReport();
  }

  async checkCPUUsage() {
    const cpuUsage = await this.getCPUUsage();
    
    if (cpuUsage > 80) {
      this.diagnostics.push({
        issue: 'HIGH_CPU_USAGE',
        severity: 'high',
        value: cpuUsage,
        recommendations: [
          'فحص العمليات التي تستهلك المعالج بكثرة',
          'تحسين الاستعلامات البطيئة',
          'زيادة عدد الخوادم أو ترقية المعالج'
        ]
      });
    }
  }

  async checkMemoryUsage() {
    const memoryUsage = await this.getMemoryUsage();
    
    if (memoryUsage > 85) {
      this.diagnostics.push({
        issue: 'HIGH_MEMORY_USAGE',
        severity: 'high',
        value: memoryUsage,
        recommendations: [
          'إعادة تشغيل التطبيق لتحرير الذاكرة',
          'فحص تسريبات الذاكرة في الكود',
          'زيادة حجم الذاكرة المتاحة'
        ]
      });
    }
  }

  async checkDatabasePerformance() {
    const dbStats = await this.getDatabaseStats();
    
    if (dbStats.avgQueryTime > 1000) {
      this.diagnostics.push({
        issue: 'SLOW_DATABASE_QUERIES',
        severity: 'medium',
        value: dbStats.avgQueryTime,
        recommendations: [
          'إضافة فهارس للحقول المستخدمة في البحث',
          'تحسين الاستعلامات المعقدة',
          'تحديث إحصائيات قاعدة البيانات'
        ]
      });
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date(),
      totalIssues: this.diagnostics.length,
      criticalIssues: this.diagnostics.filter(d => d.severity === 'critical').length,
      highIssues: this.diagnostics.filter(d => d.severity === 'high').length,
      mediumIssues: this.diagnostics.filter(d => d.severity === 'medium').length,
      diagnostics: this.diagnostics,
      recommendations: this.getTopRecommendations()
    };

    return report;
  }
}
```

#### مشاكل قاعدة البيانات
```bash
#!/bin/bash
# database-troubleshooting.sh

# فحص حالة قاعدة البيانات
check_database_status() {
    echo "فحص حالة قاعدة البيانات..."
    
    # فحص ما إذا كانت MongoDB تعمل
    if ! pgrep mongod > /dev/null; then
        echo "خطأ: MongoDB غير قيد التشغيل"
        echo "الحل: systemctl start mongod"
        return 1
    fi
    
    # فحص الاتصال
    if ! mongo --eval "db.runCommand('ping')" > /dev/null 2>&1; then
        echo "خطأ: لا يمكن الاتصال بقاعدة البيانات"
        echo "الحل: فحص إعدادات الشبكة والمنافذ"
        return 1
    fi
    
    echo "✓ قاعدة البيانات تعمل بشكل طبيعي"
    return 0
}

# إصلاح قاعدة البيانات التالفة
repair_database() {
    echo "بدء إصلاح قاعدة البيانات..."
    
    # إيقاف MongoDB
    systemctl stop mongod
    
    # إصلاح قاعدة البيانات
    mongod --repair --dbpath /var/lib/mongodb
    
    # إعادة تشغيل MongoDB
    systemctl start mongod
    
    echo "تم إصلاح قاعدة البيانات"
}

# فحص مساحة القرص
check_disk_space() {
    local usage=$(df /var/lib/mongodb | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ $usage -gt 90 ]; then
        echo "تحذير: مساحة القرص ممتلئة ($usage%)"
        echo "الحلول:"
        echo "1. حذف السجلات القديمة"
        echo "2. ضغط قاعدة البيانات"
        echo "3. نقل البيانات إلى قرص أكبر"
        return 1
    fi
    
    echo "✓ مساحة القرص كافية ($usage%)"
    return 0
}

# تحسين الأداء
optimize_performance() {
    echo "تحسين أداء قاعدة البيانات..."
    
    # إعادة بناء الفهارس
    mongo hospital_erp --eval "
        db.patients.reIndex();
        db.medical_records.reIndex();
        db.appointments.reIndex();
    "
    
    # ضغط المجموعات
    mongo hospital_erp --eval "
        db.runCommand({compact: 'patients'});
        db.runCommand({compact: 'medical_records'});
    "
    
    echo "تم تحسين الأداء"
}
```

#### مشاكل الشبكة والاتصال
```bash
#!/bin/bash
# network-troubleshooting.sh

# فحص الاتصال بالإنترنت
check_internet_connection() {
    echo "فحص الاتصال بالإنترنت..."
    
    if ping -c 3 8.8.8.8 > /dev/null 2>&1; then
        echo "✓ الاتصال بالإنترنت يعمل"
    else
        echo "✗ لا يوجد اتصال بالإنترنت"
        echo "الحلول:"
        echo "1. فحص كابل الشبكة"
        echo "2. إعادة تشغيل جهاز التوجيه"
        echo "3. فحص إعدادات الشبكة"
    fi
}

# فحص المنافذ
check_ports() {
    echo "فحص المنافذ المطلوبة..."
    
    local ports=(3000 27017 6379 80 443)
    
    for port in "${ports[@]}"; do
        if netstat -tuln | grep ":$port " > /dev/null; then
            echo "✓ المنفذ $port مفتوح"
        else
            echo "✗ المنفذ $port مغلق"
            echo "الحل: فحص إعدادات الجدار الناري"
        fi
    done
}

# فحص SSL/TLS
check_ssl_certificates() {
    echo "فحص شهادات SSL..."
    
    local cert_file="/etc/ssl/certs/hospital-erp.crt"
    
    if [ -f "$cert_file" ]; then
        local expiry_date=$(openssl x509 -in $cert_file -noout -enddate | cut -d= -f2)
        local expiry_timestamp=$(date -d "$expiry_date" +%s)
        local current_timestamp=$(date +%s)
        local days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [ $days_until_expiry -lt 30 ]; then
            echo "تحذير: شهادة SSL ستنتهي خلال $days_until_expiry يوم"
            echo "الحل: تجديد شهادة SSL"
        else
            echo "✓ شهادة SSL صالحة لـ $days_until_expiry يوم"
        fi
    else
        echo "✗ شهادة SSL غير موجودة"
        echo "الحل: تثبيت شهادة SSL صالحة"
    fi
}
```

## التحديثات والترقيات

### إجراءات التحديث الآمنة

#### سكريبت التحديث التلقائي
```bash
#!/bin/bash
# auto-update.sh

PROJECT_DIR="/var/hospital-erp"
BACKUP_DIR="/backup/pre-update"
LOG_FILE="/var/log/hospital-erp-update.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a $LOG_FILE
}

# إنشاء نسخة احتياطية قبل التحديث
create_pre_update_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="$BACKUP_DIR/backup_$timestamp"
    
    log "إنشاء نسخة احتياطية قبل التحديث"
    
    mkdir -p $backup_path
    
    # نسخ ملفات التطبيق
    cp -r $PROJECT_DIR $backup_path/application
    
    # نسخ قاعدة البيانات
    mongodump --db hospital_erp --out $backup_path/database
    
    # ضغط النسخة الاحتياطية
    tar -czf $backup_path.tar.gz -C $BACKUP_DIR $(basename $backup_path)
    rm -rf $backup_path
    
    log "تمت النسخة الاحتياطية: $backup_path.tar.gz"
    echo $backup_path.tar.gz
}

# تحديث التطبيق
update_application() {
    log "بدء تحديث التطبيق"
    
    cd $PROJECT_DIR
    
    # جلب أحدث التحديثات
    git fetch origin
    
    # فحص ما إذا كانت هناك تحديثات متاحة
    local current_commit=$(git rev-parse HEAD)
    local latest_commit=$(git rev-parse origin/main)
    
    if [ "$current_commit" = "$latest_commit" ]; then
        log "لا توجد تحديثات متاحة"
        return 0
    fi
    
    log "تحديثات متاحة، بدء عملية التحديث"
    
    # إيقاف التطبيق
    systemctl stop hospital-erp
    
    # تطبيق التحديثات
    git pull origin main
    
    # تحديث التبعيات
    npm ci --production
    
    # تشغيل migrations إذا كانت موجودة
    if [ -f "migrations/migrate.js" ]; then
        node migrations/migrate.js
    fi
    
    # إعادة تشغيل التطبيق
    systemctl start hospital-erp
    
    # انتظار بدء التطبيق
    sleep 10
    
    # فحص حالة التطبيق
    if systemctl is-active --quiet hospital-erp; then
        log "تم تحديث التطبيق بنجاح"
        return 0
    else
        log "فشل في تحديث التطبيق، بدء الاستعادة"
        return 1
    fi
}

# استعادة النسخة السابقة
rollback_update() {
    local backup_file=$1
    
    log "بدء استعادة النسخة السابقة"
    
    # إيقاف التطبيق
    systemctl stop hospital-erp
    
    # استعادة ملفات التطبيق
    local temp_dir="/tmp/rollback_$(date +%s)"
    mkdir -p $temp_dir
    tar -xzf $backup_file -C $temp_dir
    
    rm -rf $PROJECT_DIR
    mv $temp_dir/*/application $PROJECT_DIR
    
    # استعادة قاعدة البيانات
    mongorestore --db hospital_erp --drop $temp_dir/*/database/hospital_erp/
    
    # تنظيف
    rm -rf $temp_dir
    
    # إعادة تشغيل التطبيق
    systemctl start hospital-erp
    
    log "تمت استعادة النسخة السابقة"
}

# اختبار التطبيق بعد التحديث
test_application() {
    log "اختبار التطبيق بعد التحديث"
    
    # فحص حالة الخدمة
    if ! systemctl is-active --quiet hospital-erp; then
        log "التطبيق غير قيد التشغيل"
        return 1
    fi
    
    # فحص الاتصال بقاعدة البيانات
    if ! curl -s http://localhost:3000/health | grep -q "healthy"; then
        log "فشل في اختبار صحة التطبيق"
        return 1
    fi
    
    # اختبار API أساسي
    if ! curl -s http://localhost:3000/api/health | grep -q "ok"; then
        log "فشل في اختبار API"
        return 1
    fi
    
    log "جميع الاختبارات نجحت"
    return 0
}

# الدالة الرئيسية
main() {
    log "بدء عملية التحديث التلقائي"
    
    # إنشاء نسخة احتياطية
    local backup_file=$(create_pre_update_backup)
    
    # تحديث التطبيق
    if update_application; then
        # اختبار التطبيق
        if test_application; then
            log "تم التحديث بنجاح"
            
            # إرسال إشعار بالنجاح
            echo "تم تحديث نظام المستشفى بنجاح" | \
            mail -s "تحديث ناجح - نظام المستشفى" admin@hospital.com
        else
            log "فشل في اختبار التطبيق، بدء الاستعادة"
            rollback_update $backup_file
        fi
    else
        log "فشل في التحديث، بدء الاستعادة"
        rollback_update $backup_file
    fi
    
    log "انتهاء عملية التحديث"
}

# تشغيل التحديث
main "$@"
```

## الدعم الفني

### نظام التذاكر والدعم

#### إعداد نظام التذاكر
```javascript
// support-ticket-system.js
class SupportTicketSystem {
  constructor() {
    this.tickets = new Map();
    this.categories = [
      'technical_issue',
      'bug_report',
      'feature_request',
      'user_support',
      'security_incident',
      'performance_issue'
    ];
    this.priorities = ['low', 'medium', 'high', 'critical'];
    this.statuses = ['open', 'in_progress', 'resolved', 'closed'];
  }

  async createTicket(ticketData) {
    const ticket = {
      id: this.generateTicketId(),
      title: ticketData.title,
      description: ticketData.description,
      category: ticketData.category,
      priority: ticketData.priority || 'medium',
      status: 'open',
      reporter: ticketData.reporter,
      assignee: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      comments: [],
      attachments: ticketData.attachments || []
    };

    // تحديد الأولوية التلقائية حسب الفئة
    if (ticketData.category === 'security_incident') {
      ticket.priority = 'critical';
    } else if (ticketData.category === 'performance_issue') {
      ticket.priority = 'high';
    }

    // تعيين تلقائي للمختص
    ticket.assignee = await this.autoAssignTicket(ticket);

    this.tickets.set(ticket.id, ticket);

    // إرسال إشعارات
    await this.sendTicketNotifications(ticket, 'created');

    return ticket;
  }

  async autoAssignTicket(ticket) {
    const assignmentRules = {
      'technical_issue': 'tech_team',
      'bug_report': 'dev_team',
      'feature_request': 'product_team',
      'user_support': 'support_team',
      'security_incident': 'security_team',
      'performance_issue': 'tech_team'
    };

    const team = assignmentRules[ticket.category] || 'support_team';
    
    // العثور على أقل عضو مشغول في الفريق
    const availableAgent = await this.findAvailableAgent(team);
    
    return availableAgent;
  }

  async updateTicketStatus(ticketId, newStatus, comment) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error('التذكرة غير موجودة');
    }

    const oldStatus = ticket.status;
    ticket.status = newStatus;
    ticket.updatedAt = new Date();

    if (comment) {
      ticket.comments.push({
        id: Date.now(),
        text: comment,
        author: 'system',
        timestamp: new Date()
      });
    }

    // إرسال إشعارات
    await this.sendTicketNotifications(ticket, 'status_changed', {
      oldStatus,
      newStatus
    });

    return ticket;
  }

  async addComment(ticketId, comment, author) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error('التذكرة غير موجودة');
    }

    const newComment = {
      id: Date.now(),
      text: comment,
      author: author,
      timestamp: new Date()
    };

    ticket.comments.push(newComment);
    ticket.updatedAt = new Date();

    // إرسال إشعار
    await this.sendTicketNotifications(ticket, 'comment_added', {
      comment: newComment
    });

    return ticket;
  }

  generateTicketId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `HOSP-${timestamp}-${random}`.toUpperCase();
  }

  async sendTicketNotifications(ticket, action, data = {}) {
    const notifications = [];

    switch (action) {
      case 'created':
        notifications.push({
          to: ticket.assignee,
          subject: `تذكرة جديدة: ${ticket.title}`,
          body: `تم إنشاء تذكرة جديدة برقم ${ticket.id}\n\nالعنوان: ${ticket.title}\nالأولوية: ${ticket.priority}\nالفئة: ${ticket.category}`
        });
        break;

      case 'status_changed':
        notifications.push({
          to: ticket.reporter,
          subject: `تحديث التذكرة ${ticket.id}`,
          body: `تم تغيير حالة التذكرة من ${data.oldStatus} إلى ${data.newStatus}`
        });
        break;

      case 'comment_added':
        notifications.push({
          to: ticket.reporter,
          subject: `تعليق جديد على التذكرة ${ticket.id}`,
          body: `تم إضافة تعليق جديد:\n\n${data.comment.text}`
        });
        break;
    }

    // إرسال الإشعارات
    for (const notification of notifications) {
      await this.sendNotification(notification);
    }
  }

  async generateSupportReport() {
    const tickets = Array.from(this.tickets.values());
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const report = {
      totalTickets: tickets.length,
      openTickets: tickets.filter(t => t.status === 'open').length,
      resolvedTickets: tickets.filter(t => t.status === 'resolved').length,
      averageResolutionTime: this.calculateAverageResolutionTime(tickets),
      ticketsByCategory: this.groupTicketsByCategory(tickets),
      ticketsByPriority: this.groupTicketsByPriority(tickets),
      monthlyTrend: this.getMonthlyTrend(tickets, lastMonth)
    };

    return report;
  }
}
```

## إجراءات الطوارئ

### خطة الاستجابة للطوارئ

#### إجراءات الطوارئ التقنية
```bash
#!/bin/bash
# emergency-procedures.sh

EMERGENCY_LOG="/var/log/emergency-response.log"
ADMIN_EMAIL="admin@hospital.com"
EMERGENCY_CONTACTS=("admin1@hospital.com" "admin2@hospital.com")

log_emergency() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [EMERGENCY] - $1" | tee -a $EMERGENCY_LOG
}

# إجراءات الطوارئ للخادم
server_emergency_procedures() {
    local issue_type=$1
    
    log_emergency "بدء إجراءات الطوارئ للخادم: $issue_type"
    
    case $issue_type in
        "high_cpu")
            handle_high_cpu_emergency
            ;;
        "out_of_memory")
            handle_memory_emergency
            ;;
        "disk_full")
            handle_disk_full_emergency
            ;;
        "database_down")
            handle_database_emergency
            ;;
        "application_crash")
            handle_application_crash
            ;;
        *)
            log_emergency "نوع طارئ غير معروف: $issue_type"
            ;;
    esac
}

# التعامل مع استهلاك عالي للمعالج
handle_high_cpu_emergency() {
    log_emergency "التعامل مع استهلاك عالي للمعالج"
    
    # العثور على العمليات التي تستهلك المعالج
    local top_processes=$(ps aux --sort=-%cpu | head -10)
    log_emergency "العمليات الأكثر استهلاكاً للمعالج:\n$top_processes"
    
    # إيقاف العمليات غير الضرورية
    pkill -f "non-essential-process"
    
    # إعادة تشغيل التطبيق إذا كان يستهلك موارد كثيرة
    if pgrep -f "hospital-erp" | xargs ps -o %cpu= | awk '{sum+=$1} END {print sum}' | awk '{if($1>80) exit 0; else exit 1}'; then
        log_emergency "إعادة تشغيل التطبيق بسبب الاستهلاك العالي للمعالج"
        systemctl restart hospital-erp
    fi
    
    send_emergency_alert "استهلاك عالي للمعالج" "تم اتخاذ إجراءات تصحيحية"
}

# التعامل مع نفاد الذاكرة
handle_memory_emergency() {
    log_emergency "التعامل مع نفاد الذاكرة"
    
    # تحرير ذاكرة التخزين المؤقت
    sync && echo 3 > /proc/sys/vm/drop_caches
    
    # إيقاف الخدمات غير الضرورية
    systemctl stop unnecessary-service
    
    # إعادة تشغيل التطبيق
    systemctl restart hospital-erp
    
    send_emergency_alert "نفاد الذاكرة" "تم تحرير الذاكرة وإعادة تشغيل التطبيق"
}

# التعامل مع امتلاء القرص
handle_disk_full_emergency() {
    log_emergency "التعامل مع امتلاء القرص"
    
    # حذف الملفات المؤقتة
    find /tmp -type f -mtime +1 -delete
    find /var/tmp -type f -mtime +1 -delete
    
    # ضغط السجلات القديمة
    find /var/log -name "*.log" -size +100M -exec gzip {} \;
    
    # حذف النسخ الاحتياطية القديمة
    find /backup -name "*.tar.gz" -mtime +30 -delete
    
    # فحص المساحة المتاحة
    local available_space=$(df / | awk 'NR==2 {print $4}')
    log_emergency "المساحة المتاحة بعد التنظيف: $available_space KB"
    
    send_emergency_alert "امتلاء القرص" "تم تحرير مساحة القرص"
}

# إرسال تنبيه طارئ
send_emergency_alert() {
    local subject=$1
    local message=$2
    
    local full_message="تحذير طارئ - نظام المستشفى\n\nالمشكلة: $subject\nالإجراء المتخذ: $message\nالوقت: $(date)\nالخادم: $(hostname)"
    
    # إرسال بريد إلكتروني
    for contact in "${EMERGENCY_CONTACTS[@]}"; do
        echo -e "$full_message" | mail -s "طوارئ: $subject" $contact
    done
    
    # إرسال عبر Slack أو Discord (إذا كان متاحاً)
    if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$full_message\"}" \
            $SLACK_WEBHOOK_URL
    fi
    
    log_emergency "تم إرسال تنبيه طارئ: $subject"
}

# مراقبة مستمرة للطوارئ
monitor_for_emergencies() {
    while true; do
        # فحص استخدام المعالج
        local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
        if (( $(echo "$cpu_usage > 90" | bc -l) )); then
            server_emergency_procedures "high_cpu"
        fi
        
        # فحص استخدام الذاكرة
        local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        if [ $memory_usage -gt 95 ]; then
            server_emergency_procedures "out_of_memory"
        fi
        
        # فحص مساحة القرص
        local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
        if [ $disk_usage -gt 95 ]; then
            server_emergency_procedures "disk_full"
        fi
        
        # فحص حالة التطبيق
        if ! systemctl is-active --quiet hospital-erp; then
            server_emergency_procedures "application_crash"
        fi
        
        sleep 60 # فحص كل دقيقة
    done
}

# بدء المراقبة
if [ "$1" = "monitor" ]; then
    log_emergency "بدء مراقبة الطوارئ"
    monitor_for_emergencies
elif [ "$1" = "handle" ] && [ ! -z "$2" ]; then
    server_emergency_procedures "$2"
else
    echo "الاستخدام: $0 {monitor|handle <emergency_type>}"
    echo "أنواع الطوارئ: high_cpu, out_of_memory, disk_full, database_down, application_crash"
fi
```

---

## الخلاصة

هذا الدليل يوفر إطار عمل شامل لصيانة ودعم نظام إدارة المستشفيات. يجب مراجعة وتحديث هذه الإجراءات بانتظام لضمان فعاليتها واستمرارية عمل النظام بأفضل أداء ممكن.

### نقاط مهمة للتذكر:

1. **المراقبة المستمرة** ضرورية لاكتشاف المشاكل مبكراً
2. **النسخ الاحتياطية المنتظمة** أساسية لحماية البيانات
3. **التوثيق الدقيق** يساعد في حل المشاكل بسرعة
4. **التدريب المستمر** للفريق التقني مهم جداً
5. **خطط الطوارئ** يجب اختبارها بانتظام

للحصول على الدعم الفني، يرجى التواصل مع فريق الدعم على: support@hospital-erp.com