# دليل إدارة الجودة ومؤشرات الأداء - نظام إدارة المستشفيات

## نظرة عامة

هذا الدليل يوضح كيفية إدارة الجودة وقياس الأداء في نظام إدارة المستشفيات لضمان تقديم أفضل رعاية صحية.

---

## مؤشرات الأداء الرئيسية (KPIs)

### 1. مؤشرات الجودة الطبية

```typescript
// medical-quality-kpis.ts
class MedicalQualityKPIs {
  // معدل رضا المرضى
  static async calculatePatientSatisfaction(startDate: Date, endDate: Date) {
    const surveys = await PatientSurvey.find({
      submittedAt: { $gte: startDate, $lte: endDate }
    });
    
    if (surveys.length === 0) return 0;
    
    const totalScore = surveys.reduce((sum, survey) => sum + survey.overallRating, 0);
    const averageRating = totalScore / surveys.length;
    
    // تحليل تفصيلي
    const analysis = {
      averageRating: Math.round(averageRating * 100) / 100,
      totalResponses: surveys.length,
      ratingDistribution: {
        excellent: surveys.filter(s => s.overallRating >= 4.5).length,
        good: surveys.filter(s => s.overallRating >= 3.5 && s.overallRating < 4.5).length,
        average: surveys.filter(s => s.overallRating >= 2.5 && s.overallRating < 3.5).length,
        poor: surveys.filter(s => s.overallRating < 2.5).length
      },
      commonComplaints: await this.analyzeComplaints(surveys),
      improvementAreas: await this.identifyImprovementAreas(surveys)
    };
    
    return analysis;
  }
  
  // معدل إعادة الدخول
  static async calculateReadmissionRate(startDate: Date, endDate: Date) {
    const discharges = await Admission.find({
      dischargeDate: { $gte: startDate, $lte: endDate },
      status: 'Discharged'
    });
    
    let readmissions = 0;
    
    for (const discharge of discharges) {
      // البحث عن إعادة دخول خلال 30 يوم
      const readmission = await Admission.findOne({
        patientId: discharge.patientId,
        admissionDate: {
          $gte: discharge.dischargeDate,
          $lte: new Date(discharge.dischargeDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      
      if (readmission) readmissions++;
    }
    
    const readmissionRate = discharges.length > 0 ? (readmissions / discharges.length) * 100 : 0;
    
    return {
      totalDischarges: discharges.length,
      readmissions,
      readmissionRate: Math.round(readmissionRate * 100) / 100,
      benchmark: 15, // المعيار المقبول 15%
      status: readmissionRate <= 15 ? 'Good' : 'Needs Improvement'
    };
  }
  
  // معدل العدوى المكتسبة في المستشفى
  static async calculateHAIRate(startDate: Date, endDate: Date) {
    const admissions = await Admission.find({
      admissionDate: { $gte: startDate, $lte: endDate }
    });
    
    let infections = 0;
    
    for (const admission of admissions) {
      // البحث عن عدوى حدثت بعد 48 ساعة من الدخول
      const infection = await MedicalRecord.findOne({
        patientId: admission.patientId,
        recordDate: {
          $gte: new Date(admission.admissionDate.getTime() + 48 * 60 * 60 * 1000),
          $lte: admission.dischargeDate || new Date()
        },
        diagnosis: { $regex: /infection|عدوى/i }
      });
      
      if (infection) infections++;
    }
    
    const haiRate = admissions.length > 0 ? (infections / admissions.length) * 100 : 0;
    
    return {
      totalAdmissions: admissions.length,
      infections,
      haiRate: Math.round(haiRate * 100) / 100,
      benchmark: 5, // المعيار المقبول 5%
      status: haiRate <= 5 ? 'Excellent' : haiRate <= 10 ? 'Good' : 'Needs Improvement'
    };
  }
  
  // متوسط مدة الإقامة
  static async calculateAverageLengthOfStay(startDate: Date, endDate: Date) {
    const discharges = await Admission.find({
      dischargeDate: { $gte: startDate, $lte: endDate },
      status: 'Discharged'
    });
    
    if (discharges.length === 0) return 0;
    
    const totalDays = discharges.reduce((sum, admission) => {
      const lengthOfStay = Math.ceil(
        (admission.dischargeDate.getTime() - admission.admissionDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      return sum + lengthOfStay;
    }, 0);
    
    const averageLOS = totalDays / discharges.length;
    
    // تحليل حسب القسم
    const departmentAnalysis = {};
    for (const admission of discharges) {
      const dept = admission.department;
      if (!departmentAnalysis[dept]) {
        departmentAnalysis[dept] = { total: 0, count: 0 };
      }
      
      const los = Math.ceil(
        (admission.dischargeDate.getTime() - admission.admissionDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      
      departmentAnalysis[dept].total += los;
      departmentAnalysis[dept].count += 1;
    }
    
    // حساب المتوسط لكل قسم
    Object.keys(departmentAnalysis).forEach(dept => {
      departmentAnalysis[dept].average = 
        Math.round((departmentAnalysis[dept].total / departmentAnalysis[dept].count) * 100) / 100;
    });
    
    return {
      overallAverage: Math.round(averageLOS * 100) / 100,
      totalDischarges: discharges.length,
      departmentBreakdown: departmentAnalysis,
      benchmark: 7, // المعيار المقبول 7 أيام
      status: averageLOS <= 7 ? 'Good' : 'Needs Improvement'
    };
  }
  
  // معدل الوفيات
  static async calculateMortalityRate(startDate: Date, endDate: Date) {
    const admissions = await Admission.find({
      admissionDate: { $gte: startDate, $lte: endDate }
    });
    
    const deaths = await Admission.find({
      admissionDate: { $gte: startDate, $lte: endDate },
      dischargeType: 'Death'
    });
    
    const mortalityRate = admissions.length > 0 ? (deaths.length / admissions.length) * 100 : 0;
    
    // تحليل أسباب الوفاة
    const deathCauses = {};
    for (const death of deaths) {
      const medicalRecord = await MedicalRecord.findOne({
        patientId: death.patientId,
        recordDate: { $lte: death.dischargeDate }
      }).sort({ recordDate: -1 });
      
      if (medicalRecord) {
        const cause = medicalRecord.diagnosis || 'غير محدد';
        deathCauses[cause] = (deathCauses[cause] || 0) + 1;
      }
    }
    
    return {
      totalAdmissions: admissions.length,
      deaths: deaths.length,
      mortalityRate: Math.round(mortalityRate * 100) / 100,
      deathCauses,
      benchmark: 2, // المعيار المقبول 2%
      status: mortalityRate <= 2 ? 'Excellent' : mortalityRate <= 5 ? 'Good' : 'Needs Review'
    };
  }
}
```

