# دليل النسخ الاحتياطي والاستعادة - نظام إدارة المستشفيات

## نظرة عامة

هذا الدليل يوضح استراتيجيات النسخ الاحتياطي والاستعادة لضمان حماية بيانات المستشفى وإمكانية الاستعادة السريعة في حالات الطوارئ.

## استراتيجية النسخ الاحتياطي

### 1. أنواع النسخ الاحتياطي

#### النسخ الاحتياطي الكامل (Full Backup)
- **التكرار**: أسبوعياً (كل يوم أحد الساعة 2:00 صباحاً)
- **المحتوى**: جميع البيانات والملفات
- **مدة الاحتفاظ**: 3 أشهر

#### النسخ الاحتياطي التزايدي (Incremental Backup)
- **التكرار**: يومياً (الساعة 2:00 صباحاً)
- **المحتوى**: البيانات المتغيرة منذ آخر نسخة احتياطية
- **مدة الاحتفاظ**: شهر واحد

#### النسخ الاحتياطي الفوري (Real-time Backup)
- **التكرار**: مستمر
- **المحتوى**: البيانات الحرجة (المرضى، المواعيد، السجلات الطبية)
- **التقنية**: MongoDB Replica Set

### 2. مواقع التخزين

```bash
# المواقع المحلية
/backup/daily/          # النسخ اليومية
/backup/weekly/         # النسخ الأسبوعية
/backup/monthly/        # النسخ الشهرية

# المواقع السحابية
AWS S3: hospital-erp-backups/
Azure Blob: hospital-backups/
Google Cloud: hospital-erp-storage/
```

---

## نسخ احتياطي لقاعدة البيانات

### 1. MongoDB Backup

#### سكريبت النسخ الاحتياطي الكامل

```bash
#!/bin/bash
# mongodb-full-backup.sh

# إعدادات
DB_NAME="hospital_erp_production"
BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/full_$DATE"
S3_BUCKET="hospital-erp-backups"

# إنشاء مجلد النسخة الاحتياطية
mkdir -p "$BACKUP_PATH"

echo "🗄️ بدء النسخ الاحتياطي الكامل لقاعدة البيانات..."

# النسخ الاحتياطي باستخدام mongodump
mongodump \
  --host localhost:27017 \
  --db "$DB_NAME" \
  --out "$BACKUP_PATH" \
  --gzip \
  --oplog

# التحقق من نجاح العملية
if [ $? -eq 0 ]; then
  echo "✅ تم إنشاء النسخة الاحتياطية بنجاح"
  
  # ضغط النسخة الاحتياطية
  cd "$BACKUP_DIR"
  tar -czf "full_$DATE.tar.gz" "full_$DATE/"
  
  # حساب checksum للتحقق من سلامة البيانات
  sha256sum "full_$DATE.tar.gz" > "full_$DATE.sha256"
  
  # رفع إلى السحابة
  aws s3 cp "full_$DATE.tar.gz" "s3://$S3_BUCKET/mongodb/full/"
  aws s3 cp "full_$DATE.sha256" "s3://$S3_BUCKET/mongodb/full/"
  
  # حذف النسخة المحلية القديمة (أكثر من 7 أيام)
  find "$BACKUP_DIR" -name "full_*.tar.gz" -mtime +7 -delete
  find "$BACKUP_DIR" -name "full_*" -type d -mtime +7 -exec rm -rf {} +
  
  echo "☁️ تم رفع النسخة الاحتياطية إلى السحابة"
  
  # إرسال تنبيه نجاح
  curl -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    --data "{\"text\":\"✅ تم إنشاء النسخة الاحتياطية الكاملة بنجاح: $DATE\"}"
    
else
  echo "❌ فشل في إنشاء النسخة الاحتياطية"
  
  # إرسال تنبيه فشل
  curl -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    --data "{\"text\":\"❌ فشل في إنشاء النسخة الاحتياطية الكاملة: $DATE\"}"
  
  exit 1
fi
```

#### سكريبت النسخ الاحتياطي التزايدي

