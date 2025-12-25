import { query, queryOne, queryMany, buildSelectQuery, buildInsertQuery, buildUpdateQuery, buildDeleteQuery } from '@/utils/database';
import { PAYMENT_STATUS, PAYMENT_METHODS, BILL_TYPES } from '@/utils/constants';
import { generateBillNumber } from '@/utils/helpers';

export interface Bill {
  id: string;
  bill_number: string;
  patient_id: string;
  appointment_id?: string;
  bill_type: string;
  description: string;
  items: BillItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  due_date: Date;
  status: string;
  payment_terms?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface BillItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string; // consultation, medication, lab_test, imaging, procedure, room_charge, etc.
  service_code?: string;
  tax_rate?: number;
  discount_rate?: number;
}

export interface Payment {
  id: string;
  payment_id: string;
  bill_id: string;
  patient_id: string;
  amount: number;
  payment_method: string;
  payment_date: Date;
  transaction_id?: string;
  reference_number?: string;
  status: string;
  notes?: string;
  processed_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateBillData {
  patient_id: string;
  appointment_id?: string;
  bill_type: string;
  description: string;
  items: Omit<BillItem, 'id'>[];
  tax_rate?: number;
  discount_amount?: number;
  due_date: Date;
  payment_terms?: string;
  notes?: string;
  created_by?: string;
}

export interface UpdateBillData {
  description?: string;
  items?: Omit<BillItem, 'id'>[];
  tax_rate?: number;
  discount_amount?: number;
  due_date?: Date;
  payment_terms?: string;
  notes?: string;
  updated_by?: string;
}

export interface CreatePaymentData {
  bill_id: string;
  patient_id: string;
  amount: number;
  payment_method: string;
  payment_date: Date;
  transaction_id?: string;
  reference_number?: string;
  notes?: string;
  processed_by?: string;
}

export interface BillFilters {
  patient_id?: string;
  bill_type?: string;
  status?: string;
  date_from?: Date;
  date_to?: Date;
  amount_min?: number;
  amount_max?: number;
  overdue?: boolean;
  search?: string;
}

export interface PaymentFilters {
  patient_id?: string;
  bill_id?: string;
  payment_method?: string;
  status?: string;
  date_from?: Date;
  date_to?: Date;
  amount_min?: number;
  amount_max?: number;
  search?: string;
}

export class BillingModel {
  private static billTableName = 'bills';
  private static paymentTableName = 'payments';

  /**
   * Create a new bill
   */
  static async createBill(billData: CreateBillData): Promise<Bill> {
    const billNumber = generateBillNumber();
    
    // Calculate totals
    const subtotal = billData.items.reduce((sum, item) => sum + item.total_price, 0);
    const taxRate = billData.tax_rate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const discountAmount = billData.discount_amount || 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    const data = {
      bill_number: billNumber,
      patient_id: billData.patient_id,
      appointment_id: billData.appointment_id,
      bill_type: billData.bill_type,
      description: billData.description,
      items: JSON.stringify(billData.items),
      subtotal,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      amount_paid: 0,
      amount_due: totalAmount,
      due_date: billData.due_date,
      status: PAYMENT_STATUS.PENDING,
      payment_terms: billData.payment_terms,
      notes: billData.notes,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: billData.created_by,
    };

    const { query: insertQuery, values } = buildInsertQuery(this.billTableName, data);
    const result = await queryOne<Bill>(insertQuery, values);
    
    if (!result) {
      throw new Error('Failed to create bill');
    }

    return this.parseBillJsonFields(result);
  }

  /**
   * Find bill by ID
   */
  static async findBillById(id: string): Promise<Bill | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.billTableName,
      ['*'],
      { id }
    );
    
