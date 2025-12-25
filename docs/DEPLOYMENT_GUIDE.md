# دليل النشر والإنتاج - نظام إدارة المستشفيات

## نظرة عامة

هذا الدليل يوضح كيفية نشر نظام إدارة المستشفيات في بيئة الإنتاج بطريقة آمنة وموثوقة، مع ضمان الأداء العالي والتوفر المستمر.

## متطلبات البيئة الإنتاجية

### متطلبات الخادم

#### الخادم الرئيسي (Application Server)
- **المعالج**: Intel Xeon أو AMD EPYC (8 cores أو أكثر)
- **الذاكرة**: 32GB RAM (الحد الأدنى 16GB)
- **التخزين**: 500GB SSD NVMe
- **الشبكة**: 1Gbps Ethernet
- **نظام التشغيل**: Ubuntu 22.04 LTS أو CentOS 8

#### خادم قاعدة البيانات (Database Server)
- **المعالج**: Intel Xeon أو AMD EPYC (16 cores أو أكثر)
- **الذاكرة**: 64GB RAM (الحد الأدنى 32GB)
- **التخزين**: 1TB SSD NVMe + 2TB HDD للنسخ الاحتياطية
- **الشبكة**: 10Gbps Ethernet (للاتصال الداخلي)

#### خادم التخزين المؤقت (Cache Server)
- **المعالج**: Intel Core i7 أو AMD Ryzen 7
- **الذاكرة**: 16GB RAM
- **التخزين**: 100GB SSD
- **الشبكة**: 1Gbps Ethernet

### متطلبات الشبكة

```yaml
# network-requirements.yml
network_architecture:
  load_balancer:
    type: "Nginx"
    ssl_termination: true
    rate_limiting: true
    
  application_tier:
    servers: 2
    load_balancing: "round_robin"
    health_checks: true
    
  database_tier:
    primary: 1
    replica: 1
    backup_network: "isolated"
    
  security:
    firewall: "UFW/iptables"
    vpn: "WireGuard"
    ssl_certificates: "Let's Encrypt"
```

---

## إعداد البيئة الإنتاجية

### 1. إعداد الخوادم

#### تحديث النظام وتثبيت المتطلبات الأساسية

```bash
#!/bin/bash
# setup-production-server.sh

# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت المتطلبات الأساسية
sudo apt install -y curl wget git unzip software-properties-common

# تثبيت Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# تثبيت PM2 لإدارة العمليات
sudo npm install -g pm2

# تثبيت Nginx
sudo apt install -y nginx

# تثبيت UFW للجدار الناري
sudo apt install -y ufw

# إعداد الجدار الناري
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ تم إعداد الخادم بنجاح"
```

#### إعداد MongoDB

```bash
#!/bin/bash
# setup-mongodb.sh

# إضافة مفتاح MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# إضافة مستودع MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# تحديث قائمة الحزم وتثبيت MongoDB
sudo apt update
sudo apt install -y mongodb-org

# بدء وتمكين MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# إنشاء مستخدم إداري
mongo --eval "
db.createUser({
  user: 'admin',
  pwd: '$(openssl rand -base64 32)',
  roles: [
    { role: 'userAdminAnyDatabase', db: 'admin' },
    { role: 'readWriteAnyDatabase', db: 'admin' }
  ]
})
"

echo "✅ تم إعداد MongoDB بنجاح"
```

#### إعداد Redis

```bash
#!/bin/bash
# setup-redis.sh

# تثبيت Redis
sudo apt install -y redis-server

# إعداد Redis للإنتاج
sudo tee /etc/redis/redis.conf > /dev/null <<EOF
# إعدادات الأمان
bind 127.0.0.1
protected-mode yes
port 6379
requirepass $(openssl rand -base64 32)

# إعدادات الأداء
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# إعدادات السجلات
loglevel notice
logfile /var/log/redis/redis-server.log
EOF

# إعادة تشغيل Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

echo "✅ تم إعداد Redis بنجاح"
```

### 2. إعداد SSL/TLS

#### الحصول على شهادة SSL من Let's Encrypt

```bash
#!/bin/bash
# setup-ssl.sh

# تثبيت Certbot
sudo apt install -y certbot python3-certbot-nginx

# الحصول على شهادة SSL
sudo certbot --nginx -d hospital.example.com -d api.hospital.example.com

# إعداد التجديد التلقائي
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -

echo "✅ تم إعداد SSL بنجاح"
```

#### إعداد Nginx مع SSL

