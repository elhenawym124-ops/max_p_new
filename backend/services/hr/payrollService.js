/**
 * 💰 Payroll Service
 * خدمة إدارة الرواتب
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class PayrollService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إنشاء كشف راتب
   */
  async createPayroll(companyId, employeeId, data) {
    try {
      const { month, year } = data;

      // التحقق من عدم وجود كشف راتب لنفس الشهر
      const existing = await this.prisma.payroll.findFirst({
        where: { employeeId, month, year }
      });

      if (existing) {
        throw new Error('يوجد كشف راتب لهذا الشهر مسبقاً');
      }

      // جلب بيانات الموظف
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId }
      });

      if (!employee) {
        throw new Error('الموظف غير موجود');
      }

      // جلب إعدادات HR
      const settings = await this.prisma.hRSettings.findUnique({
        where: { companyId }
      });

      // حساب فترة الراتب
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0);

      // جلب سجلات الحضور للشهر
      const attendance = await this.prisma.attendance.findMany({
        where: {
          employeeId,
          date: { gte: periodStart, lte: periodEnd }
        }
      });

      // حساب أيام العمل الفعلية
      const workingDays = this.getWorkingDaysInMonth(year, month);
      const presentDays = attendance.filter(a => 
        ['PRESENT', 'LATE', 'REMOTE'].includes(a.status)
      ).length;
      const absentDays = workingDays - presentDays;

      // حساب ساعات العمل الإضافي
      const totalOvertimeHours = attendance.reduce((sum, a) => 
        sum + (parseFloat(a.overtimeHours) || 0), 0
      );

      // حساب دقائق التأخير
      const totalLateMinutes = attendance.reduce((sum, a) => 
        sum + (a.lateMinutes || 0), 0
      );

      // الراتب الأساسي
      const baseSalary = parseFloat(employee.baseSalary) || 0;
      const dailyRate = baseSalary / workingDays;
      const hourlyRate = dailyRate / 8;

      // البدلات (من data أو افتراضية)
      const allowances = data.allowances || {};
      const totalAllowances = Object.values(allowances).reduce((sum, val) => 
        sum + (parseFloat(val) || 0), 0
      );

      // الخصومات
      const deductions = {};
      
      // خصم الغياب
      if (absentDays > 0) {
        deductions.absence = dailyRate * absentDays;
      }

      // خصم التأخير (كل 60 دقيقة = خصم ساعة)
      if (totalLateMinutes > 0) {
        const lateHours = Math.floor(totalLateMinutes / 60);
        if (lateHours > 0) {
          deductions.late = hourlyRate * lateHours;
        }
      }

      // خصومات إضافية من data
      if (data.deductions) {
        Object.assign(deductions, data.deductions);
      }

      const totalDeductions = Object.values(deductions).reduce((sum, val) => 
        sum + (parseFloat(val) || 0), 0
      );

      // حساب الإضافي
      const overtimeRate = parseFloat(settings?.overtimeRate) || 1.5;
      const overtimeAmount = totalOvertimeHours * hourlyRate * overtimeRate;

      // المكافآت
      const bonuses = parseFloat(data.bonuses) || 0;

      // التأمينات الاجتماعية
      const socialInsuranceRate = parseFloat(settings?.socialInsuranceRate) || 14;
      const socialInsurance = (baseSalary * socialInsuranceRate) / 100;

      // الضرائب (مبسطة - يمكن تطويرها)
      const taxAmount = this.calculateTax(baseSalary + totalAllowances, settings?.taxBrackets);

      // الإجماليات
      const grossSalary = baseSalary + totalAllowances + overtimeAmount + bonuses;
      const netSalary = grossSalary - totalDeductions - socialInsurance - taxAmount;

      const payroll = await this.prisma.payroll.create({
        data: {
          companyId,
          employeeId,
          month,
          year,
          periodStart,
          periodEnd,
          baseSalary,
          workingDays,
          actualWorkDays: presentDays,
          allowances: JSON.stringify(allowances),
          totalAllowances,
          deductions: JSON.stringify(deductions),
          totalDeductions,
          overtimeHours: totalOvertimeHours,
          overtimeRate,
          overtimeAmount,
          bonuses,
          bonusNotes: data.bonusNotes,
          socialInsurance,
          taxAmount,
          grossSalary,
          netSalary,
          status: 'DRAFT',
          notes: data.notes
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              department: { select: { name: true } }
            }
          }
        }
      });

      return payroll;
    } catch (error) {
      console.error('❌ Error creating payroll:', error);
      throw error;
    }
  }

  /**
   * توليد كشوف رواتب لجميع الموظفين
   */
  async generateMonthlyPayroll(companyId, month, year) {
    try {
      const employees = await this.prisma.employee.findMany({
        where: { companyId, status: 'ACTIVE' }
      });

      const results = {
        success: [],
        failed: []
      };

      for (const employee of employees) {
        try {
          const payroll = await this.createPayroll(companyId, employee.id, { month, year });
          results.success.push({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            payrollId: payroll.id
          });
        } catch (error) {
          results.failed.push({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('❌ Error generating monthly payroll:', error);
      throw error;
    }
  }

  /**
   * جلب كشوف الرواتب
   */
  async getPayrolls(companyId, options = {}) {
    try {
      const {
        employeeId,
        month,
        year,
        status,
        page = 1,
        limit = 20
      } = options;

      const where = { companyId };

      if (employeeId) where.employeeId = employeeId;
      if (month) where.month = month;
      if (year) where.year = year;
      if (status) where.status = status;

      const [payrolls, total] = await Promise.all([
        this.prisma.payroll.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                avatar: true,
                department: { select: { name: true } },
                position: { select: { title: true } }
              }
            }
          },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.payroll.count({ where })
      ]);

      return {
        payrolls,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ Error getting payrolls:', error);
      throw error;
    }
  }

  /**
   * جلب كشف راتب بالـ ID
   */
  async getPayrollById(companyId, payrollId) {
    try {
      const payroll = await this.prisma.payroll.findFirst({
        where: { id: payrollId, companyId },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              avatar: true,
              email: true,
              bankName: true,
              bankAccountNumber: true,
              bankIban: true,
              department: { select: { name: true } },
              position: { select: { title: true } }
            }
          }
        }
      });

      if (payroll) {
        // تحويل JSON strings إلى objects
        payroll.allowances = JSON.parse(payroll.allowances || '{}');
        payroll.deductions = JSON.parse(payroll.deductions || '{}');
      }

      return payroll;
    } catch (error) {
      console.error('❌ Error getting payroll:', error);
      throw error;
    }
  }

  /**
   * تحديث كشف راتب
   */
  async updatePayroll(companyId, payrollId, data) {
    try {
      const existing = await this.prisma.payroll.findFirst({
        where: { id: payrollId, companyId }
      });

      if (!existing) {
        throw new Error('كشف الراتب غير موجود');
      }

      if (existing.status === 'PAID') {
        throw new Error('لا يمكن تعديل كشف راتب مدفوع');
      }

      // إعادة حساب الإجماليات إذا تغيرت البدلات أو الخصومات
      let updateData = { ...data };

      if (data.allowances) {
        updateData.allowances = JSON.stringify(data.allowances);
        updateData.totalAllowances = Object.values(data.allowances).reduce((sum, val) => 
          sum + (parseFloat(val) || 0), 0
        );
      }

      if (data.deductions) {
        updateData.deductions = JSON.stringify(data.deductions);
        updateData.totalDeductions = Object.values(data.deductions).reduce((sum, val) => 
          sum + (parseFloat(val) || 0), 0
        );
      }

      // إعادة حساب الإجماليات
      const baseSalary = parseFloat(data.baseSalary || existing.baseSalary);
      const totalAllowances = updateData.totalAllowances || parseFloat(existing.totalAllowances);
      const totalDeductions = updateData.totalDeductions || parseFloat(existing.totalDeductions);
      const overtimeAmount = parseFloat(data.overtimeAmount || existing.overtimeAmount);
      const bonuses = parseFloat(data.bonuses || existing.bonuses);
      const socialInsurance = parseFloat(data.socialInsurance || existing.socialInsurance);
      const taxAmount = parseFloat(data.taxAmount || existing.taxAmount);

      updateData.grossSalary = baseSalary + totalAllowances + overtimeAmount + bonuses;
      updateData.netSalary = updateData.grossSalary - totalDeductions - socialInsurance - taxAmount;

      const payroll = await this.prisma.payroll.update({
        where: { id: payrollId },
        data: updateData,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true
            }
          }
        }
      });

      return payroll;
    } catch (error) {
      console.error('❌ Error updating payroll:', error);
      throw error;
    }
  }

  /**
   * اعتماد كشف راتب
   */
  async approvePayroll(companyId, payrollId) {
    try {
      const payroll = await this.prisma.payroll.update({
        where: { id: payrollId },
        data: { status: 'APPROVED' }
      });

      return payroll;
    } catch (error) {
      console.error('❌ Error approving payroll:', error);
      throw error;
    }
  }

  /**
   * صرف الراتب
   */
  async markAsPaid(companyId, payrollId, paymentData = {}) {
    try {
      const payroll = await this.prisma.payroll.update({
        where: { id: payrollId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentMethod: paymentData.method || 'bank_transfer',
          paymentReference: paymentData.reference
        }
      });

      return payroll;
    } catch (error) {
      console.error('❌ Error marking payroll as paid:', error);
      throw error;
    }
  }

  /**
   * صرف رواتب متعددة
   */
  async bulkMarkAsPaid(companyId, payrollIds, paymentData = {}) {
    try {
      const result = await this.prisma.payroll.updateMany({
        where: {
          id: { in: payrollIds },
          companyId,
          status: 'APPROVED'
        },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentMethod: paymentData.method || 'bank_transfer',
          paymentReference: paymentData.reference
        }
      });

      return { updated: result.count };
    } catch (error) {
      console.error('❌ Error bulk marking payrolls as paid:', error);
      throw error;
    }
  }

  /**
   * حذف كشف راتب
   */
  async deletePayroll(companyId, payrollId) {
    try {
      const existing = await this.prisma.payroll.findFirst({
        where: { id: payrollId, companyId }
      });

      if (!existing) {
        throw new Error('كشف الراتب غير موجود');
      }

      if (existing.status === 'PAID') {
        throw new Error('لا يمكن حذف كشف راتب مدفوع');
      }

      await this.prisma.payroll.delete({
        where: { id: payrollId }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting payroll:', error);
      throw error;
    }
  }

  /**
   * ملخص الرواتب الشهري
   */
  async getPayrollSummary(companyId, month, year) {
    try {
      const payrolls = await this.prisma.payroll.findMany({
        where: { companyId, month, year },
        include: {
          employee: {
            select: {
              department: { select: { id: true, name: true } }
            }
          }
        }
      });

      const summary = {
        month,
        year,
        totalEmployees: payrolls.length,
        totalBaseSalary: 0,
        totalAllowances: 0,
        totalDeductions: 0,
        totalOvertime: 0,
        totalBonuses: 0,
        totalSocialInsurance: 0,
        totalTax: 0,
        totalGross: 0,
        totalNet: 0,
        byStatus: {},
        byDepartment: {}
      };

      payrolls.forEach(p => {
        summary.totalBaseSalary += parseFloat(p.baseSalary) || 0;
        summary.totalAllowances += parseFloat(p.totalAllowances) || 0;
        summary.totalDeductions += parseFloat(p.totalDeductions) || 0;
        summary.totalOvertime += parseFloat(p.overtimeAmount) || 0;
        summary.totalBonuses += parseFloat(p.bonuses) || 0;
        summary.totalSocialInsurance += parseFloat(p.socialInsurance) || 0;
        summary.totalTax += parseFloat(p.taxAmount) || 0;
        summary.totalGross += parseFloat(p.grossSalary) || 0;
        summary.totalNet += parseFloat(p.netSalary) || 0;

        // حسب الحالة
        summary.byStatus[p.status] = (summary.byStatus[p.status] || 0) + 1;

        // حسب القسم
        const deptName = p.employee?.department?.name || 'بدون قسم';
        if (!summary.byDepartment[deptName]) {
          summary.byDepartment[deptName] = { count: 0, total: 0 };
        }
        summary.byDepartment[deptName].count++;
        summary.byDepartment[deptName].total += parseFloat(p.netSalary) || 0;
      });

      return summary;
    } catch (error) {
      console.error('❌ Error getting payroll summary:', error);
      throw error;
    }
  }

  /**
   * تقرير الرواتب السنوي
   */
  async getAnnualReport(companyId, year, employeeId = null) {
    try {
      const where = { companyId, year };
      if (employeeId) where.employeeId = employeeId;

      const payrolls = await this.prisma.payroll.findMany({
        where,
        orderBy: { month: 'asc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true
            }
          }
        }
      });

      // تجميع حسب الموظف
      const byEmployee = {};
      payrolls.forEach(p => {
        const empId = p.employeeId;
        if (!byEmployee[empId]) {
          byEmployee[empId] = {
            employee: p.employee,
            months: [],
            totals: {
              baseSalary: 0,
              allowances: 0,
              deductions: 0,
              overtime: 0,
              bonuses: 0,
              gross: 0,
              net: 0
            }
          };
        }

        byEmployee[empId].months.push({
          month: p.month,
          netSalary: p.netSalary,
          status: p.status
        });

        byEmployee[empId].totals.baseSalary += parseFloat(p.baseSalary) || 0;
        byEmployee[empId].totals.allowances += parseFloat(p.totalAllowances) || 0;
        byEmployee[empId].totals.deductions += parseFloat(p.totalDeductions) || 0;
        byEmployee[empId].totals.overtime += parseFloat(p.overtimeAmount) || 0;
        byEmployee[empId].totals.bonuses += parseFloat(p.bonuses) || 0;
        byEmployee[empId].totals.gross += parseFloat(p.grossSalary) || 0;
        byEmployee[empId].totals.net += parseFloat(p.netSalary) || 0;
      });

      return {
        year,
        employees: Object.values(byEmployee)
      };
    } catch (error) {
      console.error('❌ Error getting annual report:', error);
      throw error;
    }
  }

  // ===== Helper Methods =====

  getWorkingDaysInMonth(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      // استبعاد الجمعة والسبت
      if (dayOfWeek !== 5 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    return workingDays;
  }

  calculateTax(income, taxBracketsJson) {
    // حساب ضريبي مبسط - يمكن تطويره حسب قوانين الدولة
    try {
      const brackets = taxBracketsJson ? JSON.parse(taxBracketsJson) : [
        { min: 0, max: 15000, rate: 0 },
        { min: 15000, max: 30000, rate: 2.5 },
        { min: 30000, max: 45000, rate: 10 },
        { min: 45000, max: 60000, rate: 15 },
        { min: 60000, max: 200000, rate: 20 },
        { min: 200000, max: 400000, rate: 22.5 },
        { min: 400000, max: Infinity, rate: 25 }
      ];

      // تحويل الراتب الشهري إلى سنوي
      const annualIncome = income * 12;
      let tax = 0;

      for (const bracket of brackets) {
        if (annualIncome > bracket.min) {
          const taxableInBracket = Math.min(annualIncome, bracket.max) - bracket.min;
          tax += (taxableInBracket * bracket.rate) / 100;
        }
      }

      // إرجاع الضريبة الشهرية
      return Math.round((tax / 12) * 100) / 100;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = new PayrollService();