    const result = await queryOne<Bill>(selectQuery, values);
    return result ? this.parseBillJsonFields(result) : null;
  }

  /**
   * Find bill by bill number
   */
  static async findBillByNumber(billNumber: string): Promise<Bill | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.billTableName,
      ['*'],
      { bill_number: billNumber }
    );
    
    const result = await queryOne<Bill>(selectQuery, values);
    return result ? this.parseBillJsonFields(result) : null;
  }

  /**
   * Find bills with filters and pagination
   */
  static async findBills(
    filters: BillFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ bills: Bill[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.patient_id) {
      whereClause += ` AND patient_id = $${paramIndex++}`;
      values.push(filters.patient_id);
    }

    if (filters.bill_type) {
      whereClause += ` AND bill_type = $${paramIndex++}`;
      values.push(filters.bill_type);
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.date_from) {
      whereClause += ` AND created_at >= $${paramIndex++}`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      whereClause += ` AND created_at <= $${paramIndex++}`;
      values.push(filters.date_to);
    }

    if (filters.amount_min !== undefined) {
      whereClause += ` AND total_amount >= $${paramIndex++}`;
      values.push(filters.amount_min);
    }

    if (filters.amount_max !== undefined) {
      whereClause += ` AND total_amount <= $${paramIndex++}`;
      values.push(filters.amount_max);
    }

    if (filters.overdue) {
      whereClause += ` AND due_date < CURRENT_DATE AND status != '${BILL_STATUS.PAID}'`;
    }

    if (filters.search) {
      whereClause += ` AND (
        bill_number ILIKE $${paramIndex} OR 
        description ILIKE $${paramIndex} OR
        notes ILIKE $${paramIndex}
      )`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const orderBy = `ORDER BY ${sortBy} ${sortOrder}`;
    const limitClause = `LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const selectQuery = `
      SELECT * FROM ${this.billTableName}
      ${whereClause}
      ${orderBy}
      ${limitClause}
    `;

    const bills = await queryMany<Bill>(selectQuery, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.billTableName}
      ${whereClause}
    `;
    
    const countResult = await queryOne<{ total: string }>(countQuery, values.slice(0, -2));
    const total = parseInt(countResult?.total || '0', 10);

    return {
      bills: bills.map(bill => this.parseBillJsonFields(bill)),
      total
    };
  }

  /**
   * Update bill
   */
  static async updateBill(id: string, updateData: UpdateBillData): Promise<Bill | null> {
    const currentBill = await this.findBillById(id);
    if (!currentBill) {
      throw new Error('Bill not found');
    }

    const data: Record<string, any> = {
      ...updateData,
      updated_at: new Date(),
    };

    // Recalculate totals if items are updated
    if (updateData.items) {
      const subtotal = updateData.items.reduce((sum, item) => sum + item.total_price, 0);
      const taxRate = updateData.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const discountAmount = updateData.discount_amount || 0;
      const totalAmount = subtotal + taxAmount - discountAmount;

      data.items = JSON.stringify(updateData.items);
      data.subtotal = subtotal;
      data.tax_amount = taxAmount;
      data.discount_amount = discountAmount;
      data.total_amount = totalAmount;
      data.amount_due = totalAmount - currentBill.amount_paid;
    }

    const { query: updateQuery, values } = buildUpdateQuery(
      this.billTableName,
      data,
      { id }
    );

    const result = await queryOne<Bill>(updateQuery, values);
    return result ? this.parseBillJsonFields(result) : null;
  }

  /**
   * Create a payment
   */
  static async createPayment(paymentData: CreatePaymentData): Promise<Payment> {
    const bill = await this.findBillById(paymentData.bill_id);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (paymentData.amount > bill.amount_due) {
      throw new Error('Payment amount cannot exceed amount due');
    }

    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const data = {
      payment_id: paymentId,
      bill_id: paymentData.bill_id,
      patient_id: paymentData.patient_id,
      amount: paymentData.amount,
      payment_method: paymentData.payment_method,
      payment_date: paymentData.payment_date,
      transaction_id: paymentData.transaction_id,
      reference_number: paymentData.reference_number,
      status: PAYMENT_STATUS.COMPLETED,
      notes: paymentData.notes,
      processed_by: paymentData.processed_by,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const { query: insertQuery, values } = buildInsertQuery(this.paymentTableName, data);
    const payment = await queryOne<Payment>(insertQuery, values);
    
    if (!payment) {
      throw new Error('Failed to create payment');
    }

    // Update bill amounts
    const newAmountPaid = bill.amount_paid + paymentData.amount;
    const newAmountDue = bill.total_amount - newAmountPaid;
    const newStatus = newAmountDue <= 0 ? BILL_STATUS.PAID : 
                     newAmountPaid > 0 ? BILL_STATUS.PARTIALLY_PAID : BILL_STATUS.PENDING;

    await this.updateBillPaymentStatus(paymentData.bill_id, newAmountPaid, newAmountDue, newStatus);

    return payment;
  }

  /**
   * Find payment by ID
   */
  static async findPaymentById(id: string): Promise<Payment | null> {
    const { query: selectQuery, values } = buildSelectQuery(
      this.paymentTableName,
      ['*'],
      { id }
    );
    
    return await queryOne<Payment>(selectQuery, values);
  }

  /**
   * Find payments with filters and pagination
   */
  static async findPayments(
    filters: PaymentFilters = {},
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ payments: Payment[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.patient_id) {
      whereClause += ` AND patient_id = $${paramIndex++}`;
      values.push(filters.patient_id);
    }

    if (filters.bill_id) {
      whereClause += ` AND bill_id = $${paramIndex++}`;
      values.push(filters.bill_id);
    }

    if (filters.payment_method) {
      whereClause += ` AND payment_method = $${paramIndex++}`;
      values.push(filters.payment_method);
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.date_from) {
      whereClause += ` AND payment_date >= $${paramIndex++}`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      whereClause += ` AND payment_date <= $${paramIndex++}`;
      values.push(filters.date_to);
    }

    if (filters.amount_min !== undefined) {
      whereClause += ` AND amount >= $${paramIndex++}`;
      values.push(filters.amount_min);
    }

    if (filters.amount_max !== undefined) {
      whereClause += ` AND amount <= $${paramIndex++}`;
      values.push(filters.amount_max);
    }

    if (filters.search) {
      whereClause += ` AND (
        payment_id ILIKE $${paramIndex} OR 
        transaction_id ILIKE $${paramIndex} OR
        reference_number ILIKE $${paramIndex} OR
        notes ILIKE $${paramIndex}
      )`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const orderBy = `ORDER BY ${sortBy} ${sortOrder}`;
    const limitClause = `LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const selectQuery = `
      SELECT * FROM ${this.paymentTableName}
      ${whereClause}
      ${orderBy}
      ${limitClause}
    `;

    const payments = await queryMany<Payment>(selectQuery, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM ${this.paymentTableName}
      ${whereClause}
    `;
    
    const countResult = await queryOne<{ total: string }>(countQuery, values.slice(0, -2));
    const total = parseInt(countResult?.total || '0', 10);

    return {
      payments,
      total
    };
  }

  /**
   * Get overdue bills
   */
  static async getOverdueBills(): Promise<Bill[]> {
    const selectQuery = `
      SELECT * FROM ${this.billTableName}
      WHERE due_date < CURRENT_DATE 
        AND status != '${BILL_STATUS.PAID}'
        AND status != '${BILL_STATUS.CANCELLED}'
      ORDER BY due_date ASC
    `;

    const bills = await queryMany<Bill>(selectQuery);
    return bills.map(bill => this.parseBillJsonFields(bill));
  }

  /**
   * Get patient billing summary
   */
  static async getPatientBillingSummary(patientId: string): Promise<{
    totalBilled: number;
    totalPaid: number;
    totalDue: number;
    billCount: number;
    paymentCount: number;
    overdueBills: number;
  }> {
    const summaryQuery = `
      SELECT 
        COUNT(*) as bill_count,
        SUM(total_amount) as total_billed,
        SUM(amount_paid) as total_paid,
        SUM(amount_due) as total_due,
        COUNT(CASE WHEN due_date < CURRENT_DATE AND status != '${BILL_STATUS.PAID}' THEN 1 END) as overdue_bills
      FROM ${this.billTableName}
      WHERE patient_id = $1
    `;

    const paymentCountQuery = `
      SELECT COUNT(*) as payment_count
      FROM ${this.paymentTableName}
      WHERE patient_id = $1
    `;

    const [summary, paymentCount] = await Promise.all([
      queryOne<{
        bill_count: string;
        total_billed: string;
        total_paid: string;
        total_due: string;
        overdue_bills: string;
      }>(summaryQuery, [patientId]),
      queryOne<{ payment_count: string }>(paymentCountQuery, [patientId]),
    ]);

    return {
      totalBilled: parseFloat(summary?.total_billed || '0'),
      totalPaid: parseFloat(summary?.total_paid || '0'),
      totalDue: parseFloat(summary?.total_due || '0'),
      billCount: parseInt(summary?.bill_count || '0', 10),
      paymentCount: parseInt(paymentCount?.payment_count || '0', 10),
      overdueBills: parseInt(summary?.overdue_bills || '0', 10),
    };
  }

  /**
   * Get billing statistics
   */
  static async getBillingStatistics(): Promise<{
    totalRevenue: number;
    totalOutstanding: number;
    totalOverdue: number;
    billCount: number;
    paymentCount: number;
    averageBillAmount: number;
    averagePaymentAmount: number;
    byBillType: Record<string, number>;
    byPaymentMethod: Record<string, number>;
    monthlyRevenue: { month: string; revenue: number }[];
  }> {
    const billStatsQuery = `
      SELECT 
        COUNT(*) as bill_count,
        SUM(total_amount) as total_billed,
        SUM(amount_due) as total_outstanding,
        SUM(CASE WHEN due_date < CURRENT_DATE AND status != '${BILL_STATUS.PAID}' THEN amount_due ELSE 0 END) as total_overdue,
        AVG(total_amount) as average_bill_amount
      FROM ${this.billTableName}
    `;

    const paymentStatsQuery = `
      SELECT 
        COUNT(*) as payment_count,
        SUM(amount) as total_revenue,
        AVG(amount) as average_payment_amount
      FROM ${this.paymentTableName}
      WHERE status = '${PAYMENT_STATUS.COMPLETED}'
    `;

    const billTypeStatsQuery = `
      SELECT bill_type, SUM(total_amount) as total
      FROM ${this.billTableName}
      GROUP BY bill_type
    `;

    const paymentMethodStatsQuery = `
      SELECT payment_method, SUM(amount) as total
      FROM ${this.paymentTableName}
      WHERE status = '${PAYMENT_STATUS.COMPLETED}'
      GROUP BY payment_method
    `;

    const monthlyRevenueQuery = `
      SELECT 
        TO_CHAR(payment_date, 'YYYY-MM') as month,
        SUM(amount) as revenue
      FROM ${this.paymentTableName}
      WHERE status = '${PAYMENT_STATUS.COMPLETED}'
        AND payment_date >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
      ORDER BY month
    `;

    const [billStats, paymentStats, billTypeStats, paymentMethodStats, monthlyRevenue] = await Promise.all([
      queryOne<{
        bill_count: string;
        total_billed: string;
        total_outstanding: string;
        total_overdue: string;
        average_bill_amount: string;
      }>(billStatsQuery),
      queryOne<{
        payment_count: string;
        total_revenue: string;
        average_payment_amount: string;
      }>(paymentStatsQuery),
      queryMany<{ bill_type: string; total: string }>(billTypeStatsQuery),
      queryMany<{ payment_method: string; total: string }>(paymentMethodStatsQuery),
      queryMany<{ month: string; revenue: string }>(monthlyRevenueQuery),
    ]);

    const byBillType = billTypeStats.reduce((acc, item) => {
      acc[item.bill_type] = parseFloat(item.total);
      return acc;
    }, {} as Record<string, number>);

    const byPaymentMethod = paymentMethodStats.reduce((acc, item) => {
      acc[item.payment_method] = parseFloat(item.total);
      return acc;
    }, {} as Record<string, number>);

    const monthlyRevenueData = monthlyRevenue.map(item => ({
      month: item.month,
      revenue: parseFloat(item.revenue),
    }));

    return {
      totalRevenue: parseFloat(paymentStats?.total_revenue || '0'),
      totalOutstanding: parseFloat(billStats?.total_outstanding || '0'),
      totalOverdue: parseFloat(billStats?.total_overdue || '0'),
      billCount: parseInt(billStats?.bill_count || '0', 10),
      paymentCount: parseInt(paymentStats?.payment_count || '0', 10),
      averageBillAmount: parseFloat(billStats?.average_bill_amount || '0'),
      averagePaymentAmount: parseFloat(paymentStats?.average_payment_amount || '0'),
      byBillType,
      byPaymentMethod,
      monthlyRevenue: monthlyRevenueData,
    };
  }

  /**
   * Cancel bill
   */
  static async cancelBill(id: string, reason: string, cancelledBy: string): Promise<Bill | null> {
    const data = {
      status: BILL_STATUS.CANCELLED,
      notes: reason,
      updated_at: new Date(),
      updated_by: cancelledBy,
    };

    const { query: updateQuery, values } = buildUpdateQuery(
      this.billTableName,
      data,
      { id }
    );

    const result = await queryOne<Bill>(updateQuery, values);
    return result ? this.parseBillJsonFields(result) : null;
  }

  /**
   * Refund payment
   */
  static async refundPayment(
    paymentId: string,
    refundAmount: number,
    reason: string,
    processedBy: string
  ): Promise<Payment> {
    const payment = await this.findPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (refundAmount > payment.amount) {
      throw new Error('Refund amount cannot exceed payment amount');
    }

    const refundPaymentId = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const data = {
      payment_id: refundPaymentId,
      bill_id: payment.bill_id,
      patient_id: payment.patient_id,
      amount: -refundAmount, // Negative amount for refund
      payment_method: payment.payment_method,
      payment_date: new Date(),
      reference_number: `REFUND-${payment.payment_id}`,
      status: PAYMENT_STATUS.REFUNDED,
      notes: `Refund for payment ${payment.payment_id}: ${reason}`,
      processed_by: processedBy,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const { query: insertQuery, values } = buildInsertQuery(this.paymentTableName, data);
    const refund = await queryOne<Payment>(insertQuery, values);
    
    if (!refund) {
      throw new Error('Failed to create refund');
    }

    // Update original payment status
    await this.updatePaymentStatus(paymentId, PAYMENT_STATUS.REFUNDED);

    // Update bill amounts
    const bill = await this.findBillById(payment.bill_id);
    if (bill) {
      const newAmountPaid = bill.amount_paid - refundAmount;
      const newAmountDue = bill.total_amount - newAmountPaid;
      const newStatus = newAmountDue <= 0 ? BILL_STATUS.PAID : 
                       newAmountPaid > 0 ? BILL_STATUS.PARTIALLY_PAID : BILL_STATUS.PENDING;

      await this.updateBillPaymentStatus(payment.bill_id, newAmountPaid, newAmountDue, newStatus);
    }

    return refund;
  }

  /**
   * Update bill payment status
   */
  private static async updateBillPaymentStatus(
    billId: string,
    amountPaid: number,
    amountDue: number,
    status: string
  ): Promise<void> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.billTableName,
      {
        amount_paid: amountPaid,
        amount_due: amountDue,
        status,
        updated_at: new Date(),
      },
      { id: billId }
    );

    await queryOne(updateQuery, values);
  }

  /**
   * Update payment status
   */
  private static async updatePaymentStatus(paymentId: string, status: string): Promise<void> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.paymentTableName,
      {
        status,
        updated_at: new Date(),
      },
      { id: paymentId }
    );

    await queryOne(updateQuery, values);
  }

  /**
   * Delete bill (soft delete by setting status to cancelled)
   */
  static async deleteBill(id: string): Promise<boolean> {
    const { query: updateQuery, values } = buildUpdateQuery(
      this.billTableName,
      {
        status: BILL_STATUS.CANCELLED,
        updated_at: new Date(),
      },
      { id }
    );

    const result = await queryOne(updateQuery, values);
    return !!result;
  }

  /**
   * Hard delete bill (permanent deletion)
   */
  static async hardDeleteBill(id: string): Promise<boolean> {
    const { query: deleteQuery, values } = buildDeleteQuery(
      this.billTableName,
      { id }
    );

    const result = await query(deleteQuery, values);
    return result.rowCount > 0;
  }

  /**
   * Parse JSON fields from bill database result
   */
  private static parseBillJsonFields(bill: Bill): Bill {
    return {
      ...bill,
      items: this.parseBillItems(bill.items),
    };
  }

  /**
   * Parse bill items JSON field
   */
  private static parseBillItems(field: any): BillItem[] {
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return [];
      }
    }
    return Array.isArray(field) ? field : [];
  }
}