### 2. مؤشرات الكفاءة التشغيلية

```typescript
// operational-efficiency-kpis.ts
class OperationalEfficiencyKPIs {
  // معدل استخدام الأسرة
  static async calculateBedOccupancyRate(startDate: Date, endDate: Date) {
    const totalBeds = await Bed.countDocuments({ isActive: true });
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const totalBedDays = totalBeds * days;
    
    // حساب أيام الإشغال الفعلية
    const occupiedBedDays = await Admission.aggregate([
      {
        $match: {
          $or: [
            { admissionDate: { $gte: startDate, $lte: endDate } },
            { dischargeDate: { $gte: startDate, $lte: endDate } },
            { 
              admissionDate: { $lt: startDate },
              $or: [
                { dischargeDate: { $gt: endDate } },
                { dischargeDate: null }
              ]
            }
          ]
        }
      },
      {
        $project: {
          patientId: 1,
          bedId: 1,
          occupiedDays: {
            $divide: [
              {
                $subtract: [
                  { $min: [{ $ifNull: ['$dischargeDate', endDate] }, endDate] },
                  { $max: ['$admissionDate', startDate] }
                ]
              },
              24 * 60 * 60 * 1000
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalOccupiedDays: { $sum: '$occupiedDays' }
        }
      }
    ]);
    
    const actualOccupiedDays = occupiedBedDays[0]?.totalOccupiedDays || 0;
    const occupancyRate = totalBedDays > 0 ? (actualOccupiedDays / totalBedDays) * 100 : 0;
    
    // تحليل حسب القسم
    const departmentOccupancy = await this.calculateDepartmentOccupancy(startDate, endDate);
    
    return {
      totalBeds,
      totalBedDays,
      occupiedBedDays: Math.round(actualOccupiedDays),
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      departmentBreakdown: departmentOccupancy,
      benchmark: 85, // المعيار المثالي 85%
      status: occupancyRate >= 80 && occupancyRate <= 90 ? 'Optimal' : 
              occupancyRate < 80 ? 'Underutilized' : 'Overcrowded'
    };
  }
  
  // متوسط وقت الانتظار
  static async calculateAverageWaitTime(startDate: Date, endDate: Date) {
    const appointments = await Appointment.find({
      appointmentDate: { $gte: startDate, $lte: endDate },
      status: 'Completed'
    });
    
    let totalWaitTime = 0;
    let validAppointments = 0;
    
    for (const appointment of appointments) {
      if (appointment.actualStartTime && appointment.scheduledTime) {
        const waitTime = appointment.actualStartTime.getTime() - appointment.scheduledTime.getTime();
        if (waitTime >= 0) { // تجاهل الأوقات السالبة
          totalWaitTime += waitTime;
          validAppointments++;
        }
      }
    }
    
    const averageWaitTime = validAppointments > 0 ? totalWaitTime / validAppointments : 0;
    const averageWaitMinutes = Math.round(averageWaitTime / (60 * 1000));
    
    // تحليل حسب التخصص
    const specialtyAnalysis = {};
    for (const appointment of appointments) {
      const specialty = appointment.specialty || 'عام';
      if (!specialtyAnalysis[specialty]) {
        specialtyAnalysis[specialty] = { total: 0, count: 0 };
      }
      
      if (appointment.actualStartTime && appointment.scheduledTime) {
        const waitTime = appointment.actualStartTime.getTime() - appointment.scheduledTime.getTime();
        if (waitTime >= 0) {
          specialtyAnalysis[specialty].total += waitTime;
          specialtyAnalysis[specialty].count += 1;
        }
      }
    }
    
    // حساب المتوسط لكل تخصص
    Object.keys(specialtyAnalysis).forEach(specialty => {
      const data = specialtyAnalysis[specialty];
      data.averageMinutes = data.count > 0 ? 
        Math.round((data.total / data.count) / (60 * 1000)) : 0;
    });
    
    return {
      totalAppointments: appointments.length,
      validAppointments,
      averageWaitMinutes,
      specialtyBreakdown: specialtyAnalysis,
      benchmark: 15, // المعيار المقبول 15 دقيقة
      status: averageWaitMinutes <= 15 ? 'Excellent' : 
              averageWaitMinutes <= 30 ? 'Good' : 'Needs Improvement'
    };
  }
  
  // معدل إلغاء المواعيد
  static async calculateAppointmentCancellationRate(startDate: Date, endDate: Date) {
    const totalAppointments = await Appointment.countDocuments({
      appointmentDate: { $gte: startDate, $lte: endDate }
    });
    
    const cancelledAppointments = await Appointment.countDocuments({
      appointmentDate: { $gte: startDate, $lte: endDate },
      status: 'Cancelled'
    });
    
    const cancellationRate = totalAppointments > 0 ? 
      (cancelledAppointments / totalAppointments) * 100 : 0;
    
    // تحليل أسباب الإلغاء
    const cancellationReasons = await Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: startDate, $lte: endDate },
          status: 'Cancelled'
        }
      },
      {
        $group: {
          _id: '$cancellationReason',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // تحليل وقت الإلغاء
    const cancellationTiming = await Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: startDate, $lte: endDate },
          status: 'Cancelled',
          cancelledAt: { $exists: true }
        }
      },
      {
        $project: {
          hoursBeforeAppointment: {
            $divide: [
              { $subtract: ['$appointmentDate', '$cancelledAt'] },
              3600000 // تحويل إلى ساعات
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$hoursBeforeAppointment',
          boundaries: [0, 2, 24, 72, 168], // 2 ساعة، يوم، 3 أيام، أسبوع
          default: 'أكثر من أسبوع',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);
    
    return {
      totalAppointments,
      cancelledAppointments,
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      cancellationReasons,
      cancellationTiming,
      benchmark: 10, // المعيار المقبول 10%
      status: cancellationRate <= 10 ? 'Good' : 'Needs Improvement'
    };
  }
  
  // كفاءة غرفة العمليات
  static async calculateOREfficiency(startDate: Date, endDate: Date) {
    const surgeries = await Surgery.find({
      scheduledDate: { $gte: startDate, $lte: endDate },
      status: 'Completed'
    });
    
    let totalScheduledTime = 0;
    let totalActualTime = 0;
    let onTimeStarts = 0;
    
    for (const surgery of surgeries) {
      if (surgery.scheduledDuration && surgery.actualDuration) {
        totalScheduledTime += surgery.scheduledDuration;
        totalActualTime += surgery.actualDuration;
      }
      
      if (surgery.scheduledStartTime && surgery.actualStartTime) {
        const delay = surgery.actualStartTime.getTime() - surgery.scheduledStartTime.getTime();
        if (delay <= 15 * 60 * 1000) { // تأخير أقل من 15 دقيقة يعتبر في الوقت
          onTimeStarts++;
        }
      }
    }
    
    const timeEfficiency = totalScheduledTime > 0 ? 
      (totalScheduledTime / totalActualTime) * 100 : 0;
    
    const onTimeRate = surgeries.length > 0 ? 
      (onTimeStarts / surgeries.length) * 100 : 0;
    
    // تحليل استخدام غرف العمليات
    const orUtilization = await OperatingRoom.aggregate([
      {
        $lookup: {
          from: 'surgeries',
          localField: '_id',
          foreignField: 'operatingRoomId',
          as: 'surgeries'
        }
      },
      {
        $project: {
          roomNumber: 1,
          totalSurgeries: { $size: '$surgeries' },
          totalDuration: {
            $sum: {
              $map: {
                input: '$surgeries',
                as: 'surgery',
                in: '$$surgery.actualDuration'
              }
            }
          }
        }
      }
    ]);
    
    return {
      totalSurgeries: surgeries.length,
      timeEfficiency: Math.round(timeEfficiency * 100) / 100,
      onTimeRate: Math.round(onTimeRate * 100) / 100,
      averageScheduledDuration: totalScheduledTime / surgeries.length || 0,
      averageActualDuration: totalActualTime / surgeries.length || 0,
      orUtilization,
      benchmarks: {
        timeEfficiency: 90,
        onTimeRate: 85
      },
      status: {
        timeEfficiency: timeEfficiency >= 90 ? 'Excellent' : timeEfficiency >= 80 ? 'Good' : 'Needs Improvement',
        onTimeRate: onTimeRate >= 85 ? 'Excellent' : onTimeRate >= 75 ? 'Good' : 'Needs Improvement'
      }
    };
  }
}
```