```bash
#!/bin/bash
# mongodb-incremental-backup.sh

# إعدادات
DB_NAME="hospital_erp_production"
BACKUP_DIR="/backup/mongodb/incremental"
DATE=$(date +%Y%m%d_%H%M%S)
LAST_BACKUP_FILE="/var/log/last_backup_timestamp"

# إنشاء مجلد النسخة الاحتياطية
mkdir -p "$BACKUP_DIR"

echo "📈 بدء النسخ الاحتياطي التزايدي..."

# الحصول على timestamp آخر نسخة احتياطية
if [ -f "$LAST_BACKUP_FILE" ]; then
  LAST_TIMESTAMP=$(cat "$LAST_BACKUP_FILE")
else
  # إذا لم توجد نسخة سابقة، استخدم timestamp من 24 ساعة مضت
  LAST_TIMESTAMP=$(date -d "24 hours ago" +%s)
fi

# تحويل timestamp إلى تاريخ MongoDB
LAST_DATE=$(date -d "@$LAST_TIMESTAMP" --iso-8601)

# النسخ الاحتياطي للبيانات المتغيرة
mongodump \
  --host localhost:27017 \
  --db "$DB_NAME" \
  --out "$BACKUP_DIR/inc_$DATE" \
  --gzip \
  --query "{\"updatedAt\": {\"\$gte\": {\"\$date\": \"$LAST_DATE\"}}}"

# حفظ timestamp الحالي
date +%s > "$LAST_BACKUP_FILE"

# ضغط ورفع النسخة الاحتياطية
cd "$BACKUP_DIR"
tar -czf "inc_$DATE.tar.gz" "inc_$DATE/"
aws s3 cp "inc_$DATE.tar.gz" "s3://$S3_BUCKET/mongodb/incremental/"

# تنظيف النسخ القديمة
find "$BACKUP_DIR" -name "inc_*.tar.gz" -mtime +30 -delete

echo "✅ تم إنشاء النسخة الاحتياطية التزايدية بنجاح"
```

### 2. Redis Backup

```bash
#!/bin/bash
# redis-backup.sh

REDIS_DIR="/var/lib/redis"
BACKUP_DIR="/backup/redis"
DATE=$(date +%Y%m%d_%H%M%S)

echo "💾 بدء نسخ احتياطي لـ Redis..."

# إنشاء مجلد النسخة الاحتياطية
mkdir -p "$BACKUP_DIR"

# إنشاء snapshot
redis-cli BGSAVE

# انتظار انتهاء العملية
while [ $(redis-cli LASTSAVE) -eq $(redis-cli LASTSAVE) ]; do
  sleep 1
done

# نسخ ملف RDB
cp "$REDIS_DIR/dump.rdb" "$BACKUP_DIR/redis_$DATE.rdb"

# ضغط الملف
gzip "$BACKUP_DIR/redis_$DATE.rdb"

# رفع إلى السحابة
aws s3 cp "$BACKUP_DIR/redis_$DATE.rdb.gz" "s3://$S3_BUCKET/redis/"

# تنظيف النسخ القديمة
find "$BACKUP_DIR" -name "redis_*.rdb.gz" -mtime +7 -delete

echo "✅ تم إنشاء نسخة احتياطية لـ Redis بنجاح"
```

---

## نسخ احتياطي للملفات

### 1. ملفات التطبيق

```bash
#!/bin/bash
# application-backup.sh

APP_DIR="/opt/hospital-erp"
BACKUP_DIR="/backup/application"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="app_$DATE.tar.gz"

echo "📁 بدء نسخ احتياطي لملفات التطبيق..."

# إنشاء مجلد النسخة الاحتياطية
mkdir -p "$BACKUP_DIR"

# نسخ احتياطي للتطبيق (باستثناء node_modules)
tar -czf "$BACKUP_DIR/$BACKUP_FILE" \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude="logs" \
  --exclude="temp" \
  -C "$(dirname $APP_DIR)" \
  "$(basename $APP_DIR)"

# رفع إلى السحابة
aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$S3_BUCKET/application/"

# تنظيف النسخ القديمة
find "$BACKUP_DIR" -name "app_*.tar.gz" -mtime +30 -delete

echo "✅ تم إنشاء نسخة احتياطية للتطبيق بنجاح"
```

### 2. ملفات المستخدمين والوثائق

