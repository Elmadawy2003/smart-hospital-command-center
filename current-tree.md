├── 📁 ai-services/
│   ├── 📁 node_modules/ 🚫 (auto-hidden)
│   ├── 📁 src/
│   │   ├── 📁 middleware/
│   │   │   ├── 📄 auth.ts
│   │   │   ├── 📄 errorHandler.ts
│   │   │   └── 📄 logging.ts
│   │   ├── 📁 routes/
│   │   │   ├── 📄 appointmentOptimization.ts
│   │   │   ├── 📄 diagnosisAssistance.ts
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 inventoryPrediction.ts
│   │   │   ├── 📄 patientInsights.ts
│   │   │   ├── 📄 resourceOptimization.ts
│   │   │   └── 📄 riskPrediction.ts
│   │   ├── 📁 services/
│   │   │   ├── 📄 appointmentOptimization.ts
│   │   │   ├── 📄 diagnosisAssistance.ts
│   │   │   ├── 📄 initialization.ts
│   │   │   ├── 📄 inventoryPrediction.ts
│   │   │   ├── 📄 modelTraining.ts
│   │   │   ├── 📄 patientInsights.ts
│   │   │   ├── 📄 resourceOptimization.ts
│   │   │   └── 📄 riskPrediction.ts
│   │   ├── 📁 types/
│   │   │   └── 📄 index.ts
│   │   ├── 📁 utils/
│   │   │   ├── 📄 logger.ts
│   │   │   ├── 📄 redis.ts
│   │   │   └── 📄 scheduler.ts
│   │   └── 📄 index.ts
│   ├── 📄 .env.example
│   ├── 📄 package.json
│   └── 📄 tsconfig.json
├── 📁 backend/
│   ├── 📁 dist/ 🚫 (auto-hidden)
│   ├── 📁 logs/
│   │   ├── 📋 combined.log 🚫 (auto-hidden)
│   │   └── 📋 error.log 🚫 (auto-hidden)
│   ├── 📁 node_modules/ 🚫 (auto-hidden)
│   ├── 📁 prisma/
│   │   ├── 📁 migrations/
│   │   │   ├── 📁 20241009171200_init/
│   │   │   │   └── 🗄️ migration.sql
│   │   │   └── ⚙️ migration_lock.toml
│   │   └── 📄 schema.prisma
│   ├── 📁 src/
│   │   ├── 📁 config/
│   │   │   ├── 📄 database.ts
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 prisma.ts
│   │   │   └── 📄 redis.ts
│   │   ├── 📁 controllers/
│   │   │   ├── 📄 appointmentController.ts
│   │   │   ├── 📄 authController.ts
│   │   │   ├── 📄 billingController.ts
│   │   │   ├── 📄 dashboardController.ts
│   │   │   ├── 📄 emrController.ts
│   │   │   ├── 📄 financeController.ts
│   │   │   ├── 📄 hrController.ts
│   │   │   ├── 📄 imagingController.ts
│   │   │   ├── 📄 inventoryController.ts
│   │   │   ├── 📄 labController.ts
│   │   │   ├── 📄 medicalRecordController.ts
│   │   │   ├── 📄 notificationController.ts
│   │   │   ├── 📄 patientController.ts
│   │   │   ├── 📄 pharmacyController.ts
│   │   │   ├── 📄 reportController.ts
│   │   │   ├── 📄 statisticsController.ts
│   │   │   └── 📄 userController.ts
│   │   ├── 📁 middleware/
│   │   │   ├── 📄 auth.ts
│   │   │   ├── 📄 cors.ts
│   │   │   ├── 📄 errorHandler.ts
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 logging.ts
│   │   │   ├── 📄 notFoundHandler.ts
│   │   │   ├── 📄 rateLimiter.ts
│   │   │   ├── 📄 security.ts
│   │   │   └── 📄 validation.ts
│   │   ├── 📁 models/
│   │   │   ├── 📄 Appointment.ts
│   │   │   ├── 📄 Billing.ts
│   │   │   ├── 📄 Employee.ts
│   │   │   ├── 📄 Inventory.ts
│   │   │   ├── 📄 MedicalRecord.ts
│   │   │   ├── 📄 Patient.ts
│   │   │   ├── 📄 User.ts
│   │   │   └── 📄 index.ts
│   │   ├── 📁 routes/
│   │   │   ├── 📄 aiModelsRoutes.ts
│   │   │   ├── 📄 appointments.ts
│   │   │   ├── 📄 auth.ts
│   │   │   ├── 📄 dashboard.ts
│   │   │   ├── 📄 dashboardRoutes.ts
│   │   │   ├── 📄 ePrescriptionRoutes.ts
│   │   │   ├── 📄 edwRoutes.ts
│   │   │   ├── 📄 emr.ts
│   │   │   ├── 📄 finance.ts
│   │   │   ├── 📄 hl7Routes.ts
│   │   │   ├── 📄 hr.ts
│   │   │   ├── 📄 imaging.ts
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 insuranceRoutes.ts
│   │   │   ├── 📄 inventory.ts
│   │   │   ├── 📄 lab.ts
│   │   │   ├── 📄 medical-records.ts
│   │   │   ├── 📄 notifications.ts
│   │   │   ├── 📄 pacsRoutes.ts
│   │   │   ├── 📄 patients.ts
│   │   │   ├── 📄 pharmacy.ts
│   │   │   ├── 📄 reports.ts
│   │   │   ├── 📄 securityRoutes.ts
│   │   │   ├── 📄 statistics.ts
│   │   │   ├── 📄 supplyChainRoutes.ts
│   │   │   └── 📄 users.ts
│   │   ├── 📁 services/
│   │   │   ├── 📄 advancedSecurityService.ts
│   │   │   ├── 📄 aiModelsService.ts
│   │   │   ├── 📄 authService.ts
│   │   │   ├── 📄 cacheService.ts
│   │   │   ├── 📄 dashboardService.ts
│   │   │   ├── 📄 ePrescriptionService.ts
│   │   │   ├── 📄 edwService.ts
│   │   │   ├── 📄 fhirService.ts
│   │   │   ├── 📄 hl7Service.ts
│   │   │   ├── 📄 insuranceService.ts
│   │   │   ├── 📄 notificationService.ts
│   │   │   ├── 📄 pacsService.ts
│   │   │   └── 📄 supplyChainService.ts
│   │   ├── 📁 types/
│   │   │   └── 📄 index.ts
│   │   ├── 📁 utils/
│   │   │   ├── 📄 constants.ts
│   │   │   ├── 📄 database.ts
│   │   │   ├── 📄 helpers.ts
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 logger.ts
│   │   │   ├── 📄 redis.ts
│   │   │   └── 📄 validation.ts
│   │   └── 📄 index.ts
│   ├── 📁 tests/
│   ├── 📁 uploads/
│   ├── 🔒 .env 🚫 (auto-hidden)
│   ├── 📄 .env.example
│   ├── 📄 .eslintrc.js
│   ├── 📄 nodemon.json
│   ├── 📄 package.json
│   └── 📄 tsconfig.json
├── 📁 database/
│   ├── 🗄️ schema.sql
│   └── 🗄️ seed.sql
├── 📁 docker/
├── 📁 docs/
│   ├── 📝 API_DOCUMENTATION.md
│   ├── 📝 BACKUP_RECOVERY_GUIDE.md
│   ├── 📝 COMPLIANCE_RISK_GUIDE.md
│   ├── 📝 DEPLOYMENT_GUIDE.md
│   ├── 📝 DEVELOPER_GUIDE.md
│   ├── 📝 INSTALLATION_GUIDE.md
│   ├── 📝 MAINTENANCE_GUIDE.md
│   ├── 📝 PERFORMANCE_GUIDE.md
│   ├── 📝 QUALITY_KPI_GUIDE.md
│   ├── 📝 SECURITY_GUIDE.md
│   ├── 📝 TESTING_GUIDE.md
│   └── 📝 USER_GUIDE.md
├── 📁 frontend/
│   ├── 📁 .git/ 🚫 (auto-hidden)
│   ├── 📁 .next/ 🚫 (auto-hidden)
│   ├── 📁 public/
│   │   ├── 🖼️ file.svg
│   │   ├── 🖼️ globe.svg
│   │   ├── 🖼️ next.svg
│   │   ├── 🖼️ vercel.svg
│   │   └── 🖼️ window.svg
│   ├── 📁 src/
│   │   ├── 📁 app/
│   │   │   ├── 📁 ai-dashboard/
│   │   │   │   ├── 📁 diagnosis/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 insights/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 resources/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 risk-prediction/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 appointments/
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   ├── 📁 edit/
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 doctors/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 new/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 schedule/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 billing/
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   ├── 📁 edit/
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 new/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 payments/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 reports/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 command-center/
│   │   │   │   ├── 📁 analytics/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 incidents/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 resources/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 systems/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 dashboard/
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 hr/
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   ├── 📁 edit/
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 attendance/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 new/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 payroll/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 lab/
│   │   │   │   ├── 📁 reports/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 requests/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 results/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 laboratory/
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   ├── 📁 edit/
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 new/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 login/
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 medical-records/
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   ├── 📁 edit/
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 new/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 search/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 patient-portal/
│   │   │   │   ├── 📁 appointments/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 login/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 medical-records/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 test-results/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 patients/
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   ├── 📁 edit/
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   ├── 📁 medical-history/
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 new/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 pharmacy/
│   │   │   │   ├── 📁 [id]/
│   │   │   │   │   ├── 📁 edit/
│   │   │   │   │   │   └── 📄 page.tsx
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 new/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 prescriptions/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 reports/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 reports/
│   │   │   │   ├── 📁 analytics/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 financial/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 hr/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 medical/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 resources/
│   │   │   │   ├── 📁 equipment/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📁 inventory/
│   │   │   │       └── 📄 page.tsx
│   │   │   ├── 📁 telehealth/
│   │   │   │   ├── 📁 consultation/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 dashboard/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   ├── 📁 video-sessions/
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 🖼️ favicon.ico
│   │   │   ├── 🎨 globals.css
│   │   │   ├── 📄 layout.tsx
│   │   │   ├── 📄 not-found.tsx
│   │   │   ├── 📄 page.tsx
│   │   │   └── 📄 providers.tsx
│   │   ├── 📁 components/
│   │   │   ├── 📁 appointments/
│   │   │   │   └── 📄 appointment-form.tsx
│   │   │   ├── 📁 layout/
│   │   │   │   ├── 📄 header.tsx
│   │   │   │   ├── 📄 main-layout.tsx
│   │   │   │   ├── 📄 responsive-layout.tsx
│   │   │   │   └── 📄 sidebar.tsx
│   │   │   ├── 📁 patients/
│   │   │   │   └── 📄 patient-form.tsx
│   │   │   ├── 📁 seo/
│   │   │   │   └── 📄 seo-head.tsx
│   │   │   └── 📁 ui/
│   │   │       ├── 📄 advanced-components.tsx
│   │   │       ├── 📄 alert.tsx
│   │   │       ├── 📄 avatar.tsx
│   │   │       ├── 📄 badge.tsx
│   │   │       ├── 📄 button.tsx
│   │   │       ├── 📄 card.tsx
│   │   │       ├── 📄 chart.tsx
│   │   │       ├── 📄 checkbox.tsx
│   │   │       ├── 📄 dialog.tsx
│   │   │       ├── 📄 icons.tsx
│   │   │       ├── 📄 input.tsx
│   │   │       ├── 📄 label.tsx
│   │   │       ├── 📄 progress.tsx
│   │   │       ├── 📄 select.tsx
│   │   │       ├── 📄 separator.tsx
│   │   │       ├── 📄 table.tsx
│   │   │       ├── 📄 tabs.tsx
│   │   │       └── 📄 textarea.tsx
│   │   ├── 📁 lib/
│   │   │   ├── 📄 api.ts
│   │   │   ├── 📄 store.ts
│   │   │   └── 📄 utils.ts
│   │   ├── 📁 pages/
│   │   │   ├── 📄 AIModels.tsx
│   │   │   ├── 📄 Dashboard.tsx
│   │   │   ├── 📄 EPrescription.tsx
│   │   │   ├── 📄 Insurance.tsx
│   │   │   ├── 📄 PACS.tsx
│   │   │   └── 📄 SupplyChain.tsx
│   │   ├── 📁 styles/
│   │   │   └── 📄 theme.ts
│   │   └── 📁 utils/
│   │       ├── 📄 accessibility.ts
│   │       ├── 📄 error-handling.ts
│   │       ├── 📄 performance.ts
│   │       └── 📄 security.ts
│   ├── 🚫 .gitignore
│   ├── 📖 README.md
│   ├── 📄 eslint.config.mjs
│   ├── 📄 next-env.d.ts
│   ├── 📄 next.config.ts
│   ├── 📄 package.json
│   ├── 📄 postcss.config.mjs
│   └── 📄 tsconfig.json
├── 📁 k8s/
├── 📁 monitoring/
├── 📁 nginx/
├── 📁 node_modules/ 🚫 (auto-hidden)
├── 📁 scripts/
├── 📖 README.md
├── 📝 current-tree.md
├── 📝 description.md
├── ⚙️ docker-compose.yml
├── 📄 package-lock.json
├── 📄 package.json
└── 📝 ptoject.md