### 3. مؤشرات الأداء المالي

```typescript
// financial-kpis.ts
class FinancialKPIs {
  // الإيرادات والربحية
  static async calculateRevenueMetrics(startDate: Date, endDate: Date) {
    // إجمالي الإيرادات
    const totalRevenue = await Billing.aggregate([
      {
        $match: {
          billingDate: { $gte: startDate, $lte: endDate },
          status: 'Paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    // الإيرادات حسب الخدمة
    const revenueByService = await Billing.aggregate([
      {
        $match: {
          billingDate: { $gte: startDate, $lte: endDate },
          status: 'Paid'
        }
      },
      {
        $unwind: '$services'
      },
      {
        $group: {
          _id: '$services.serviceType',
          revenue: { $sum: '$services.amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]);
    
    // متوسط قيمة الفاتورة
    const averageBillAmount = await Billing.aggregate([
      {
        $match: {
          billingDate: { $gte: startDate, $lte: endDate },
          status: 'Paid'
        }
      },
      {
        $group: {
          _id: null,
          average: { $avg: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // نمو الإيرادات (مقارنة بالفترة السابقة)
    const previousPeriodStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const previousPeriodEnd = startDate;
    
    const previousRevenue = await Billing.aggregate([
      {
        $match: {
          billingDate: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
          status: 'Paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const currentTotal = totalRevenue[0]?.total || 0;
    const previousTotal = previousRevenue[0]?.total || 0;
    const revenueGrowth = previousTotal > 0 ? 
      ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
    
    return {
      totalRevenue: currentTotal,
      revenueByService,
      averageBillAmount: averageBillAmount[0]?.average || 0,
      totalBills: averageBillAmount[0]?.count || 0,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      previousPeriodRevenue: previousTotal
    };
  }
  
  // معدل تحصيل الديون
  static async calculateCollectionRate(startDate: Date, endDate: Date) {
    // إجمالي الفواتير المستحقة
    const totalBilled = await Billing.aggregate([
      {
        $match: {
          billingDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    // إجمالي المبالغ المحصلة
    const totalCollected = await Billing.aggregate([
      {
        $match: {
          billingDate: { $gte: startDate, $lte: endDate },
          status: 'Paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' }
        }
      }
    ]);
    
    const billed = totalBilled[0]?.total || 0;
    const collected = totalCollected[0]?.total || 0;
    const collectionRate = billed > 0 ? (collected / billed) * 100 : 0;
    
    // تحليل الديون المتأخرة
    const overdueAnalysis = await Billing.aggregate([
      {
        $match: {
          status: { $in: ['Pending', 'Overdue'] },
          dueDate: { $lt: new Date() }
        }
      },
      {
        $project: {
          amount: '$totalAmount',
          daysOverdue: {
            $divide: [
              { $subtract: [new Date(), '$dueDate'] },
              24 * 60 * 60 * 1000
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$daysOverdue',
          boundaries: [0, 30, 60, 90, 180],
          default: 'أكثر من 180 يوم',
          output: {
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      }
    ]);
    
    return {
      totalBilled: billed,
      totalCollected: collected,
      outstandingAmount: billed - collected,
      collectionRate: Math.round(collectionRate * 100) / 100,
      overdueAnalysis,
      benchmark: 95, // المعيار المقبول 95%
      status: collectionRate >= 95 ? 'Excellent' : 
              collectionRate >= 85 ? 'Good' : 'Needs Improvement'
    };
  }
  
  // تكلفة المريض الواحد
  static async calculateCostPerPatient(startDate: Date, endDate: Date) {
    // إجمالي التكاليف التشغيلية
    const operationalCosts = await Cost.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          category: { $in: ['Staff', 'Supplies', 'Utilities', 'Maintenance'] }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    // عدد المرضى المعالجين
    const uniquePatients = await Admission.distinct('patientId', {
      admissionDate: { $gte: startDate, $lte: endDate }
    });
    
    const totalCosts = operationalCosts.reduce((sum, cost) => sum + cost.total, 0);
    const costPerPatient = uniquePatients.length > 0 ? totalCosts / uniquePatients.length : 0;
    
    // تحليل التكاليف حسب القسم
    const departmentCosts = await Cost.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          department: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$department',
          totalCost: { $sum: '$amount' },
          patientCount: { $addToSet: '$patientId' }
        }
      },
      {
        $project: {
          department: '$_id',
          totalCost: 1,
          patientCount: { $size: '$patientCount' },
          costPerPatient: {
            $divide: ['$totalCost', { $size: '$patientCount' }]
          }
        }
      }
    ]);
    
    return {
      totalOperationalCosts: totalCosts,
      totalPatients: uniquePatients.length,
      costPerPatient: Math.round(costPerPatient * 100) / 100,
      costBreakdown: operationalCosts,
      departmentAnalysis: departmentCosts,
      benchmark: 5000, // المعيار المقبول 5000 ريال
      status: costPerPatient <= 5000 ? 'Good' : 'Needs Review'
    };
  }
  
  // هامش الربح
  static async calculateProfitMargin(startDate: Date, endDate: Date) {
    const revenueData = await this.calculateRevenueMetrics(startDate, endDate);
    const costData = await this.calculateCostPerPatient(startDate, endDate);
    
    const totalRevenue = revenueData.totalRevenue;
    const totalCosts = costData.totalOperationalCosts;
    const grossProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    
    // تحليل الربحية حسب الخدمة
    const serviceProfitability = [];
    for (const service of revenueData.revenueByService) {
      const serviceCosts = await Cost.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate },
            serviceType: service._id
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);
      
      const costs = serviceCosts[0]?.total || 0;
      const profit = service.revenue - costs;
      const margin = service.revenue > 0 ? (profit / service.revenue) * 100 : 0;
      
      serviceProfitability.push({
        service: service._id,
        revenue: service.revenue,
        costs,
        profit,
        margin: Math.round(margin * 100) / 100
      });
    }
    
    return {
      totalRevenue,
      totalCosts,
      grossProfit,
      profitMargin: Math.round(profitMargin * 100) / 100,
      serviceProfitability,
      benchmark: 20, // المعيار المقبول 20%
      status: profitMargin >= 20 ? 'Excellent' : 
              profitMargin >= 10 ? 'Good' : 'Needs Improvement'
    };
  }
}
```