```nginx
# /etc/nginx/sites-available/hospital-erp
server {
    listen 80;
    server_name hospital.example.com api.hospital.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hospital.example.com;

    # إعدادات SSL
    ssl_certificate /etc/letsencrypt/live/hospital.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hospital.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # إعدادات الأمان
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # إعدادات الضغط
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # خدمة الملفات الثابتة
    location /static/ {
        alias /var/www/hospital-erp/frontend/build/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # توجيه طلبات API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # توجيه WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # خدمة تطبيق React
    location / {
        root /var/www/hospital-erp/frontend/build;
        try_files $uri $uri/ /index.html;
        
        # إعدادات التخزين المؤقت
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # إعدادات الحد من المعدل
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://localhost:5000;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:5000;
    }
}
```

---

## نشر التطبيق

### 1. إعداد متغيرات البيئة الإنتاجية

```bash
# /var/www/hospital-erp/.env.production
NODE_ENV=production
PORT=5000

# قاعدة البيانات
DB_HOST=localhost
DB_PORT=27017
DB_NAME=hospital_erp_production
DB_USER=hospital_user
DB_PASSWORD=secure_password_here

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_here

# JWT
JWT_SECRET=super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=refresh_token_secret_here
JWT_REFRESH_EXPIRES_IN=7d

# التشفير
ENCRYPTION_KEY=32_character_encryption_key_here
ENCRYPTION_IV=16_character_iv_here

# البريد الإلكتروني
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=hospital@example.com
SMTP_PASSWORD=email_password_here

# التخزين السحابي
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=hospital-erp-files

# المراقبة
SENTRY_DSN=your_sentry_dsn_here
LOG_LEVEL=info

# الأمان
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://hospital.example.com

# النسخ الاحتياطية
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_S3_BUCKET=hospital-erp-backups
```

### 2. سكريبت النشر التلقائي

```bash
#!/bin/bash
# deploy.sh

set -e

# متغيرات النشر
APP_DIR="/var/www/hospital-erp"
BACKUP_DIR="/var/backups/hospital-erp"
REPO_URL="https://github.com/your-org/hospital-erp.git"
BRANCH="main"

echo "🚀 بدء عملية النشر..."

# إنشاء نسخة احتياطية
echo "📦 إنشاء نسخة احتياطية..."
mkdir -p $BACKUP_DIR
tar -czf "$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C $APP_DIR .

# تحديث الكود
echo "📥 تحديث الكود..."
cd $APP_DIR
git fetch origin
git reset --hard origin/$BRANCH

# تثبيت التبعيات
echo "📦 تثبيت تبعيات Backend..."
cd backend
npm ci --production

echo "📦 تثبيت تبعيات Frontend..."
cd ../frontend
npm ci

# بناء Frontend
echo "🏗️ بناء Frontend..."
npm run build

# تشغيل اختبارات الإنتاج
echo "🧪 تشغيل اختبارات الإنتاج..."
cd ../backend
npm run test:production

# تشغيل migrations قاعدة البيانات
echo "🗄️ تشغيل migrations..."
npm run migrate:production

# إعادة تشغيل التطبيق
echo "🔄 إعادة تشغيل التطبيق..."
pm2 reload hospital-erp-backend
pm2 reload hospital-erp-worker

# إعادة تحميل Nginx
echo "🔄 إعادة تحميل Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# التحقق من صحة النشر
echo "✅ التحقق من صحة النشر..."
sleep 10

# فحص صحة التطبيق
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://hospital.example.com/api/health)
if [ $HEALTH_CHECK -eq 200 ]; then
    echo "✅ النشر تم بنجاح!"
    
    # إرسال إشعار نجاح
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"✅ تم نشر نظام إدارة المستشفيات بنجاح"}' \
        $SLACK_WEBHOOK_URL
else
    echo "❌ فشل النشر - استعادة النسخة الاحتياطية..."
    
    # استعادة النسخة الاحتياطية
    LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.tar.gz | head -1)
    tar -xzf $LATEST_BACKUP -C $APP_DIR
    pm2 reload all
    
    # إرسال إشعار فشل
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"❌ فشل نشر نظام إدارة المستشفيات - تم استعادة النسخة الاحتياطية"}' \
        $SLACK_WEBHOOK_URL
    
    exit 1
fi

echo "🎉 انتهت عملية النشر بنجاح!"
```

### 3. إعداد PM2 للإنتاج

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'hospital-erp-backend',
      script: './backend/src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/pm2/hospital-erp-backend-error.log',
      out_file: '/var/log/pm2/hospital-erp-backend-out.log',
      log_file: '/var/log/pm2/hospital-erp-backend.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'hospital-erp-worker',
      script: './backend/src/workers/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/hospital-erp-worker-error.log',
      out_file: '/var/log/pm2/hospital-erp-worker-out.log',
      log_file: '/var/log/pm2/hospital-erp-worker.log',
      time: true,
      max_memory_restart: '512M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