```bash
#!/bin/bash
# user-files-backup.sh

UPLOADS_DIR="/opt/hospital-erp/uploads"
DOCUMENTS_DIR="/opt/hospital-erp/documents"
BACKUP_DIR="/backup/user-files"
DATE=$(date +%Y%m%d_%H%M%S)

echo "📄 بدء نسخ احتياطي لملفات المستخدمين..."

# إنشاء مجلد النسخة الاحتياطية
mkdir -p "$BACKUP_DIR"

# نسخ احتياطي للملفات المرفوعة
if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C "$(dirname $UPLOADS_DIR)" "$(basename $UPLOADS_DIR)"
  aws s3 sync "$UPLOADS_DIR" "s3://$S3_BUCKET/uploads/" --delete
fi

# نسخ احتياطي للوثائق
if [ -d "$DOCUMENTS_DIR" ]; then
  tar -czf "$BACKUP_DIR/documents_$DATE.tar.gz" -C "$(dirname $DOCUMENTS_DIR)" "$(basename $DOCUMENTS_DIR)"
  aws s3 sync "$DOCUMENTS_DIR" "s3://$S3_BUCKET/documents/" --delete
fi

# تنظيف النسخ القديمة
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +14 -delete

echo "✅ تم إنشاء نسخة احتياطية للملفات بنجاح"
```

---

## نسخ احتياطي للإعدادات

### 1. إعدادات النظام

```bash
#!/bin/bash
# system-config-backup.sh

CONFIG_DIRS=(
  "/etc/nginx"
  "/etc/ssl"
  "/etc/systemd/system"
  "/etc/cron.d"
  "/etc/logrotate.d"
)

BACKUP_DIR="/backup/system-config"
DATE=$(date +%Y%m%d_%H%M%S)

echo "⚙️ بدء نسخ احتياطي لإعدادات النظام..."

mkdir -p "$BACKUP_DIR"

# نسخ احتياطي لكل مجلد إعدادات
for dir in "${CONFIG_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    dir_name=$(basename "$dir")
    tar -czf "$BACKUP_DIR/${dir_name}_$DATE.tar.gz" -C "$(dirname $dir)" "$(basename $dir)"
  fi
done

# نسخ احتياطي لإعدادات PM2
pm2 save
cp ~/.pm2/dump.pm2 "$BACKUP_DIR/pm2_$DATE.json"

# رفع إلى السحابة
aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/system-config/"

echo "✅ تم إنشاء نسخة احتياطية للإعدادات بنجاح"
```

### 2. متغيرات البيئة

```bash
#!/bin/bash
# env-backup.sh

ENV_FILES=(
  "/opt/hospital-erp/.env"
  "/opt/hospital-erp/.env.production"
)

BACKUP_DIR="/backup/environment"
DATE=$(date +%Y%m%d_%H%M%S)

echo "🔐 بدء نسخ احتياطي لمتغيرات البيئة..."

mkdir -p "$BACKUP_DIR"

# تشفير ونسخ ملفات البيئة
for file in "${ENV_FILES[@]}"; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    # تشفير الملف باستخدام GPG
    gpg --symmetric --cipher-algo AES256 --output "$BACKUP_DIR/${filename}_$DATE.gpg" "$file"
  fi
done

# رفع إلى السحابة (مشفر)
aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/environment/" --sse

echo "✅ تم إنشاء نسخة احتياطية مشفرة لمتغيرات البيئة"
```

---

## استعادة البيانات

### 1. استعادة قاعدة البيانات

#### استعادة كاملة

