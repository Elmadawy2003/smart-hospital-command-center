# دليل التثبيت التقني - نظام إدارة المستشفيات

## 📋 جدول المحتويات

1. [متطلبات النظام](#متطلبات-النظام)
2. [إعداد البيئة](#إعداد-البيئة)
3. [تثبيت قواعد البيانات](#تثبيت-قواعد-البيانات)
4. [تثبيت Backend](#تثبيت-backend)
5. [تثبيت Frontend](#تثبيت-frontend)
6. [الإعدادات الأمنية](#الإعدادات-الأمنية)
7. [النشر في الإنتاج](#النشر-في-الإنتاج)
8. [المراقبة والصيانة](#المراقبة-والصيانة)
9. [استكشاف الأخطاء](#استكشاف-الأخطاء)

## متطلبات النظام

### الحد الأدنى للمتطلبات

#### الخادم (Server)
- **المعالج**: Intel Xeon E5-2620 أو AMD EPYC 7302P
- **الذاكرة**: 16 GB RAM
- **التخزين**: 500 GB SSD
- **الشبكة**: 1 Gbps Ethernet
- **نظام التشغيل**: 
  - Ubuntu Server 20.04 LTS أو أحدث
  - CentOS 8 أو أحدث
  - Windows Server 2019 أو أحدث

#### قاعدة البيانات
- **المعالج**: Intel Core i7 أو AMD Ryzen 7
- **الذاكرة**: 32 GB RAM
- **التخزين**: 1 TB SSD (RAID 1 مفضل)
- **الشبكة**: 1 Gbps Ethernet

#### محطات العمل (Workstations)
- **المعالج**: Intel Core i5 أو AMD Ryzen 5
- **الذاكرة**: 8 GB RAM
- **التخزين**: 256 GB SSD
- **الشبكة**: 100 Mbps Ethernet أو WiFi
- **المتصفح**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### المتطلبات الموصى بها

#### الخادم (Server)
- **المعالج**: Intel Xeon Gold 6248 أو AMD EPYC 7542
- **الذاكرة**: 64 GB RAM
- **التخزين**: 2 TB NVMe SSD (RAID 10)
- **الشبكة**: 10 Gbps Ethernet
- **UPS**: نظام طاقة احتياطية

#### قاعدة البيانات
- **المعالج**: Intel Xeon Platinum أو AMD EPYC 7742
- **الذاكرة**: 128 GB RAM
- **التخزين**: 4 TB NVMe SSD (RAID 10)
- **النسخ الاحتياطي**: خادم منفصل للنسخ الاحتياطية

## إعداد البيئة

### تثبيت Node.js

#### على Ubuntu/CentOS
```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y  # Ubuntu
sudo yum update -y                      # CentOS

# تثبيت Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# التحقق من التثبيت
node --version
npm --version
```

#### على Windows Server
```powershell
# تحميل وتثبيت Node.js من الموقع الرسمي
# https://nodejs.org/en/download/

# أو استخدام Chocolatey
choco install nodejs

# التحقق من التثبيت
node --version
npm --version
```

### تثبيت Git
```bash
# Ubuntu
sudo apt install git -y

# CentOS
sudo yum install git -y

# Windows
choco install git
```

### تثبيت PM2 (Process Manager)
```bash
npm install -g pm2
```

## تثبيت قواعد البيانات

### تثبيت MongoDB

#### على Ubuntu
```bash
# إضافة مفتاح MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# إضافة مستودع MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# تحديث وتثبيت MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# تشغيل MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### على CentOS
```bash
# إنشاء ملف مستودع MongoDB
sudo tee /etc/yum.repos.d/mongodb-org-6.0.repo << EOF
[mongodb-org-6.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/8/mongodb-org/6.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-6.0.asc
EOF

# تثبيت MongoDB
sudo yum install -y mongodb-org

# تشغيل MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### على Windows
```powershell
# تحميل MongoDB Community Server من:
# https://www.mongodb.com/try/download/community

# تثبيت كخدمة Windows
# اتبع معالج التثبيت واختر "Install MongoDB as a Service"
```

### إعداد MongoDB

```bash
# الاتصال بـ MongoDB
mongo

# إنشاء قاعدة بيانات ومستخدم
use hospital_erp
db.createUser({
  user: "hospital_admin",
  pwd: "secure_password_here",
  roles: [
    { role: "readWrite", db: "hospital_erp" },
    { role: "dbAdmin", db: "hospital_erp" }
  ]
})

# تفعيل المصادقة
exit
```

#### تحرير ملف إعدادات MongoDB
```bash
sudo nano /etc/mongod.conf
```

```yaml
# إضافة الإعدادات التالية
security:
  authorization: enabled

net:
  port: 27017
  bindIp: 127.0.0.1,YOUR_SERVER_IP

storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
```

```bash
# إعادة تشغيل MongoDB
sudo systemctl restart mongod
```

### تثبيت Redis

#### على Ubuntu
```bash
sudo apt update
sudo apt install redis-server -y

# تحرير إعدادات Redis
sudo nano /etc/redis/redis.conf

# تغيير الإعدادات التالية:
# supervised systemd
# requirepass your_secure_password

sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

#### على CentOS
```bash
sudo yum install epel-release -y
sudo yum install redis -y

sudo systemctl start redis
sudo systemctl enable redis
```

#### على Windows
```powershell
# تحميل Redis من:
# https://github.com/microsoftarchive/redis/releases

# أو استخدام Docker
docker run -d --name redis -p 6379:6379 redis:alpine
```

## تثبيت Backend

### استنساخ المشروع
```bash
git clone https://github.com/your-repo/hospital-erp.git
cd hospital-erp/backend
```

### تثبيت التبعيات
```bash
npm install
```

### إعداد متغيرات البيئة
```bash
cp .env.example .env
nano .env
```

```env
# Server Configuration
PORT=5000
NODE_ENV=production
HOST=0.0.0.0

# Database Configuration
MONGODB_URI=mongodb://hospital_admin:secure_password_here@localhost:27017/hospital_erp
REDIS_URL=redis://:your_redis_password@localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_REFRESH_EXPIRES_IN=30d

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=jpg,jpeg,png,pdf,doc,docx

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# External APIs
INSURANCE_API_URL=https://api.insurance-provider.com
INSURANCE_API_KEY=your-insurance-api-key
PHARMACY_API_URL=https://api.pharmacy-system.com
PHARMACY_API_KEY=your-pharmacy-api-key

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# SSL Configuration (for production)
SSL_KEY_PATH=/path/to/ssl/private.key
SSL_CERT_PATH=/path/to/ssl/certificate.crt
```

### بناء المشروع
```bash
npm run build
```

### تشغيل النظام
```bash
# للتطوير
npm run dev

# للإنتاج
npm start

# أو باستخدام PM2
pm2 start ecosystem.config.js
```

### إعداد PM2
```bash
# إنشاء ملف ecosystem.config.js
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'hospital-erp-backend',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=4096'
  }]
}
```

## تثبيت Frontend

### الانتقال لمجلد Frontend
```bash
cd ../frontend
```

### تثبيت التبعيات
```bash
npm install
```

### إعداد متغيرات البيئة
```bash
nano .env
```

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_APP_NAME=Hospital ERP System
REACT_APP_VERSION=1.0.0
REACT_APP_ENVIRONMENT=production

# للإنتاج
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_SOCKET_URL=https://api.yourdomain.com
```

### بناء المشروع
```bash
npm run build
```

### تشغيل النظام

#### للتطوير
```bash
npm start
```

#### للإنتاج (مع خادم ويب)

##### استخدام Nginx
```bash
# تثبيت Nginx
sudo apt install nginx -y

# نسخ ملفات البناء
sudo cp -r build/* /var/www/html/

# إعداد Nginx
sudo nano /etc/nginx/sites-available/hospital-erp
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO proxy
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

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# تفعيل الموقع
sudo ln -s /etc/nginx/sites-available/hospital-erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## الإعدادات الأمنية

### تثبيت SSL Certificate

#### استخدام Let's Encrypt
```bash
# تثبيت Certbot
sudo apt install certbot python3-certbot-nginx -y

# الحصول على شهادة SSL
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# تجديد تلقائي
sudo crontab -e
# إضافة السطر التالي:
0 12 * * * /usr/bin/certbot renew --quiet
```

### إعداد Firewall
```bash
# تثبيت UFW
sudo apt install ufw -y

# السماح بالاتصالات الأساسية
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# منع الوصول المباشر لقواعد البيانات من الخارج
sudo ufw deny 27017
sudo ufw deny 6379

# تفعيل Firewall
sudo ufw enable
```

### إعداد Fail2Ban
```bash
# تثبيت Fail2Ban
sudo apt install fail2ban -y

# إعداد Fail2Ban
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
```

```bash
sudo systemctl restart fail2ban
```

## النشر في الإنتاج

### إعداد النسخ الاحتياطية

#### نسخ احتياطية لـ MongoDB
```bash
# إنشاء سكريبت النسخ الاحتياطي
sudo nano /usr/local/bin/mongodb-backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="hospital_erp"

# إنشاء مجلد النسخ الاحتياطية
mkdir -p $BACKUP_DIR

# إنشاء النسخة الاحتياطية
mongodump --host localhost --port 27017 --db $DB_NAME --out $BACKUP_DIR/$DATE

# ضغط النسخة الاحتياطية
tar -czf $BACKUP_DIR/mongodb_backup_$DATE.tar.gz -C $BACKUP_DIR $DATE

# حذف المجلد غير المضغوط
rm -rf $BACKUP_DIR/$DATE

# حذف النسخ الاحتياطية الأقدم من 30 يوم
find $BACKUP_DIR -name "mongodb_backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: mongodb_backup_$DATE.tar.gz"
```

```bash
# جعل السكريبت قابل للتنفيذ
sudo chmod +x /usr/local/bin/mongodb-backup.sh

# إضافة مهمة cron للنسخ الاحتياطي اليومي
sudo crontab -e
# إضافة السطر التالي:
0 2 * * * /usr/local/bin/mongodb-backup.sh
```

#### نسخ احتياطية للملفات
```bash
# إنشاء سكريبت نسخ الملفات
sudo nano /usr/local/bin/files-backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backup/files"
DATE=$(date +%Y%m%d_%H%M%S)
SOURCE_DIR="/path/to/hospital-erp"

mkdir -p $BACKUP_DIR

# نسخ الملفات المهمة
tar -czf $BACKUP_DIR/files_backup_$DATE.tar.gz \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='.git' \
    $SOURCE_DIR

# حذف النسخ الأقدم من 7 أيام
find $BACKUP_DIR -name "files_backup_*.tar.gz" -mtime +7 -delete

echo "Files backup completed: files_backup_$DATE.tar.gz"
```

### إعداد المراقبة

#### تثبيت Prometheus و Grafana
```bash
# تثبيت Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.40.0/prometheus-2.40.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
sudo mv prometheus-2.40.0.linux-amd64 /opt/prometheus
sudo useradd --no-create-home --shell /bin/false prometheus
sudo chown -R prometheus:prometheus /opt/prometheus
```

#### إعداد مراقبة النظام
```bash
# تثبيت Node Exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.4.0/node_exporter-1.4.0.linux-amd64.tar.gz
tar xvfz node_exporter-*.tar.gz
sudo mv node_exporter-1.4.0.linux-amd64/node_exporter /usr/local/bin/
```

### إعداد Load Balancer

#### استخدام Nginx كـ Load Balancer
```nginx
upstream backend {
    server 127.0.0.1:5000;
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## المراقبة والصيانة

### مراقبة الأداء

#### مراقبة استخدام الموارد
```bash
# مراقبة استخدام المعالج والذاكرة
htop

# مراقبة استخدام القرص
df -h
du -sh /var/lib/mongodb

# مراقبة الشبكة
iftop
```

#### مراقبة قواعد البيانات
```bash
# مراقبة MongoDB
mongo --eval "db.stats()"
mongo --eval "db.runCommand({serverStatus: 1})"

# مراقبة Redis
redis-cli info
redis-cli monitor
```

### صيانة دورية

#### تنظيف السجلات
```bash
# تنظيف سجلات النظام
sudo journalctl --vacuum-time=30d

# تنظيف سجلات Nginx
sudo find /var/log/nginx -name "*.log" -mtime +30 -delete

# تنظيف سجلات التطبيق
find /path/to/hospital-erp/logs -name "*.log" -mtime +30 -delete
```

#### تحديث النظام
```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تحديث Node.js packages
npm audit fix
npm update
```

## استكشاف الأخطاء

### مشاكل شائعة وحلولها

#### خطأ في الاتصال بقاعدة البيانات
```bash
# التحقق من حالة MongoDB
sudo systemctl status mongod

# فحص سجلات MongoDB
sudo tail -f /var/log/mongodb/mongod.log

# إعادة تشغيل MongoDB
sudo systemctl restart mongod
```

#### مشاكل في الأداء
```bash
# فحص استخدام الموارد
top
free -h
iostat

# فحص الاتصالات النشطة
netstat -tulpn | grep :5000
```

#### مشاكل SSL
```bash
# فحص شهادة SSL
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/cert.pem -text -noout

# تجديد شهادة SSL
sudo certbot renew --dry-run
```

### سجلات النظام

#### مواقع السجلات المهمة
- **تطبيق Backend**: `/path/to/hospital-erp/backend/logs/`
- **MongoDB**: `/var/log/mongodb/mongod.log`
- **Redis**: `/var/log/redis/redis-server.log`
- **Nginx**: `/var/log/nginx/access.log` و `/var/log/nginx/error.log`
- **النظام**: `journalctl -u hospital-erp-backend`

#### فحص السجلات
```bash
# سجلات التطبيق
tail -f /path/to/hospital-erp/backend/logs/app.log

# سجلات النظام
sudo journalctl -f -u mongod

# سجلات Nginx
sudo tail -f /var/log/nginx/error.log
```

### أدوات التشخيص

#### فحص الاتصال
```bash
# فحص الاتصال بالخادم
curl -I http://localhost:5000/api/health

# فحص الاتصال بقاعدة البيانات
mongo --eval "db.adminCommand('ping')"

# فحص Redis
redis-cli ping
```

#### فحص الأداء
```bash
# فحص أداء قاعدة البيانات
mongo --eval "db.runCommand({serverStatus: 1}).connections"

# فحص استخدام الذاكرة
free -m
cat /proc/meminfo

# فحص استخدام القرص
df -h
iostat -x 1
```

---

**للحصول على دعم إضافي، راجع الوثائق التقنية أو اتصل بفريق الدعم الفني**