```

---

## المراقبة والسجلات

### 1. إعداد Prometheus للمراقبة

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "hospital_erp_rules.yml"

scrape_configs:
  - job_name: 'hospital-erp-backend'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'mongodb'
    static_configs:
      - targets: ['localhost:9216']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  - job_name: 'nginx'
    static_configs:
      - targets: ['localhost:9113']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### 2. قواعد التنبيه

```yaml
# hospital_erp_rules.yml
groups:
  - name: hospital_erp_alerts
    rules:
      - alert: HighResponseTime
        expr: hospital_erp_http_request_duration_seconds{quantile="0.95"} > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "زمن الاستجابة مرتفع"
          description: "زمن الاستجابة للطلبات أكبر من ثانية واحدة"

      - alert: HighErrorRate
        expr: rate(hospital_erp_http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "معدل أخطاء مرتفع"
          description: "معدل الأخطاء أكبر من 10%"

      - alert: DatabaseConnectionFailed
        expr: hospital_erp_database_connected == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "فشل الاتصال بقاعدة البيانات"
          description: "لا يمكن الاتصال بقاعدة البيانات"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "استخدام ذاكرة مرتفع"
          description: "استخدام الذاكرة أكبر من 90%"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "مساحة القرص منخفضة"
          description: "مساحة القرص المتاحة أقل من 10%"
```

### 3. إعداد Grafana للمراقبة المرئية

```json
{
  "dashboard": {
    "title": "Hospital ERP System Monitoring",
    "panels": [
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "hospital_erp_http_request_duration_seconds{quantile=\"0.95\"}",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(hospital_erp_http_requests_total[5m])",
            "legendFormat": "Requests per second"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(hospital_erp_http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "Error rate"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "hospital_erp_database_connections_active",
            "legendFormat": "Active connections"
          }
        ]
      }
    ]
  }
}
```

---

## النسخ الاحتياطية والاستعادة

### 1. سكريبت النسخ الاحتياطي التلقائي

```bash
#!/bin/bash
# backup.sh

set -e

# متغيرات النسخ الاحتياطي
BACKUP_DIR="/var/backups/hospital-erp"
S3_BUCKET="hospital-erp-backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d-%H%M%S)

echo "📦 بدء النسخ الاحتياطي - $DATE"

# إنشاء مجلد النسخ الاحتياطية
mkdir -p $BACKUP_DIR

# نسخ احتياطي لقاعدة البيانات
echo "🗄️ نسخ احتياطي لقاعدة البيانات..."
mongodump --host localhost:27017 \
          --db hospital_erp_production \
          --username $DB_USER \
          --password $DB_PASSWORD \
          --out $BACKUP_DIR/mongodb-$DATE

# ضغط النسخة الاحتياطية
tar -czf $BACKUP_DIR/mongodb-$DATE.tar.gz -C $BACKUP_DIR mongodb-$DATE
rm -rf $BACKUP_DIR/mongodb-$DATE

# نسخ احتياطي للملفات المرفوعة
echo "📁 نسخ احتياطي للملفات..."
tar -czf $BACKUP_DIR/files-$DATE.tar.gz -C /var/www/hospital-erp/uploads .

# نسخ احتياطي لإعدادات النظام
echo "⚙️ نسخ احتياطي للإعدادات..."
tar -czf $BACKUP_DIR/config-$DATE.tar.gz \
    /etc/nginx/sites-available/hospital-erp \
    /var/www/hospital-erp/.env.production \
    /var/www/hospital-erp/ecosystem.config.js

# رفع النسخ الاحتياطية إلى S3
echo "☁️ رفع النسخ الاحتياطية إلى S3..."
aws s3 cp $BACKUP_DIR/mongodb-$DATE.tar.gz s3://$S3_BUCKET/mongodb/
aws s3 cp $BACKUP_DIR/files-$DATE.tar.gz s3://$S3_BUCKET/files/
aws s3 cp $BACKUP_DIR/config-$DATE.tar.gz s3://$S3_BUCKET/config/

# حذف النسخ الاحتياطية القديمة محلياً
echo "🧹 حذف النسخ الاحتياطية القديمة..."
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

# حذف النسخ الاحتياطية القديمة من S3
aws s3api list-objects-v2 --bucket $S3_BUCKET --query 'Contents[?LastModified<=`'$(date -d "$RETENTION_DAYS days ago" --iso-8601)'`].Key' --output text | xargs -I {} aws s3 rm s3://$S3_BUCKET/{}