```bash
#!/bin/bash
# mongodb-restore-full.sh

# معاملات الاستعادة
BACKUP_FILE="$1"
TARGET_DB="hospital_erp_production"
RESTORE_DIR="/tmp/restore"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ يرجى تحديد ملف النسخة الاحتياطية"
  echo "الاستخدام: $0 <backup_file.tar.gz>"
  exit 1
fi

echo "🔄 بدء استعادة قاعدة البيانات من: $BACKUP_FILE"

# إنشاء مجلد مؤقت للاستعادة
mkdir -p "$RESTORE_DIR"
cd "$RESTORE_DIR"

# استخراج النسخة الاحتياطية
tar -xzf "$BACKUP_FILE"

# العثور على مجلد البيانات
BACKUP_DIR=$(find . -name "$TARGET_DB" -type d | head -1)

if [ -z "$BACKUP_DIR" ]; then
  echo "❌ لم يتم العثور على بيانات قاعدة البيانات في النسخة الاحتياطية"
  exit 1
fi

# تأكيد الاستعادة
echo "⚠️ تحذير: سيتم استبدال قاعدة البيانات الحالية"
read -p "هل تريد المتابعة؟ (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "تم إلغاء العملية"
  exit 0
fi

# إنشاء نسخة احتياطية من البيانات الحالية قبل الاستعادة
echo "📦 إنشاء نسخة احتياطية من البيانات الحالية..."
mongodump --db "$TARGET_DB" --out "/backup/pre-restore-$(date +%Y%m%d_%H%M%S)"

# حذف قاعدة البيانات الحالية
echo "🗑️ حذف قاعدة البيانات الحالية..."
mongo "$TARGET_DB" --eval "db.dropDatabase()"

# استعادة البيانات
echo "📥 استعادة البيانات..."
mongorestore --db "$TARGET_DB" "$BACKUP_DIR"

# التحقق من نجاح الاستعادة
if [ $? -eq 0 ]; then
  echo "✅ تم استعادة قاعدة البيانات بنجاح"
  
  # إعادة إنشاء الفهارس
  echo "🔍 إعادة إنشاء الفهارس..."
  mongo "$TARGET_DB" --eval "
    db.patients.createIndex({nationalId: 1}, {unique: true});
    db.appointments.createIndex({patientId: 1, date: 1});
    db.medical_records.createIndex({patientId: 1, date: -1});
  "
  
  # إرسال تنبيه نجاح
  curl -X POST "$SLACK_WEBHOOK" \
    -H 'Content-type: application/json' \
    --data "{\"text\":\"✅ تم استعادة قاعدة البيانات بنجاح من: $BACKUP_FILE\"}"
    
else
  echo "❌ فشل في استعادة قاعدة البيانات"
  exit 1
fi

# تنظيف الملفات المؤقتة
rm -rf "$RESTORE_DIR"
```

#### استعادة تزايدية

```bash
#!/bin/bash
# mongodb-restore-incremental.sh

INCREMENTAL_BACKUPS_DIR="$1"
TARGET_DB="hospital_erp_production"

if [ -z "$INCREMENTAL_BACKUPS_DIR" ]; then
  echo "❌ يرجى تحديد مجلد النسخ الاحتياطية التزايدية"
  exit 1
fi

echo "📈 بدء استعادة النسخ الاحتياطية التزايدية..."

# ترتيب النسخ الاحتياطية حسب التاريخ
BACKUP_FILES=($(ls -1 "$INCREMENTAL_BACKUPS_DIR"/inc_*.tar.gz | sort))

for backup_file in "${BACKUP_FILES[@]}"; do
  echo "📥 استعادة: $(basename $backup_file)"
  
  # استخراج النسخة الاحتياطية
  temp_dir="/tmp/restore_$(basename $backup_file .tar.gz)"
  mkdir -p "$temp_dir"
  tar -xzf "$backup_file" -C "$temp_dir"
  
  # استعادة البيانات (مع دمج البيانات الموجودة)
  mongorestore --db "$TARGET_DB" "$temp_dir"/* --upsert
  
  # تنظيف
  rm -rf "$temp_dir"
done

echo "✅ تم استعادة جميع النسخ الاحتياطية التزايدية بنجاح"
```

### 2. استعادة Redis

```bash
#!/bin/bash
# redis-restore.sh

BACKUP_FILE="$1"
REDIS_DIR="/var/lib/redis"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ يرجى تحديد ملف النسخة الاحتياطية لـ Redis"
  exit 1
fi

echo "💾 بدء استعادة Redis من: $BACKUP_FILE"

# إيقاف Redis
systemctl stop redis

# نسخ احتياطي من البيانات الحالية
cp "$REDIS_DIR/dump.rdb" "$REDIS_DIR/dump.rdb.backup.$(date +%Y%m%d_%H%M%S)"

# استعادة البيانات
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" > "$REDIS_DIR/dump.rdb"
else
  cp "$BACKUP_FILE" "$REDIS_DIR/dump.rdb"
fi

# تعيين الصلاحيات
chown redis:redis "$REDIS_DIR/dump.rdb"
chmod 660 "$REDIS_DIR/dump.rdb"

# إعادة تشغيل Redis
systemctl start redis

# التحقق من نجاح الاستعادة
if systemctl is-active --quiet redis; then
  echo "✅ تم استعادة Redis بنجاح"
else
  echo "❌ فشل في استعادة Redis"
  exit 1
fi
```

### 3. استعادة ملفات التطبيق