### 4. مؤشرات الموارد البشرية

```typescript
// hr-kpis.ts
class HRKPIs {
  // معدل دوران الموظفين
  static async calculateTurnoverRate(startDate: Date, endDate: Date) {
    const totalEmployees = await Employee.countDocuments({
      startDate: { $lte: endDate },
      $or: [
        { endDate: null },
        { endDate: { $gte: startDate } }
      ]
    });
    
    const departures = await Employee.countDocuments({
      endDate: { $gte: startDate, $lte: endDate }
    });
    
    const turnoverRate = totalEmployees > 0 ? (departures / totalEmployees) * 100 : 0;
    
    // تحليل أسباب المغادرة
    const departureReasons = await Employee.aggregate([
      {
        $match: {
          endDate: { $gte: startDate, $lte: endDate },
          departureReason: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$departureReason',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // تحليل حسب القسم
    const departmentTurnover = await Employee.aggregate([
      {
        $match: {
          endDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$department',
          departures: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'employees',
          let: { dept: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$department', '$$dept'] },
                startDate: { $lte: endDate },
                $or: [
                  { endDate: null },
                  { endDate: { $gte: startDate } }
                ]
              }
            },
            { $count: 'total' }
          ],
          as: 'totalEmployees'
        }
      },
      {
        $project: {
          department: '$_id',
          departures: 1,
          totalEmployees: { $arrayElemAt: ['$totalEmployees.total', 0] },
          turnoverRate: {
            $multiply: [
              { $divide: ['$departures', { $arrayElemAt: ['$totalEmployees.total', 0] }] },
              100
            ]
          }
        }
      }
    ]);
    
    return {
      totalEmployees,
      departures,
      turnoverRate: Math.round(turnoverRate * 100) / 100,
      departureReasons,
      departmentTurnover,
      benchmark: 15, // المعيار المقبول 15%
      status: turnoverRate <= 15 ? 'Good' : 'High Turnover'
    };
  }
  
  // معدل الغياب
  static async calculateAbsenteeismRate(startDate: Date, endDate: Date) {
    const workingDays = this.calculateWorkingDays(startDate, endDate);
    const activeEmployees = await Employee.countDocuments({
      startDate: { $lte: endDate },
      $or: [
        { endDate: null },
        { endDate: { $gte: startDate } }
      ]
    });
    
    const totalWorkingDays = activeEmployees * workingDays;
    
    const absences = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          status: 'Absent'
        }
      },
      {
        $group: {
          _id: null,
          totalAbsences: { $sum: 1 }
        }
      }
    ]);
    
    const totalAbsences = absences[0]?.totalAbsences || 0;
    const absenteeismRate = totalWorkingDays > 0 ? (totalAbsences / totalWorkingDays) * 100 : 0;
    
    // تحليل أنواع الغياب
    const absenceTypes = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          status: 'Absent'
        }
      },
      {
        $group: {
          _id: '$absenceReason',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // الموظفون الأكثر غياباً
    const frequentAbsentees = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          status: 'Absent'
        }
      },
      {
        $group: {
          _id: '$employeeId',
          absences: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee'
        }
      },
      {
        $project: {
          employeeName: { $arrayElemAt: ['$employee.name', 0] },
          department: { $arrayElemAt: ['$employee.department', 0] },
          absences: 1,
          absenteeismRate: {
            $multiply: [
              { $divide: ['$absences', workingDays] },
              100
            ]
          }
        }
      },
      {
        $sort: { absences: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    return {
      totalWorkingDays,
      totalAbsences,
      absenteeismRate: Math.round(absenteeismRate * 100) / 100,
      absenceTypes,
      frequentAbsentees,
      benchmark: 5, // المعيار المقبول 5%
      status: absenteeismRate <= 5 ? 'Good' : 'High Absenteeism'
    };
  }
  
  // رضا الموظفين
  static async calculateEmployeeSatisfaction(startDate: Date, endDate: Date) {
    const surveys = await EmployeeSurvey.find({
      submittedAt: { $gte: startDate, $lte: endDate }
    });
    
    if (surveys.length === 0) {
      return {
        averageRating: 0,
        totalResponses: 0,
        responseRate: 0,
        satisfactionAreas: {},
        status: 'No Data'
      };
    }
    
    const totalEmployees = await Employee.countDocuments({
      startDate: { $lte: endDate },
      $or: [
        { endDate: null },
        { endDate: { $gte: startDate } }
      ]
    });
    
    const responseRate = (surveys.length / totalEmployees) * 100;
    
    // حساب متوسط الرضا العام
    const totalSatisfaction = surveys.reduce((sum, survey) => sum + survey.overallSatisfaction, 0);
    const averageRating = totalSatisfaction / surveys.length;
    
    // تحليل مجالات الرضا
    const satisfactionAreas = {
      workEnvironment: surveys.reduce((sum, s) => sum + s.workEnvironment, 0) / surveys.length,
      management: surveys.reduce((sum, s) => sum + s.management, 0) / surveys.length,
      compensation: surveys.reduce((sum, s) => sum + s.compensation, 0) / surveys.length,
      workLifeBalance: surveys.reduce((sum, s) => sum + s.workLifeBalance, 0) / surveys.length,
      careerDevelopment: surveys.reduce((sum, s) => sum + s.careerDevelopment, 0) / surveys.length
    };
    
    // تحليل حسب القسم
    const departmentSatisfaction = {};
    surveys.forEach(survey => {
      const dept = survey.department;
      if (!departmentSatisfaction[dept]) {
        departmentSatisfaction[dept] = { total: 0, count: 0 };
      }
      departmentSatisfaction[dept].total += survey.overallSatisfaction;
      departmentSatisfaction[dept].count += 1;
    });
    
    Object.keys(departmentSatisfaction).forEach(dept => {
      const data = departmentSatisfaction[dept];
      data.average = Math.round((data.total / data.count) * 100) / 100;
    });
    
    return {
      averageRating: Math.round(averageRating * 100) / 100,
      totalResponses: surveys.length,
      responseRate: Math.round(responseRate * 100) / 100,
      satisfactionAreas,
      departmentSatisfaction,
      benchmark: 4.0, // المعيار المقبول 4.0/5.0
      status: averageRating >= 4.0 ? 'Excellent' : 
              averageRating >= 3.5 ? 'Good' : 'Needs Improvement'
    };
  }
  
  // إنتاجية الموظفين
  static async calculateEmployeeProductivity(startDate: Date, endDate: Date) {
    // عدد المرضى المعالجين لكل طبيب
    const doctorProductivity = await Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: startDate, $lte: endDate },
          status: 'Completed'
        }
      },
      {
        $group: {
          _id: '$doctorId',
          totalAppointments: { $sum: 1 },
          uniquePatients: { $addToSet: '$patientId' }
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'doctor'
        }
      },
      {
        $project: {
          doctorName: { $arrayElemAt: ['$doctor.name', 0] },
          specialty: { $arrayElemAt: ['$doctor.specialty', 0] },
          totalAppointments: 1,
          uniquePatients: { $size: '$uniquePatients' },
          avgAppointmentsPerDay: {
            $divide: [
              '$totalAppointments',
              { $divide: [{ $subtract: [endDate, startDate] }, 24 * 60 * 60 * 1000] }
            ]
          }
        }
      },
      {
        $sort: { totalAppointments: -1 }
      }
    ]);
    
    // إنتاجية الممرضين (عدد المرضى المتابعين)
    const nurseProductivity = await PatientCare.aggregate([
      {
        $match: {
          careDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$nurseId',
          totalCareActivities: { $sum: 1 },
          uniquePatients: { $addToSet: '$patientId' }
        }
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'nurse'
        }
      },
      {
        $project: {
          nurseName: { $arrayElemAt: ['$nurse.name', 0] },
          department: { $arrayElemAt: ['$nurse.department', 0] },
          totalCareActivities: 1,
          uniquePatients: { $size: '$uniquePatients' },
          avgActivitiesPerDay: {
            $divide: [
              '$totalCareActivities',
              { $divide: [{ $subtract: [endDate, startDate] }, 24 * 60 * 60 * 1000] }
            ]
          }
        }
      },
      {
        $sort: { totalCareActivities: -1 }
      }
    ]);
    
    return {
      doctorProductivity,
      nurseProductivity,
      period: {
        startDate,
        endDate,
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
      }
    };
  }
}
```