echo "✅ انتهى النسخ الاحتياطي بنجاح"

# إرسال تقرير النسخ الاحتياطي
BACKUP_SIZE=$(du -sh $BACKUP_DIR/mongodb-$DATE.tar.gz | cut -f1)
curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"✅ تم إنشاء نسخة احتياطية بنجاح\\nالحجم: $BACKUP_SIZE\\nالتاريخ: $DATE\"}" \
    $SLACK_WEBHOOK_URL
```

### 2. سكريبت الاستعادة

```bash
#!/bin/bash
# restore.sh

set -e

if [ $# -eq 0 ]; then
    echo "الاستخدام: $0 <backup-date>"
    echo "مثال: $0 20241231-120000"
    exit 1
fi

BACKUP_DATE=$1
BACKUP_DIR="/var/backups/hospital-erp"
S3_BUCKET="hospital-erp-backups"

echo "🔄 بدء استعادة النسخة الاحتياطية - $BACKUP_DATE"

# إيقاف التطبيق
echo "⏹️ إيقاف التطبيق..."
pm2 stop hospital-erp-backend
pm2 stop hospital-erp-worker

# تحميل النسخة الاحتياطية من S3
echo "📥 تحميل النسخة الاحتياطية من S3..."
aws s3 cp s3://$S3_BUCKET/mongodb/mongodb-$BACKUP_DATE.tar.gz $BACKUP_DIR/
aws s3 cp s3://$S3_BUCKET/files/files-$BACKUP_DATE.tar.gz $BACKUP_DIR/
aws s3 cp s3://$S3_BUCKET/config/config-$BACKUP_DATE.tar.gz $BACKUP_DIR/

# استعادة قاعدة البيانات
echo "🗄️ استعادة قاعدة البيانات..."
tar -xzf $BACKUP_DIR/mongodb-$BACKUP_DATE.tar.gz -C $BACKUP_DIR
mongorestore --host localhost:27017 \
             --db hospital_erp_production \
             --username $DB_USER \
             --password $DB_PASSWORD \
             --drop \
             $BACKUP_DIR/mongodb-$BACKUP_DATE/hospital_erp_production

# استعادة الملفات
echo "📁 استعادة الملفات..."
rm -rf /var/www/hospital-erp/uploads/*
tar -xzf $BACKUP_DIR/files-$BACKUP_DATE.tar.gz -C /var/www/hospital-erp/uploads/

# استعادة الإعدادات
echo "⚙️ استعادة الإعدادات..."
tar -xzf $BACKUP_DIR/config-$BACKUP_DATE.tar.gz -C /

# إعادة تشغيل التطبيق
echo "▶️ إعادة تشغيل التطبيق..."
pm2 start hospital-erp-backend
pm2 start hospital-erp-worker

# إعادة تحميل Nginx
sudo systemctl reload nginx

echo "✅ تمت الاستعادة بنجاح"
```

---

## الأمان في الإنتاج

### 1. إعداد Fail2Ban

```ini
# /etc/fail2ban/jail.local
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10

[hospital-erp-auth]
enabled = true
filter = hospital-erp-auth
logpath = /var/log/pm2/hospital-erp-backend.log
maxretry = 5
bantime = 1800
```

### 2. مرشح Fail2Ban مخصص

```ini
# /etc/fail2ban/filter.d/hospital-erp-auth.conf
[Definition]
failregex = ^.*"ip":"<HOST>".*"event":"failed_login".*$
ignoreregex =
```

### 3. إعداد مراقبة الأمان

```bash
#!/bin/bash
# security-monitor.sh

# مراقبة محاولات الدخول المشبوهة
tail -f /var/log/pm2/hospital-erp-backend.log | while read line; do
    if echo "$line" | grep -q "failed_login"; then
        IP=$(echo "$line" | grep -o '"ip":"[^"]*"' | cut -d'"' -f4)
        COUNT=$(grep -c "failed_login.*$IP" /var/log/pm2/hospital-erp-backend.log)
        
        if [ $COUNT -gt 10 ]; then
            # حظر IP تلقائياً
            sudo ufw insert 1 deny from $IP
            
            # إرسال تنبيه
            curl -X POST -H 'Content-type: application/json' \
                --data "{\"text\":\"🚨 تم حظر IP مشبوه: $IP\\nعدد المحاولات: $COUNT\"}" \
                $SLACK_WEBHOOK_URL
        fi
    fi
done
```

---

## الصيانة والتحديثات

### 1. سكريبت الصيانة الدورية

```bash
#!/bin/bash
# maintenance.sh

echo "🔧 بدء الصيانة الدورية..."

# تنظيف السجلات القديمة
echo "🧹 تنظيف السجلات..."
find /var/log/pm2 -name "*.log" -mtime +30 -delete
find /var/log/nginx -name "*.log.*.gz" -mtime +30 -delete

# تحسين قاعدة البيانات
echo "🗄️ تحسين قاعدة البيانات..."
mongo hospital_erp_production --eval "
db.runCommand({compact: 'patients'});
db.runCommand({compact: 'appointments'});
db.runCommand({compact: 'medical_records'});
db.runCommand({reIndex: 'patients'});
db.runCommand({reIndex: 'appointments'});
"

# تنظيف ذاكرة Redis
echo "💾 تنظيف ذاكرة Redis..."
redis-cli FLUSHDB

# تحديث النظام
echo "📦 تحديث النظام..."
sudo apt update && sudo apt upgrade -y

# إعادة تشغيل الخدمات
echo "🔄 إعادة تشغيل الخدمات..."
pm2 restart all
sudo systemctl restart nginx

echo "✅ انتهت الصيانة الدورية"
```

### 2. إعداد Cron للمهام التلقائية

```bash
# crontab -e

# النسخ الاحتياطي اليومي في الساعة 2:00 صباحاً
0 2 * * * /var/www/hospital-erp/scripts/backup.sh

# الصيانة الأسبوعية يوم الأحد في الساعة 3:00 صباحاً
0 3 * * 0 /var/www/hospital-erp/scripts/maintenance.sh

# مراقبة مساحة القرص كل ساعة
0 * * * * /var/www/hospital-erp/scripts/disk-monitor.sh

# تنظيف الملفات المؤقتة يومياً
30 1 * * * find /tmp -name "hospital-erp-*" -mtime +1 -delete

# تجديد شهادة SSL شهرياً
0 0 1 * * /usr/bin/certbot renew --quiet
```

---

## استكشاف الأخطاء وإصلاحها

### 1. مشاكل شائعة وحلولها

#### مشكلة: التطبيق لا يستجيب

```bash
# فحص حالة العمليات
pm2 status

# فحص السجلات
pm2 logs hospital-erp-backend --lines 100

# إعادة تشغيل التطبيق
pm2 restart hospital-erp-backend

# فحص استخدام الموارد
htop
```

#### مشكلة: قاعدة البيانات بطيئة

```bash
# فحص حالة MongoDB
mongo --eval "db.serverStatus()"

# فحص الاستعلامات البطيئة
mongo hospital_erp_production --eval "db.setProfilingLevel(2, {slowms: 100})"

# تحسين الفهارس
mongo hospital_erp_production --eval "db.patients.createIndex({nationalId: 1})"
```

#### مشكلة: مساحة القرص ممتلئة

```bash
# فحص استخدام المساحة
df -h

# العثور على أكبر الملفات
du -ah /var/www/hospital-erp | sort -rh | head -20

# تنظيف السجلات
sudo journalctl --vacuum-time=7d
```

### 2. سكريبت التشخيص التلقائي

```bash
#!/bin/bash
# diagnose.sh

echo "🔍 بدء التشخيص التلقائي..."

# فحص حالة الخدمات
echo "📊 حالة الخدمات:"
systemctl is-active nginx
systemctl is-active mongod
systemctl is-active redis-server
pm2 status

# فحص استخدام الموارد
echo "💻 استخدام الموارد:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memory: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "Disk: $(df -h / | awk 'NR==2{printf "%s", $5}')"

# فحص الاتصالات
echo "🌐 فحص الاتصالات:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" https://hospital.example.com/api/health

# فحص السجلات للأخطاء
echo "📋 الأخطاء الأخيرة:"
tail -n 50 /var/log/pm2/hospital-erp-backend-error.log | grep -i error | tail -5

echo "✅ انتهى التشخيص"
```

---

## الخلاصة

هذا الدليل يوفر إطار عمل شامل لنشر نظام إدارة المستشفيات في بيئة الإنتاج بطريقة آمنة وموثوقة. يجب اتباع جميع الخطوات بعناية وإجراء اختبارات شاملة قبل النشر الفعلي.

### نقاط مهمة:

1. **الأمان أولاً**: تأكد من تطبيق جميع إجراءات الأمان
2. **المراقبة المستمرة**: راقب النظام باستمرار للتأكد من الأداء
3. **النسخ الاحتياطية**: تأكد من عمل النسخ الاحتياطية بانتظام
4. **التحديثات**: حافظ على تحديث النظام والتبعيات
5. **التوثيق**: وثق جميع التغييرات والإعدادات