```bash
#!/bin/bash
# application-restore.sh

BACKUP_FILE="$1"
APP_DIR="/opt/hospital-erp"
RESTORE_DIR="/tmp/app-restore"

if [ -z "$BACKUP_FILE" ]; then
  echo "❌ يرجى تحديد ملف النسخة الاحتياطية للتطبيق"
  exit 1
fi

echo "📁 بدء استعادة ملفات التطبيق من: $BACKUP_FILE"

# إيقاف التطبيق
pm2 stop all

# إنشاء نسخة احتياطية من التطبيق الحالي
mv "$APP_DIR" "$APP_DIR.backup.$(date +%Y%m%d_%H%M%S)"

# إنشاء مجلد مؤقت للاستعادة
mkdir -p "$RESTORE_DIR"
cd "$RESTORE_DIR"

# استخراج النسخة الاحتياطية
tar -xzf "$BACKUP_FILE"

# نقل الملفات إلى مكانها الصحيح
mv hospital-erp "$APP_DIR"

# تعيين الصلاحيات
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"

# تثبيت التبعيات
cd "$APP_DIR"
npm install --production

# إعادة تشغيل التطبيق
pm2 start all

# تنظيف
rm -rf "$RESTORE_DIR"

echo "✅ تم استعادة ملفات التطبيق بنجاح"
```

---

## استعادة الكوارث

### 1. خطة استعادة الكوارث

```bash
#!/bin/bash
# disaster-recovery.sh

# إعدادات الاستعادة
RECOVERY_TYPE="$1"  # full, partial, emergency
BACKUP_DATE="$2"    # YYYYMMDD
S3_BUCKET="hospital-erp-backups"
RECOVERY_DIR="/recovery"

echo "🚨 بدء خطة استعادة الكوارث - النوع: $RECOVERY_TYPE"

case "$RECOVERY_TYPE" in
  "full")
    echo "🔄 استعادة كاملة للنظام..."
    
    # 1. تحضير البيئة
    mkdir -p "$RECOVERY_DIR"
    cd "$RECOVERY_DIR"
    
    # 2. تحميل النسخ الاحتياطية من السحابة
    echo "☁️ تحميل النسخ الاحتياطية..."
    aws s3 sync "s3://$S3_BUCKET" ./backups/
    
    # 3. استعادة قاعدة البيانات
    echo "🗄️ استعادة قاعدة البيانات..."
    latest_db_backup=$(ls -t ./backups/mongodb/full/full_*.tar.gz | head -1)
    ./mongodb-restore-full.sh "$latest_db_backup"
    
    # 4. استعادة Redis
    echo "💾 استعادة Redis..."
    latest_redis_backup=$(ls -t ./backups/redis/redis_*.rdb.gz | head -1)
    ./redis-restore.sh "$latest_redis_backup"
    
    # 5. استعادة التطبيق
    echo "📁 استعادة التطبيق..."
    latest_app_backup=$(ls -t ./backups/application/app_*.tar.gz | head -1)
    ./application-restore.sh "$latest_app_backup"
    
    # 6. استعادة الإعدادات
    echo "⚙️ استعادة الإعدادات..."
    ./system-config-restore.sh ./backups/system-config/
    
    # 7. اختبار النظام
    echo "🧪 اختبار النظام..."
    ./system-health-check.sh
    
    ;;
    
  "partial")
    echo "🔧 استعادة جزئية للنظام..."
    
    # استعادة البيانات فقط
    latest_db_backup=$(find ./backups/mongodb/full/ -name "full_${BACKUP_DATE}*.tar.gz" | head -1)
    if [ -n "$latest_db_backup" ]; then
      ./mongodb-restore-full.sh "$latest_db_backup"
    else
      echo "❌ لم يتم العثور على نسخة احتياطية للتاريخ المحدد"
      exit 1
    fi
    
    ;;
    
  "emergency")
    echo "🚨 استعادة طوارئ - البيانات الحرجة فقط..."
    
    # استعادة سريعة للبيانات الحرجة
    mongo hospital_erp_production --eval "
      // استعادة بيانات المرضى الحرجة
      db.patients.find({status: 'critical'}).forEach(function(doc) {
        print('مريض حرج: ' + doc.firstName + ' ' + doc.lastName);
      });
      
      // استعادة المواعيد لليوم الحالي
      var today = new Date();
      today.setHours(0,0,0,0);
      var tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      db.appointments.find({
        date: {
          \$gte: today,
          \$lt: tomorrow
        }
      }).forEach(function(doc) {
        print('موعد اليوم: ' + doc.patientName + ' - ' + doc.time);
      });
    "
    
    ;;
    
  *)
    echo "❌ نوع استعادة غير صحيح. الأنواع المتاحة: full, partial, emergency"
    exit 1
    ;;
esac

echo "✅ انتهت عملية الاستعادة"
```