---

## لوحة مراقبة الجودة

### 1. لوحة المراقبة الرئيسية

```typescript
// quality-dashboard.ts
class QualityDashboard {
  // إنشاء لوحة المراقبة الشاملة
  static async generateComprehensiveDashboard(startDate: Date, endDate: Date) {
    const dashboard = {
      period: { startDate, endDate },
      timestamp: new Date(),
      
      // مؤشرات الجودة الطبية
      medicalQuality: {
        patientSatisfaction: await MedicalQualityKPIs.calculatePatientSatisfaction(startDate, endDate),
        readmissionRate: await MedicalQualityKPIs.calculateReadmissionRate(startDate, endDate),
        haiRate: await MedicalQualityKPIs.calculateHAIRate(startDate, endDate),
        averageLOS: await MedicalQualityKPIs.calculateAverageLengthOfStay(startDate, endDate),
        mortalityRate: await MedicalQualityKPIs.calculateMortalityRate(startDate, endDate)
      },
      
      // مؤشرات الكفاءة التشغيلية
      operationalEfficiency: {
        bedOccupancy: await OperationalEfficiencyKPIs.calculateBedOccupancyRate(startDate, endDate),
        waitTime: await OperationalEfficiencyKPIs.calculateAverageWaitTime(startDate, endDate),
        cancellationRate: await OperationalEfficiencyKPIs.calculateAppointmentCancellationRate(startDate, endDate),
        orEfficiency: await OperationalEfficiencyKPIs.calculateOREfficiency(startDate, endDate)
      },
      
      // مؤشرات الأداء المالي
      financial: {
        revenue: await FinancialKPIs.calculateRevenueMetrics(startDate, endDate),
        collection: await FinancialKPIs.calculateCollectionRate(startDate, endDate),
        costPerPatient: await FinancialKPIs.calculateCostPerPatient(startDate, endDate),
        profitMargin: await FinancialKPIs.calculateProfitMargin(startDate, endDate)
      },
      
      // مؤشرات الموارد البشرية
      humanResources: {
        turnover: await HRKPIs.calculateTurnoverRate(startDate, endDate),
        absenteeism: await HRKPIs.calculateAbsenteeismRate(startDate, endDate),
        satisfaction: await HRKPIs.calculateEmployeeSatisfaction(startDate, endDate),
        productivity: await HRKPIs.calculateEmployeeProductivity(startDate, endDate)
      }
    };
    
    // حساب النقاط الإجمالية
    dashboard.overallScore = this.calculateOverallScore(dashboard);
    
    // تحديد المجالات التي تحتاج تحسين
    dashboard.improvementAreas = this.identifyImprovementAreas(dashboard);
    
    // التوصيات
    dashboard.recommendations = this.generateRecommendations(dashboard);
    
    // حفظ لوحة المراقبة
    await QualityDashboard.create(dashboard);
    
    return dashboard;
  }
  
  // حساب النقاط الإجمالية
  static calculateOverallScore(dashboard: any): number {
    const scores = [];
    
    // نقاط الجودة الطبية (40%)
    const medicalScore = this.calculateCategoryScore(dashboard.medicalQuality, {
      patientSatisfaction: { weight: 0.3, target: 4.5, current: dashboard.medicalQuality.patientSatisfaction.averageRating },
      readmissionRate: { weight: 0.2, target: 15, current: dashboard.medicalQuality.readmissionRate.readmissionRate, inverse: true },
      haiRate: { weight: 0.2, target: 5, current: dashboard.medicalQuality.haiRate.haiRate, inverse: true },
      averageLOS: { weight: 0.15, target: 7, current: dashboard.medicalQuality.averageLOS.overallAverage, inverse: true },
      mortalityRate: { weight: 0.15, target: 2, current: dashboard.medicalQuality.mortalityRate.mortalityRate, inverse: true }
    });
    scores.push({ category: 'Medical Quality', score: medicalScore, weight: 0.4 });
    
    // نقاط الكفاءة التشغيلية (30%)
    const operationalScore = this.calculateCategoryScore(dashboard.operationalEfficiency, {
      bedOccupancy: { weight: 0.3, target: 85, current: dashboard.operationalEfficiency.bedOccupancy.occupancyRate },
      waitTime: { weight: 0.3, target: 15, current: dashboard.operationalEfficiency.waitTime.averageWaitMinutes, inverse: true },
      cancellationRate: { weight: 0.2, target: 10, current: dashboard.operationalEfficiency.cancellationRate.cancellationRate, inverse: true },
      orEfficiency: { weight: 0.2, target: 90, current: dashboard.operationalEfficiency.orEfficiency.timeEfficiency }
    });
    scores.push({ category: 'Operational Efficiency', score: operationalScore, weight: 0.3 });
    
    // نقاط الأداء المالي (20%)
    const financialScore = this.calculateCategoryScore(dashboard.financial, {
      collectionRate: { weight: 0.4, target: 95, current: dashboard.financial.collection.collectionRate },
      profitMargin: { weight: 0.4, target: 20, current: dashboard.financial.profitMargin.profitMargin },
      costPerPatient: { weight: 0.2, target: 5000, current: dashboard.financial.costPerPatient.costPerPatient, inverse: true }
    });
    scores.push({ category: 'Financial Performance', score: financialScore, weight: 0.2 });
    
    // نقاط الموارد البشرية (10%)
    const hrScore = this.calculateCategoryScore(dashboard.humanResources, {
      turnover: { weight: 0.3, target: 15, current: dashboard.humanResources.turnover.turnoverRate, inverse: true },
      absenteeism: { weight: 0.3, target: 5, current: dashboard.humanResources.absenteeism.absenteeismRate, inverse: true },
      satisfaction: { weight: 0.4, target: 4.0, current: dashboard.humanResources.satisfaction.averageRating }
    });
    scores.push({ category: 'Human Resources', score: hrScore, weight: 0.1 });
    
    // حساب النقاط الإجمالية المرجحة
    const overallScore = scores.reduce((total, item) => total + (item.score * item.weight), 0);
    
    return Math.round(overallScore * 100) / 100;
  }
  
  // تحديد المجالات التي تحتاج تحسين
  static identifyImprovementAreas(dashboard: any): string[] {
    const areas = [];
    
    // فحص مؤشرات الجودة الطبية
    if (dashboard.medicalQuality.patientSatisfaction.averageRating < 4.0) {
      areas.push('رضا المرضى');
    }
    if (dashboard.medicalQuality.readmissionRate.readmissionRate > 15) {
      areas.push('معدل إعادة الدخول');
    }
    if (dashboard.medicalQuality.haiRate.haiRate > 5) {
      areas.push('العدوى المكتسبة في المستشفى');
    }
    
    // فحص الكفاءة التشغيلية
    if (dashboard.operationalEfficiency.waitTime.averageWaitMinutes > 30) {
      areas.push('أوقات الانتظار');
    }
    if (dashboard.operationalEfficiency.cancellationRate.cancellationRate > 10) {
      areas.push('إلغاء المواعيد');
    }
    
    // فحص الأداء المالي
    if (dashboard.financial.collection.collectionRate < 85) {
      areas.push('تحصيل الديون');
    }
    if (dashboard.financial.profitMargin.profitMargin < 10) {
      areas.push('هامش الربح');
    }
    
    // فحص الموارد البشرية
    if (dashboard.humanResources.turnover.turnoverRate > 15) {
      areas.push('دوران الموظفين');
    }
    if (dashboard.humanResources.absenteeism.absenteeismRate > 5) {
      areas.push('غياب الموظفين');
    }
    
    return areas;
  }
  
  // إنشاء التوصيات
  static generateRecommendations(dashboard: any): string[] {
    const recommendations = [];
    const improvementAreas = this.identifyImprovementAreas(dashboard);
    
    if (improvementAreas.includes('رضا المرضى')) {
      recommendations.push('تحسين تجربة المريض من خلال تدريب الموظفين على خدمة العملاء');
      recommendations.push('تقليل أوقات الانتظار وتحسين التواصل مع المرضى');
    }
    
    if (improvementAreas.includes('معدل إعادة الدخول')) {
      recommendations.push('تحسين خطط الخروج ومتابعة المرضى بعد الخروج');
      recommendations.push('تعزيز التنسيق بين الأقسام المختلفة');
    }
    
    if (improvementAreas.includes('العدوى المكتسبة في المستشفى')) {
      recommendations.push('تعزيز إجراءات مكافحة العدوى والتعقيم');
      recommendations.push('زيادة التدريب على النظافة الصحية');
    }
    
    if (improvementAreas.includes('أوقات الانتظار')) {
      recommendations.push('تحسين جدولة المواعيد وإدارة تدفق المرضى');
      recommendations.push('زيادة عدد الموظفين في أوقات الذروة');
    }
    
    if (improvementAreas.includes('تحصيل الديون')) {
      recommendations.push('تحسين عمليات الفوترة والتحصيل');
      recommendations.push('تطبيق سياسات دفع أكثر مرونة');
    }
    
    if (improvementAreas.includes('دوران الموظفين')) {
      recommendations.push('تحسين بيئة العمل وحوافز الموظفين');
      recommendations.push('تطوير برامج التطوير المهني والترقية');
    }
    
    return recommendations;
  }
  
  // تقرير الجودة الشهري
  static async generateMonthlyQualityReport(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const dashboard = await this.generateComprehensiveDashboard(startDate, endDate);
    
    // مقارنة بالشهر السابق
    const previousMonth = month === 1 ? 12 : month - 1;
    const previousYear = month === 1 ? year - 1 : year;
    const previousStartDate = new Date(previousYear, previousMonth - 1, 1);
    const previousEndDate = new Date(previousYear, previousMonth, 0);
    
    const previousDashboard = await QualityDashboard.findOne({
      'period.startDate': previousStartDate,
      'period.endDate': previousEndDate
    });
    
    const report = {
      period: `${year}-${month.toString().padStart(2, '0')}`,
      currentMetrics: dashboard,
      previousMetrics: previousDashboard,
      trends: previousDashboard ? this.calculateTrends(dashboard, previousDashboard) : null,
      achievements: this.identifyAchievements(dashboard),
      challenges: this.identifyChallenges(dashboard),
      actionPlan: this.createActionPlan(dashboard)
    };
    
    // حفظ التقرير
    await QualityReport.create(report);
    
    return report;
  }
}
```