### 2. اختبار سلامة النظام بعد الاستعادة

```bash
#!/bin/bash
# system-health-check.sh

echo "🧪 بدء اختبار سلامة النظام..."

# اختبار قاعدة البيانات
echo "🗄️ اختبار قاعدة البيانات..."
mongo_status=$(mongo --eval "db.adminCommand('ismaster')" --quiet)
if [[ $mongo_status == *"true"* ]]; then
  echo "✅ قاعدة البيانات تعمل بشكل صحيح"
else
  echo "❌ مشكلة في قاعدة البيانات"
  exit 1
fi

# اختبار Redis
echo "💾 اختبار Redis..."
redis_status=$(redis-cli ping)
if [ "$redis_status" = "PONG" ]; then
  echo "✅ Redis يعمل بشكل صحيح"
else
  echo "❌ مشكلة في Redis"
  exit 1
fi

# اختبار التطبيق
echo "🌐 اختبار التطبيق..."
app_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health)
if [ "$app_status" = "200" ]; then
  echo "✅ التطبيق يعمل بشكل صحيح"
else
  echo "❌ مشكلة في التطبيق"
  exit 1
fi

# اختبار سلامة البيانات
echo "🔍 اختبار سلامة البيانات..."
patient_count=$(mongo hospital_erp_production --eval "db.patients.count()" --quiet)
appointment_count=$(mongo hospital_erp_production --eval "db.appointments.count()" --quiet)

echo "📊 إحصائيات البيانات:"
echo "   - عدد المرضى: $patient_count"
echo "   - عدد المواعيد: $appointment_count"

if [ "$patient_count" -gt 0 ] && [ "$appointment_count" -gt 0 ]; then
  echo "✅ البيانات سليمة"
else
  echo "⚠️ تحذير: قد تكون هناك مشكلة في البيانات"
fi

echo "✅ انتهى اختبار سلامة النظام"
```

---

## أتمتة النسخ الاحتياطي

### 1. جدولة المهام (Cron Jobs)

```bash
# /etc/cron.d/hospital-erp-backup

# النسخ الاحتياطي اليومي (2:00 صباحاً)
0 2 * * * root /opt/hospital-erp/scripts/mongodb-incremental-backup.sh >> /var/log/backup.log 2>&1

# النسخ الاحتياطي الأسبوعي (2:00 صباحاً يوم الأحد)
0 2 * * 0 root /opt/hospital-erp/scripts/mongodb-full-backup.sh >> /var/log/backup.log 2>&1

# نسخ احتياطي لـ Redis (3:00 صباحاً يومياً)
0 3 * * * root /opt/hospital-erp/scripts/redis-backup.sh >> /var/log/backup.log 2>&1

# نسخ احتياطي للملفات (4:00 صباحاً يومياً)
0 4 * * * root /opt/hospital-erp/scripts/user-files-backup.sh >> /var/log/backup.log 2>&1

# نسخ احتياطي للإعدادات (5:00 صباحاً أسبوعياً)
0 5 * * 0 root /opt/hospital-erp/scripts/system-config-backup.sh >> /var/log/backup.log 2>&1

# تنظيف النسخ القديمة (6:00 صباحاً شهرياً)
0 6 1 * * root /opt/hospital-erp/scripts/cleanup-old-backups.sh >> /var/log/backup.log 2>&1
```

### 2. مراقب النسخ الاحتياطي

```typescript
// backup-monitor.ts
class BackupMonitor {
  private checkInterval = 3600000; // ساعة واحدة
  private alertThreshold = 86400000; // 24 ساعة
  
  start() {
    setInterval(() => {
      this.checkBackupStatus();
    }, this.checkInterval);
    
    console.log('🔍 بدء مراقبة النسخ الاحتياطي...');
  }
  
  private async checkBackupStatus() {
    try {
      // فحص آخر نسخة احتياطية لقاعدة البيانات
      const lastDbBackup = await this.getLastBackupTime('mongodb');
      const lastRedisBackup = await this.getLastBackupTime('redis');
      const lastFilesBackup = await this.getLastBackupTime('files');
      
      const now = Date.now();
      
      // تحقق من النسخ الاحتياطية المتأخرة
      if (now - lastDbBackup > this.alertThreshold) {
        await this.sendAlert('تحذير: النسخة الاحتياطية لقاعدة البيانات متأخرة');
      }
      
      if (now - lastRedisBackup > this.alertThreshold) {
        await this.sendAlert('تحذير: النسخة الاحتياطية لـ Redis متأخرة');
      }
      
      if (now - lastFilesBackup > this.alertThreshold) {
        await this.sendAlert('تحذير: النسخة الاحتياطية للملفات متأخرة');
      }
      
      // فحص سلامة النسخ الاحتياطية
      await this.verifyBackupIntegrity();
      
    } catch (error) {
      console.error('خطأ في مراقبة النسخ الاحتياطي:', error);
      await this.sendAlert(`خطأ في مراقبة النسخ الاحتياطي: ${error.message}`);
    }
  }
  
  private async getLastBackupTime(type: string): Promise<number> {
    const backupDir = `/backup/${type}`;
    const files = await fs.readdir(backupDir);
    
    if (files.length === 0) {
      return 0;
    }
    
    const latestFile = files
      .filter(file => file.endsWith('.tar.gz'))
      .sort()
      .pop();
    
    if (!latestFile) {
      return 0;
    }
    
    const stats = await fs.stat(path.join(backupDir, latestFile));
    return stats.mtime.getTime();
  }
  
  private async verifyBackupIntegrity() {
    // فحص checksum للنسخ الاحتياطية
    const backupDirs = ['/backup/mongodb', '/backup/redis', '/backup/application'];
    
    for (const dir of backupDirs) {
      const files = await fs.readdir(dir);
      const checksumFiles = files.filter(file => file.endsWith('.sha256'));
      
      for (const checksumFile of checksumFiles) {
        const checksumPath = path.join(dir, checksumFile);
        const backupFile = checksumPath.replace('.sha256', '');
        
        if (await fs.pathExists(backupFile)) {
          const isValid = await this.verifyChecksum(backupFile, checksumPath);
          if (!isValid) {
            await this.sendAlert(`تحذير: النسخة الاحتياطية تالفة: ${backupFile}`);
          }
        }
      }
    }
  }
  
  private async verifyChecksum(filePath: string, checksumPath: string): Promise<boolean> {
    try {
      const expectedChecksum = (await fs.readFile(checksumPath, 'utf8')).split(' ')[0];
      const actualChecksum = await this.calculateSHA256(filePath);
      
      return expectedChecksum === actualChecksum;
    } catch (error) {
      console.error('خطأ في فحص checksum:', error);
      return false;
    }
  }
  
  private async calculateSHA256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
  
  private async sendAlert(message: string) {
    try {
      // إرسال تنبيه عبر Slack
      await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 ${message}`,
          channel: '#backup-alerts',
          username: 'Backup Monitor'
        })
      });
      
      // تسجيل في السجلات
      console.error(`BACKUP ALERT: ${message}`);
      
    } catch (error) {
      console.error('خطأ في إرسال التنبيه:', error);
    }
  }
}

// بدء مراقبة النسخ الاحتياطي
const backupMonitor = new BackupMonitor();
backupMonitor.start();
```

---

## الخلاصة

هذا الدليل يوفر استراتيجية شاملة للنسخ الاحتياطي والاستعادة تضمن:

### الفوائد الرئيسية:

1. **حماية البيانات**: نسخ احتياطية متعددة المستويات
2. **الاستعادة السريعة**: إجراءات واضحة للاستعادة
3. **التشغيل المستمر**: تقليل وقت التوقف
4. **الامتثال**: تلبية متطلبات الامتثال الطبي
5. **راحة البال**: ثقة في حماية البيانات

### نصائح مهمة:

1. **اختبار دوري**: اختبر عمليات الاستعادة بانتظام
2. **التوثيق**: وثق جميع الإجراءات والتغييرات
3. **التدريب**: درب الفريق على إجراءات الاستعادة
4. **المراقبة**: راقب حالة النسخ الاحتياطي باستمرار
5. **التحديث**: حدث الاستراتيجية حسب نمو النظام