---

## إدارة التحسين المستمر

### 1. دورة التحسين المستمر

```typescript
// continuous-improvement.ts
class ContinuousImprovement {
  // تحديد فرص التحسين
  static async identifyImprovementOpportunities() {
    const opportunities = [];
    
    // تحليل البيانات التاريخية
    const last6Months = new Date();
    last6Months.setMonth(last6Months.getMonth() - 6);
    
    const historicalData = await QualityDashboard.find({
      'period.startDate': { $gte: last6Months }
    }).sort({ 'period.startDate': 1 });
    
    // تحليل الاتجاهات
    const trends = this.analyzeTrends(historicalData);
    
    // تحديد المؤشرات المتدهورة
    for (const [metric, trend] of Object.entries(trends)) {
      if (trend.direction === 'declining' && trend.significance > 0.05) {
        opportunities.push({
          type: 'Performance Decline',
          metric,
          description: `تدهور في ${metric}`,
          priority: this.calculatePriority(metric, trend),
          suggestedActions: this.suggestActions(metric, trend)
        });
      }
    }
    
    // تحليل المقارنات المعيارية
    const benchmarkAnalysis = await this.compareToBenchmarks();
    for (const [metric, comparison] of Object.entries(benchmarkAnalysis)) {
      if (comparison.gap > 10) { // فجوة أكبر من 10%
        opportunities.push({
          type: 'Benchmark Gap',
          metric,
          description: `فجوة في الأداء مقارنة بالمعايير`,
          priority: 'High',
          gap: comparison.gap,
          suggestedActions: this.suggestBenchmarkActions(metric, comparison)
        });
      }
    }
    
    // تحليل شكاوى المرضى
    const patientComplaints = await this.analyzePatientComplaints();
    for (const complaint of patientComplaints.topIssues) {
      if (complaint.frequency > 5) { // أكثر من 5 شكاوى
        opportunities.push({
          type: 'Patient Complaint',
          metric: 'Patient Satisfaction',
          description: complaint.issue,
          priority: 'Medium',
          frequency: complaint.frequency,
          suggestedActions: this.suggestComplaintActions(complaint)
        });
      }
    }
    
    return opportunities;
  }
  
  // إنشاء مشروع تحسين
  static async createImprovementProject(opportunity: any) {
    const project = {
      title: `تحسين ${opportunity.metric}`,
      description: opportunity.description,
      type: opportunity.type,
      priority: opportunity.priority,
      status: 'Planning',
      startDate: new Date(),
      targetCompletionDate: this.calculateTargetDate(opportunity.priority),
      
      // أهداف المشروع
      objectives: this.defineObjectives(opportunity),
      
      // مؤشرات النجاح
      successMetrics: this.defineSuccessMetrics(opportunity),
      
      // خطة العمل
      actionPlan: this.createDetailedActionPlan(opportunity),
      
      // الموارد المطلوبة
      requiredResources: this.estimateResources(opportunity),
      
      // فريق المشروع
      team: await this.assignProjectTeam(opportunity),
      
      // المخاطر المحتملة
      risks: this.identifyProjectRisks(opportunity),
      
      // الجدول الزمني
      timeline: this.createProjectTimeline(opportunity)
    };
    
    // حفظ المشروع
    const savedProject = await ImprovementProject.create(project);
    
    // إشعار فريق المشروع