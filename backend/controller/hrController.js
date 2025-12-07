/**
 * 👥 HR Controller
 * API endpoints لإدارة الموارد البشرية
 */

const {
  employeeService,
  departmentService,
  attendanceService,
  leaveService,
  payrollService,
  documentService,
  salaryHistoryService,
  performanceService,
  trainingService,
  warningService,
  shiftService,
  benefitService,
  goalService,
  feedbackService,
  resignationService
} = require('../services/hr');

// ═══════════════════════════════════════════════════════════════════════════════
// 🏢 الأقسام - Departments
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * إنشاء قسم جديد
 * POST /api/hr/departments
 */
async function createDepartment(req, res) {
  try {
    const { companyId } = req.user;
    const department = await departmentService.createDepartment(companyId, req.body);
    res.status(201).json({ success: true, department });
  } catch (error) {
    console.error('❌ Error creating department:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء القسم' });
  }
}

/**
 * جلب جميع الأقسام
 * GET /api/hr/departments
 */
async function getDepartments(req, res) {
  try {
    const { companyId } = req.user;
    const { tree, includeInactive } = req.query;
    const departments = await departmentService.getDepartments(companyId, {
      tree: tree === 'true',
      includeInactive: includeInactive === 'true'
    });
    res.json({ success: true, departments });
  } catch (error) {
    console.error('❌ Error getting departments:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الأقسام' });
  }
}

/**
 * جلب قسم بالـ ID
 * GET /api/hr/departments/:id
 */
async function getDepartmentById(req, res) {
  try {
    const { companyId } = req.user;
    const department = await departmentService.getDepartmentById(companyId, req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'القسم غير موجود' });
    }
    res.json({ success: true, department });
  } catch (error) {
    console.error('❌ Error getting department:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب القسم' });
  }
}

/**
 * تحديث قسم
 * PUT /api/hr/departments/:id
 */
async function updateDepartment(req, res) {
  try {
    const { companyId } = req.user;
    const department = await departmentService.updateDepartment(companyId, req.params.id, req.body);
    res.json({ success: true, department });
  } catch (error) {
    console.error('❌ Error updating department:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث القسم' });
  }
}

/**
 * حذف قسم
 * DELETE /api/hr/departments/:id
 */
async function deleteDepartment(req, res) {
  try {
    const { companyId } = req.user;
    await departmentService.deleteDepartment(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف القسم بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting department:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف القسم' });
  }
}

/**
 * إحصائيات الأقسام
 * GET /api/hr/departments/stats
 */
async function getDepartmentStats(req, res) {
  try {
    const { companyId } = req.user;
    const stats = await departmentService.getDepartmentStats(companyId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting department stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 👤 الموظفين - Employees
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * إنشاء موظف جديد
 * POST /api/hr/employees
 */
async function createEmployee(req, res) {
  try {
    const { companyId } = req.user;
    const employee = await employeeService.createEmployee(companyId, req.body);
    res.status(201).json({ success: true, employee });
  } catch (error) {
    console.error('❌ Error creating employee:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء الموظف' });
  }
}

/**
 * جلب جميع الموظفين
 * GET /api/hr/employees
 */
async function getEmployees(req, res) {
  try {
    console.log('📋 [HR] getEmployees called, user:', req.user?.id, 'companyId:', req.user?.companyId);
    const { companyId } = req.user;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId مطلوب' });
    }
    const result = await employeeService.getEmployees(companyId, req.query);
    console.log('✅ [HR] getEmployees success, count:', result?.employees?.length || 0);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ [HR] Error getting employees:', error.message);
    console.error('❌ [HR] Full error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الموظفين', details: error.message });
  }
}

/**
 * جلب موظف بالـ ID
 * GET /api/hr/employees/:id
 */
async function getEmployeeById(req, res) {
  try {
    const { companyId } = req.user;
    const employee = await employeeService.getEmployeeById(companyId, req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }
    res.json({ success: true, employee });
  } catch (error) {
    console.error('❌ Error getting employee:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الموظف' });
  }
}

/**
 * تحديث موظف
 * PUT /api/hr/employees/:id
 */
async function updateEmployee(req, res) {
  try {
    const { companyId } = req.user;
    const employee = await employeeService.updateEmployee(companyId, req.params.id, req.body);
    res.json({ success: true, employee });
  } catch (error) {
    console.error('❌ Error updating employee:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث الموظف' });
  }
}

/**
 * حذف موظف
 * DELETE /api/hr/employees/:id
 */
async function deleteEmployee(req, res) {
  try {
    const { companyId } = req.user;
    await employeeService.deleteEmployee(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف الموظف بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting employee:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف الموظف' });
  }
}

/**
 * إنهاء خدمة موظف
 * POST /api/hr/employees/:id/terminate
 */
async function terminateEmployee(req, res) {
  try {
    const { companyId } = req.user;
    const employee = await employeeService.terminateEmployee(companyId, req.params.id, req.body);
    res.json({ success: true, employee });
  } catch (error) {
    console.error('❌ Error terminating employee:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنهاء الخدمة' });
  }
}

/**
 * ربط موظف بحساب مستخدم
 * POST /api/hr/employees/:id/link-user
 */
async function linkEmployeeToUser(req, res) {
  try {
    const { companyId } = req.user;
    const { userId } = req.body;
    const employee = await employeeService.linkToUser(companyId, req.params.id, userId);
    res.json({ success: true, employee });
  } catch (error) {
    console.error('❌ Error linking employee to user:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء الربط' });
  }
}

/**
 * الهيكل التنظيمي
 * GET /api/hr/employees/organization-chart
 */
async function getOrganizationChart(req, res) {
  try {
    const { companyId } = req.user;
    const chart = await employeeService.getOrganizationChart(companyId);
    res.json({ success: true, chart });
  } catch (error) {
    console.error('❌ Error getting organization chart:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الهيكل التنظيمي' });
  }
}

/**
 * إحصائيات الموظفين
 * GET /api/hr/employees/stats
 */
async function getEmployeeStats(req, res) {
  try {
    const { companyId } = req.user;
    const stats = await employeeService.getEmployeeStats(companyId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting employee stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⏰ الحضور والانصراف - Attendance
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * تسجيل حضور
 * POST /api/hr/attendance/check-in
 */
async function checkIn(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, location, method } = req.body;
    const attendance = await attendanceService.checkIn(companyId, employeeId, { location, method });
    res.json({ success: true, attendance });
  } catch (error) {
    console.error('❌ Error checking in:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تسجيل الحضور' });
  }
}

/**
 * تسجيل انصراف
 * POST /api/hr/attendance/check-out
 */
async function checkOut(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, location, method } = req.body;
    const attendance = await attendanceService.checkOut(companyId, employeeId, { location, method });
    res.json({ success: true, attendance });
  } catch (error) {
    console.error('❌ Error checking out:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تسجيل الانصراف' });
  }
}

/**
 * جلب سجل الحضور
 * GET /api/hr/attendance
 */
async function getAttendance(req, res) {
  try {
    const { companyId } = req.user;
    const result = await attendanceService.getAttendance(companyId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error getting attendance:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سجل الحضور', details: error.message });
  }
}

/**
 * جلب حضور اليوم
 * GET /api/hr/attendance/today
 */
async function getTodayAttendance(req, res) {
  try {
    const { companyId } = req.user;
    const result = await attendanceService.getTodayAttendance(companyId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error getting today attendance:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب حضور اليوم' });
  }
}

/**
 * تحديث سجل حضور
 * PUT /api/hr/attendance/:id
 */
async function updateAttendance(req, res) {
  try {
    const { companyId } = req.user;
    const attendance = await attendanceService.updateAttendance(companyId, req.params.id, req.body);
    res.json({ success: true, attendance });
  } catch (error) {
    console.error('❌ Error updating attendance:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث السجل' });
  }
}

/**
 * إنشاء سجل حضور يدوي
 * POST /api/hr/attendance/manual
 */
async function createManualAttendance(req, res) {
  try {
    const { companyId } = req.user;
    const attendance = await attendanceService.createManualAttendance(companyId, req.body);
    res.status(201).json({ success: true, attendance });
  } catch (error) {
    console.error('❌ Error creating manual attendance:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء السجل' });
  }
}

/**
 * تقرير الحضور الشهري
 * GET /api/hr/attendance/monthly-report
 */
async function getMonthlyAttendanceReport(req, res) {
  try {
    const { companyId } = req.user;
    const { year, month, employeeId } = req.query;
    const report = await attendanceService.getMonthlyReport(
      companyId,
      parseInt(year),
      parseInt(month),
      employeeId
    );
    res.json({ success: true, report });
  } catch (error) {
    console.error('❌ Error getting monthly report:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التقرير' });
  }
}

/**
 * إحصائيات الحضور
 * GET /api/hr/attendance/stats
 */
async function getAttendanceStats(req, res) {
  try {
    const { companyId } = req.user;
    const { startDate, endDate } = req.query;
    const stats = await attendanceService.getAttendanceStats(companyId, startDate, endDate);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting attendance stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🏖️ الإجازات - Leaves
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * إنشاء طلب إجازة
 * POST /api/hr/leaves
 */
async function createLeaveRequest(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.body;
    const leave = await leaveService.createLeaveRequest(companyId, employeeId, req.body);
    res.status(201).json({ success: true, leave });
  } catch (error) {
    console.error('❌ Error creating leave request:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء الطلب' });
  }
}

/**
 * جلب طلبات الإجازات
 * GET /api/hr/leaves
 */
async function getLeaveRequests(req, res) {
  try {
    const { companyId } = req.user;
    const result = await leaveService.getLeaveRequests(companyId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error getting leave requests:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الطلبات' });
  }
}

/**
 * جلب طلب إجازة بالـ ID
 * GET /api/hr/leaves/:id
 */
async function getLeaveRequestById(req, res) {
  try {
    const { companyId } = req.user;
    const leave = await leaveService.getLeaveRequestById(companyId, req.params.id);
    if (!leave) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }
    res.json({ success: true, leave });
  } catch (error) {
    console.error('❌ Error getting leave request:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الطلب' });
  }
}

/**
 * الموافقة على طلب إجازة
 * POST /api/hr/leaves/:id/approve
 */
async function approveLeaveRequest(req, res) {
  try {
    const { companyId, id: approverId } = req.user;
    const leave = await leaveService.approveLeaveRequest(companyId, req.params.id, approverId);
    res.json({ success: true, leave });
  } catch (error) {
    console.error('❌ Error approving leave request:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء الموافقة' });
  }
}

/**
 * رفض طلب إجازة
 * POST /api/hr/leaves/:id/reject
 */
async function rejectLeaveRequest(req, res) {
  try {
    const { companyId, id: approverId } = req.user;
    const { reason } = req.body;
    const leave = await leaveService.rejectLeaveRequest(companyId, req.params.id, approverId, reason);
    res.json({ success: true, leave });
  } catch (error) {
    console.error('❌ Error rejecting leave request:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء الرفض' });
  }
}

/**
 * إلغاء طلب إجازة
 * POST /api/hr/leaves/:id/cancel
 */
async function cancelLeaveRequest(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.body;
    const leave = await leaveService.cancelLeaveRequest(companyId, req.params.id, employeeId);
    res.json({ success: true, leave });
  } catch (error) {
    console.error('❌ Error cancelling leave request:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء الإلغاء' });
  }
}

/**
 * جلب رصيد الإجازات
 * GET /api/hr/leaves/balance/:employeeId
 */
async function getLeaveBalance(req, res) {
  try {
    const { companyId } = req.user;
    const balance = await leaveService.getLeaveBalance(companyId, req.params.employeeId);
    res.json({ success: true, balance });
  } catch (error) {
    console.error('❌ Error getting leave balance:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب الرصيد' });
  }
}

/**
 * تقويم الإجازات
 * GET /api/hr/leaves/calendar
 */
async function getLeaveCalendar(req, res) {
  try {
    const { companyId } = req.user;
    const { year, month } = req.query;
    const calendar = await leaveService.getLeaveCalendar(companyId, parseInt(year), parseInt(month));
    res.json({ success: true, calendar });
  } catch (error) {
    console.error('❌ Error getting leave calendar:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التقويم' });
  }
}

/**
 * إحصائيات الإجازات
 * GET /api/hr/leaves/stats
 */
async function getLeaveStats(req, res) {
  try {
    const { companyId } = req.user;
    const { year } = req.query;
    const stats = await leaveService.getLeaveStats(companyId, parseInt(year) || new Date().getFullYear());
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting leave stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 الرواتب - Payroll
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * إنشاء كشف راتب
 * POST /api/hr/payroll
 */
async function createPayroll(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.body;
    const payroll = await payrollService.createPayroll(companyId, employeeId, req.body);
    res.status(201).json({ success: true, payroll });
  } catch (error) {
    console.error('❌ Error creating payroll:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء كشف الراتب' });
  }
}

/**
 * توليد كشوف رواتب لجميع الموظفين
 * POST /api/hr/payroll/generate
 */
async function generateMonthlyPayroll(req, res) {
  try {
    const { companyId } = req.user;
    const { month, year } = req.body;
    const result = await payrollService.generateMonthlyPayroll(companyId, month, year);
    res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Error generating payroll:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء توليد كشوف الرواتب' });
  }
}

/**
 * جلب كشوف الرواتب
 * GET /api/hr/payroll
 */
async function getPayrolls(req, res) {
  try {
    const { companyId } = req.user;
    const result = await payrollService.getPayrolls(companyId, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ Error getting payrolls:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب كشوف الرواتب' });
  }
}

/**
 * جلب كشف راتب بالـ ID
 * GET /api/hr/payroll/:id
 */
async function getPayrollById(req, res) {
  try {
    const { companyId } = req.user;
    const payroll = await payrollService.getPayrollById(companyId, req.params.id);
    if (!payroll) {
      return res.status(404).json({ error: 'كشف الراتب غير موجود' });
    }
    res.json({ success: true, payroll });
  } catch (error) {
    console.error('❌ Error getting payroll:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب كشف الراتب' });
  }
}

/**
 * تحديث كشف راتب
 * PUT /api/hr/payroll/:id
 */
async function updatePayroll(req, res) {
  try {
    const { companyId } = req.user;
    const payroll = await payrollService.updatePayroll(companyId, req.params.id, req.body);
    res.json({ success: true, payroll });
  } catch (error) {
    console.error('❌ Error updating payroll:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث كشف الراتب' });
  }
}

/**
 * اعتماد كشف راتب
 * POST /api/hr/payroll/:id/approve
 */
async function approvePayroll(req, res) {
  try {
    const { companyId } = req.user;
    const payroll = await payrollService.approvePayroll(companyId, req.params.id);
    res.json({ success: true, payroll });
  } catch (error) {
    console.error('❌ Error approving payroll:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء الاعتماد' });
  }
}

/**
 * صرف الراتب
 * POST /api/hr/payroll/:id/pay
 */
async function markPayrollAsPaid(req, res) {
  try {
    const { companyId } = req.user;
    const payroll = await payrollService.markAsPaid(companyId, req.params.id, req.body);
    res.json({ success: true, payroll });
  } catch (error) {
    console.error('❌ Error marking payroll as paid:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء الصرف' });
  }
}

/**
 * صرف رواتب متعددة
 * POST /api/hr/payroll/bulk-pay
 */
async function bulkMarkPayrollAsPaid(req, res) {
  try {
    const { companyId } = req.user;
    const { payrollIds, paymentData } = req.body;
    const result = await payrollService.bulkMarkAsPaid(companyId, payrollIds, paymentData);
    res.json({ success: true, result });
  } catch (error) {
    console.error('❌ Error bulk marking payrolls as paid:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء الصرف' });
  }
}

/**
 * حذف كشف راتب
 * DELETE /api/hr/payroll/:id
 */
async function deletePayroll(req, res) {
  try {
    const { companyId } = req.user;
    await payrollService.deletePayroll(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف كشف الراتب بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting payroll:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء الحذف' });
  }
}

/**
 * ملخص الرواتب الشهري
 * GET /api/hr/payroll/summary
 */
async function getPayrollSummary(req, res) {
  try {
    const { companyId } = req.user;
    const { month, year } = req.query;
    const summary = await payrollService.getPayrollSummary(companyId, parseInt(month), parseInt(year));
    res.json({ success: true, summary });
  } catch (error) {
    console.error('❌ Error getting payroll summary:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الملخص' });
  }
}

/**
 * تقرير الرواتب السنوي
 * GET /api/hr/payroll/annual-report
 */
async function getAnnualPayrollReport(req, res) {
  try {
    const { companyId } = req.user;
    const { year, employeeId } = req.query;
    const report = await payrollService.getAnnualReport(companyId, parseInt(year), employeeId);
    res.json({ success: true, report });
  } catch (error) {
    console.error('❌ Error getting annual report:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التقرير' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 المزامنة - Sync
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * مزامنة المستخدمين مع الموظفين
 * POST /api/v1/hr/sync-users
 */
async function syncUsersToEmployees(req, res) {
  try {
    console.log('🔄 [HR] Starting user sync for company:', req.user?.companyId);
    const { companyId } = req.user;

    // جلب جميع المستخدمين في الشركة
    const { getSharedPrismaClient } = require('../services/sharedDatabase');
    const prisma = getSharedPrismaClient();

    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatar: true,
        createdAt: true
      }
    });

    console.log('👥 [HR] Found users:', users.length);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      // تحقق من وجود employee record
      const existingEmployee = await prisma.employee.findFirst({
        where: { userId: user.id }
      });

      if (!existingEmployee) {
        // إنشاء employee record جديد
        const employeeCount = await prisma.employee.count({ where: { companyId } });
        const employeeNumber = `EMP${String(employeeCount + 1).padStart(5, '0')}`;

        await prisma.employee.create({
          data: {
            companyId,
            userId: user.id,
            employeeNumber,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            hireDate: user.createdAt, // استخدام تاريخ إنشاء الحساب كتاريخ التعيين
            status: 'ACTIVE'
          }
        });

        syncedCount++;
        console.log('✅ [HR] Synced user:', user.email);
      } else {
        skippedCount++;
      }
    }

    console.log('🎉 [HR] Sync completed. Synced:', syncedCount, 'Skipped:', skippedCount);

    res.json({
      success: true,
      message: `تم مزامنة ${syncedCount} مستخدم، تم تخطي ${skippedCount} مستخدم موجود مسبقاً`,
      synced: syncedCount,
      skipped: skippedCount,
      total: users.length
    });
  } catch (error) {
    console.error('❌ [HR] Error syncing users:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء مزامنة المستخدمين', details: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 لوحة التحكم - Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * لوحة تحكم HR
 * GET /api/hr/dashboard
 */
async function getHRDashboard(req, res) {
  try {
    const { companyId } = req.user;

    const [
      employeeStats,
      todayAttendance,
      pendingLeaves,
      departmentStats
    ] = await Promise.all([
      employeeService.getEmployeeStats(companyId),
      attendanceService.getTodayAttendance(companyId),
      leaveService.getLeaveRequests(companyId, { status: 'PENDING', limit: 5 }),
      departmentService.getDepartmentStats(companyId)
    ]);

    res.json({
      success: true,
      dashboard: {
        employees: employeeStats,
        attendance: todayAttendance,
        pendingLeaves: pendingLeaves.requests,
        departments: departmentStats
      }
    });
  } catch (error) {
    console.error('❌ Error getting HR dashboard:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب لوحة التحكم' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📚 التدريب - Training
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * إنشاء سجل تدريب جديد
 * POST /api/hr/trainings
 */
async function createTraining(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.body;
    const training = await trainingService.createTraining(companyId, employeeId, req.body);
    res.status(201).json({ success: true, training });
  } catch (error) {
    console.error('❌ Error creating training:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء سجل التدريب' });
  }
}

/**
 * جلب سجلات التدريب لموظف
 * GET /api/hr/trainings/employee/:employeeId
 */
async function getEmployeeTrainings(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.params;
    const { status, limit } = req.query;
    const trainings = await trainingService.getEmployeeTrainings(companyId, employeeId, { status, limit });
    res.json({ success: true, trainings });
  } catch (error) {
    console.error('❌ Error getting trainings:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سجلات التدريب' });
  }
}

/**
 * جلب سجل تدريب بالـ ID
 * GET /api/hr/trainings/:id
 */
async function getTrainingById(req, res) {
  try {
    const { companyId } = req.user;
    const training = await trainingService.getTrainingById(companyId, req.params.id);
    res.json({ success: true, training });
  } catch (error) {
    console.error('❌ Error getting training:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب سجل التدريب' });
  }
}

/**
 * تحديث سجل تدريب
 * PUT /api/hr/trainings/:id
 */
async function updateTraining(req, res) {
  try {
    const { companyId } = req.user;
    const training = await trainingService.updateTraining(companyId, req.params.id, req.body);
    res.json({ success: true, training });
  } catch (error) {
    console.error('❌ Error updating training:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث سجل التدريب' });
  }
}

/**
 * حذف سجل تدريب
 * DELETE /api/hr/trainings/:id
 */
async function deleteTraining(req, res) {
  try {
    const { companyId } = req.user;
    await trainingService.deleteTraining(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف سجل التدريب بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting training:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف سجل التدريب' });
  }
}

/**
 * إحصائيات التدريب
 * GET /api/hr/trainings/stats
 */
async function getTrainingStats(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, year } = req.query;
    const stats = await trainingService.getTrainingStats(companyId, { employeeId, year });
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting training stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️ الإنذارات - Warnings
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * إنشاء إنذار جديد
 * POST /api/hr/warnings
 */
async function createWarning(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.body;
    const warning = await warningService.createWarning(companyId, employeeId, req.body);
    res.status(201).json({ success: true, warning });
  } catch (error) {
    console.error('❌ Error creating warning:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء الإنذار' });
  }
}

/**
 * جلب إنذارات موظف
 * GET /api/hr/warnings/employee/:employeeId
 */
async function getEmployeeWarnings(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.params;
    const { type, severity, limit } = req.query;
    const warnings = await warningService.getEmployeeWarnings(companyId, employeeId, { type, severity, limit });
    res.json({ success: true, warnings });
  } catch (error) {
    console.error('❌ Error getting warnings:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإنذارات' });
  }
}

/**
 * جلب إنذار بالـ ID
 * GET /api/hr/warnings/:id
 */
async function getWarningById(req, res) {
  try {
    const { companyId } = req.user;
    const warning = await warningService.getWarningById(companyId, req.params.id);
    res.json({ success: true, warning });
  } catch (error) {
    console.error('❌ Error getting warning:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب الإنذار' });
  }
}

/**
 * تحديث إنذار
 * PUT /api/hr/warnings/:id
 */
async function updateWarning(req, res) {
  try {
    const { companyId } = req.user;
    const warning = await warningService.updateWarning(companyId, req.params.id, req.body);
    res.json({ success: true, warning });
  } catch (error) {
    console.error('❌ Error updating warning:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث الإنذار' });
  }
}

/**
 * تسجيل اعتراف الموظف بالإنذار
 * POST /api/hr/warnings/:id/acknowledge
 */
async function acknowledgeWarning(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeResponse } = req.body;
    const warning = await warningService.acknowledgeWarning(companyId, req.params.id, employeeResponse);
    res.json({ success: true, warning });
  } catch (error) {
    console.error('❌ Error acknowledging warning:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تسجيل الاعتراف' });
  }
}

/**
 * حذف إنذار
 * DELETE /api/hr/warnings/:id
 */
async function deleteWarning(req, res) {
  try {
    const { companyId } = req.user;
    await warningService.deleteWarning(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف الإنذار بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting warning:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف الإنذار' });
  }
}

/**
 * إحصائيات الإنذارات
 * GET /api/hr/warnings/stats
 */
async function getWarningStats(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, year } = req.query;
    const stats = await warningService.getWarningStats(companyId, { employeeId, year });
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting warning stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 تقييم الأداء - Performance Reviews
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * إنشاء تقييم أداء جديد
 * POST /api/hr/performance-reviews
 */
async function createPerformanceReview(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.body;
    const review = await performanceService.createPerformanceReview(companyId, employeeId, req.body);
    res.status(201).json({ success: true, review });
  } catch (error) {
    console.error('❌ Error creating performance review:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء التقييم' });
  }
}

/**
 * جلب تقييمات أداء موظف
 * GET /api/hr/performance-reviews/employee/:employeeId
 */
async function getEmployeeReviews(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.params;
    const { status, limit } = req.query;
    const reviews = await performanceService.getEmployeeReviews(companyId, employeeId, { status, limit });
    res.json({ success: true, reviews });
  } catch (error) {
    console.error('❌ Error getting performance reviews:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التقييمات' });
  }
}

/**
 * جلب تقييم أداء بالـ ID
 * GET /api/hr/performance-reviews/:id
 */
async function getReviewById(req, res) {
  try {
    const { companyId } = req.user;
    const review = await performanceService.getReviewById(companyId, req.params.id);
    res.json({ success: true, review });
  } catch (error) {
    console.error('❌ Error getting performance review:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب التقييم' });
  }
}

/**
 * تحديث تقييم أداء
 * PUT /api/hr/performance-reviews/:id
 */
async function updateReview(req, res) {
  try {
    const { companyId } = req.user;
    const review = await performanceService.updateReview(companyId, req.params.id, req.body);
    res.json({ success: true, review });
  } catch (error) {
    console.error('❌ Error updating performance review:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث التقييم' });
  }
}

/**
 * حذف تقييم أداء
 * DELETE /api/hr/performance-reviews/:id
 */
async function deleteReview(req, res) {
  try {
    const { companyId } = req.user;
    await performanceService.deleteReview(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف التقييم بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting performance review:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف التقييم' });
  }
}

/**
 * إحصائيات التقييمات
 * GET /api/hr/performance-reviews/stats
 */
async function getPerformanceStats(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, year } = req.query;
    const stats = await performanceService.getPerformanceStats(companyId, { employeeId, year });
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting performance stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💵 سجل الرواتب - Salary History
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * جلب سجل الرواتب لموظف
 * GET /api/hr/salary-history/employee/:employeeId
 */
async function getEmployeeSalaryHistory(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.params;
    const { limit } = req.query;
    const history = await salaryHistoryService.getEmployeeSalaryHistory(companyId, employeeId, { limit });
    res.json({ success: true, history });
  } catch (error) {
    console.error('❌ Error getting salary history:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب سجل الرواتب' });
  }
}

/**
 * جلب سجل راتب بالـ ID
 * GET /api/hr/salary-history/:id
 */
async function getSalaryHistoryById(req, res) {
  try {
    const { companyId } = req.user;
    const history = await salaryHistoryService.getSalaryHistoryById(companyId, req.params.id);
    res.json({ success: true, history });
  } catch (error) {
    console.error('❌ Error getting salary history:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب السجل' });
  }
}

/**
 * إنشاء سجل راتب جديد
 * POST /api/hr/salary-history
 */
async function createSalaryHistory(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.body;
    const history = await salaryHistoryService.createSalaryHistory(companyId, employeeId, req.body);
    res.status(201).json({ success: true, history });
  } catch (error) {
    console.error('❌ Error creating salary history:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء السجل' });
  }
}

/**
 * إحصائيات سجل الرواتب
 * GET /api/hr/salary-history/stats
 */
async function getSalaryHistoryStats(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.query;
    const stats = await salaryHistoryService.getSalaryHistoryStats(companyId, employeeId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting salary history stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

/**
 * تقرير الترقيات والزيادات
 * GET /api/hr/salary-history/promotions-report
 */
async function getPromotionsReport(req, res) {
  try {
    const { companyId } = req.user;
    const { startDate, endDate, changeType } = req.query;
    const report = await salaryHistoryService.getPromotionsReport(companyId, { startDate, endDate, changeType });
    res.json({ success: true, report });
  } catch (error) {
    console.error('❌ Error getting promotions report:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التقرير' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 المستندات - Documents
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * إنشاء مستند جديد
 * POST /api/hr/documents
 */
async function createDocument(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, name, type, expiryDate, notes } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'الملف مطلوب' });
    }

    const fileUrl = `/uploads/hr/documents/${req.file.filename}`;
    const document = await documentService.createDocument(companyId, employeeId, {
      name,
      type,
      fileUrl,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      expiryDate,
      notes
    });
    
    res.status(201).json({ success: true, document });
  } catch (error) {
    console.error('❌ Error creating document:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء المستند' });
  }
}

/**
 * جلب مستندات موظف
 * GET /api/hr/documents/employee/:employeeId
 */
async function getEmployeeDocuments(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.params;
    const { type, expiredOnly } = req.query;
    const documents = await documentService.getEmployeeDocuments(companyId, employeeId, { type, expiredOnly: expiredOnly === 'true' });
    res.json({ success: true, documents });
  } catch (error) {
    console.error('❌ Error getting documents:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المستندات' });
  }
}

/**
 * جلب مستند بالـ ID
 * GET /api/hr/documents/:id
 */
async function getDocumentById(req, res) {
  try {
    const { companyId } = req.user;
    const document = await documentService.getDocumentById(companyId, req.params.id);
    res.json({ success: true, document });
  } catch (error) {
    console.error('❌ Error getting document:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب المستند' });
  }
}

/**
 * تحديث مستند
 * PUT /api/hr/documents/:id
 */
async function updateDocument(req, res) {
  try {
    const { companyId } = req.user;
    const document = await documentService.updateDocument(companyId, req.params.id, req.body);
    res.json({ success: true, document });
  } catch (error) {
    console.error('❌ Error updating document:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث المستند' });
  }
}

/**
 * التحقق من مستند
 * POST /api/hr/documents/:id/verify
 */
async function verifyDocument(req, res) {
  try {
    const { companyId, id: verifiedBy } = req.user;
    const document = await documentService.verifyDocument(companyId, req.params.id, verifiedBy);
    res.json({ success: true, document });
  } catch (error) {
    console.error('❌ Error verifying document:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء التحقق من المستند' });
  }
}

/**
 * حذف مستند
 * DELETE /api/hr/documents/:id
 */
async function deleteDocument(req, res) {
  try {
    const { companyId } = req.user;
    await documentService.deleteDocument(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف المستند بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting document:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف المستند' });
  }
}

/**
 * جلب المستندات المنتهية
 * GET /api/hr/documents/expired
 */
async function getExpiredDocuments(req, res) {
  try {
    const { companyId } = req.user;
    const { daysBeforeExpiry } = req.query;
    const documents = await documentService.getExpiredDocuments(companyId, parseInt(daysBeforeExpiry) || 30);
    res.json({ success: true, documents });
  } catch (error) {
    console.error('❌ Error getting expired documents:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المستندات المنتهية' });
  }
}

/**
 * إحصائيات المستندات
 * GET /api/hr/documents/stats
 */
async function getDocumentStats(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.query;
    const stats = await documentService.getDocumentStats(companyId, employeeId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting document stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🕐 المناوبات - Shifts
// ═══════════════════════════════════════════════════════════════════════════════

async function createShift(req, res) {
  try {
    const { companyId } = req.user;
    const shift = await shiftService.createShift(companyId, req.body);
    res.status(201).json({ success: true, shift });
  } catch (error) {
    console.error('❌ Error creating shift:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء المناوبة' });
  }
}

async function getShifts(req, res) {
  try {
    const { companyId } = req.user;
    const { includeInactive } = req.query;
    const shifts = await shiftService.getShifts(companyId, { includeInactive: includeInactive === 'true' });
    res.json({ success: true, shifts });
  } catch (error) {
    console.error('❌ Error getting shifts:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المناوبات' });
  }
}

async function getShiftById(req, res) {
  try {
    const { companyId } = req.user;
    const shift = await shiftService.getShiftById(companyId, req.params.id);
    res.json({ success: true, shift });
  } catch (error) {
    console.error('❌ Error getting shift:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب المناوبة' });
  }
}

async function updateShift(req, res) {
  try {
    const { companyId } = req.user;
    const shift = await shiftService.updateShift(companyId, req.params.id, req.body);
    res.json({ success: true, shift });
  } catch (error) {
    console.error('❌ Error updating shift:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث المناوبة' });
  }
}

async function deleteShift(req, res) {
  try {
    const { companyId } = req.user;
    await shiftService.deleteShift(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف المناوبة بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting shift:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف المناوبة' });
  }
}

async function assignShift(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, shiftId, date } = req.body;
    const assignment = await shiftService.assignShift(companyId, employeeId, shiftId, date);
    res.status(201).json({ success: true, assignment });
  } catch (error) {
    console.error('❌ Error assigning shift:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تعيين المناوبة' });
  }
}

async function getEmployeeAssignments(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;
    const assignments = await shiftService.getEmployeeAssignments(companyId, employeeId, { startDate, endDate });
    res.json({ success: true, assignments });
  } catch (error) {
    console.error('❌ Error getting assignments:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التعيينات' });
  }
}

async function removeAssignment(req, res) {
  try {
    const { companyId } = req.user;
    await shiftService.removeAssignment(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف التعيين بنجاح' });
  } catch (error) {
    console.error('❌ Error removing assignment:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف التعيين' });
  }
}

async function getShiftStats(req, res) {
  try {
    const { companyId } = req.user;
    const { startDate, endDate } = req.query;
    const stats = await shiftService.getShiftStats(companyId, { startDate, endDate });
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting shift stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💎 المزايا - Benefits
// ═══════════════════════════════════════════════════════════════════════════════

async function createBenefit(req, res) {
  try {
    const { companyId } = req.user;
    const benefit = await benefitService.createBenefit(companyId, req.body);
    res.status(201).json({ success: true, benefit });
  } catch (error) {
    console.error('❌ Error creating benefit:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء الميزة' });
  }
}

async function getBenefits(req, res) {
  try {
    const { companyId } = req.user;
    const { includeInactive } = req.query;
    const benefits = await benefitService.getBenefits(companyId, { includeInactive: includeInactive === 'true' });
    res.json({ success: true, benefits });
  } catch (error) {
    console.error('❌ Error getting benefits:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب المزايا' });
  }
}

async function getBenefitById(req, res) {
  try {
    const { companyId } = req.user;
    const benefit = await benefitService.getBenefitById(companyId, req.params.id);
    res.json({ success: true, benefit });
  } catch (error) {
    console.error('❌ Error getting benefit:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب الميزة' });
  }
}

async function updateBenefit(req, res) {
  try {
    const { companyId } = req.user;
    const benefit = await benefitService.updateBenefit(companyId, req.params.id, req.body);
    res.json({ success: true, benefit });
  } catch (error) {
    console.error('❌ Error updating benefit:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث الميزة' });
  }
}

async function deleteBenefit(req, res) {
  try {
    const { companyId } = req.user;
    await benefitService.deleteBenefit(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف الميزة بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting benefit:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف الميزة' });
  }
}

async function enrollEmployee(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, benefitId } = req.body;
    const enrollment = await benefitService.enrollEmployee(companyId, employeeId, benefitId, req.body);
    res.status(201).json({ success: true, enrollment });
  } catch (error) {
    console.error('❌ Error enrolling employee:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء الاشتراك' });
  }
}

async function getEmployeeEnrollments(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.params;
    const enrollments = await benefitService.getEmployeeEnrollments(companyId, employeeId);
    res.json({ success: true, enrollments });
  } catch (error) {
    console.error('❌ Error getting enrollments:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الاشتراكات' });
  }
}

async function updateEnrollment(req, res) {
  try {
    const { companyId } = req.user;
    const enrollment = await benefitService.updateEnrollment(companyId, req.params.id, req.body);
    res.json({ success: true, enrollment });
  } catch (error) {
    console.error('❌ Error updating enrollment:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث الاشتراك' });
  }
}

async function getBenefitStats(req, res) {
  try {
    const { companyId } = req.user;
    const stats = await benefitService.getBenefitStats(companyId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting benefit stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📈 الأهداف - Goals
// ═══════════════════════════════════════════════════════════════════════════════

async function createGoal(req, res) {
  try {
    const { companyId } = req.user;
    const goal = await goalService.createGoal(companyId, req.body);
    res.status(201).json({ success: true, goal });
  } catch (error) {
    console.error('❌ Error creating goal:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء الهدف' });
  }
}

async function getGoals(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, departmentId, status } = req.query;
    const goals = await goalService.getGoals(companyId, { employeeId, departmentId, status });
    res.json({ success: true, goals });
  } catch (error) {
    console.error('❌ Error getting goals:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الأهداف' });
  }
}

async function getGoalById(req, res) {
  try {
    const { companyId } = req.user;
    const goal = await goalService.getGoalById(companyId, req.params.id);
    res.json({ success: true, goal });
  } catch (error) {
    console.error('❌ Error getting goal:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب الهدف' });
  }
}

async function updateGoal(req, res) {
  try {
    const { companyId } = req.user;
    const goal = await goalService.updateGoal(companyId, req.params.id, req.body);
    res.json({ success: true, goal });
  } catch (error) {
    console.error('❌ Error updating goal:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث الهدف' });
  }
}

async function deleteGoal(req, res) {
  try {
    const { companyId } = req.user;
    await goalService.deleteGoal(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف الهدف بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting goal:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف الهدف' });
  }
}

async function getGoalStats(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId, departmentId } = req.query;
    const stats = await goalService.getGoalStats(companyId, { employeeId, departmentId });
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting goal stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 التغذية الراجعة - Feedback
// ═══════════════════════════════════════════════════════════════════════════════

async function createFeedback(req, res) {
  try {
    const { companyId, id: fromEmployeeId } = req.user;
    const feedback = await feedbackService.createFeedback(companyId, fromEmployeeId, req.body);
    res.status(201).json({ success: true, feedback });
  } catch (error) {
    console.error('❌ Error creating feedback:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء التغذية الراجعة' });
  }
}

async function getFeedback(req, res) {
  try {
    const { companyId } = req.user;
    const { toEmployeeId, fromEmployeeId, type, limit } = req.query;
    const feedback = await feedbackService.getFeedback(companyId, { toEmployeeId, fromEmployeeId, type, limit });
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('❌ Error getting feedback:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب التغذية الراجعة' });
  }
}

async function getFeedbackById(req, res) {
  try {
    const { companyId } = req.user;
    const feedback = await feedbackService.getFeedbackById(companyId, req.params.id);
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('❌ Error getting feedback:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب التغذية الراجعة' });
  }
}

async function updateFeedback(req, res) {
  try {
    const { companyId } = req.user;
    const feedback = await feedbackService.updateFeedback(companyId, req.params.id, req.body);
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('❌ Error updating feedback:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث التغذية الراجعة' });
  }
}

async function deleteFeedback(req, res) {
  try {
    const { companyId } = req.user;
    await feedbackService.deleteFeedback(companyId, req.params.id);
    res.json({ success: true, message: 'تم حذف التغذية الراجعة بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting feedback:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف التغذية الراجعة' });
  }
}

async function getFeedbackStats(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.query;
    const stats = await feedbackService.getFeedbackStats(companyId, { employeeId });
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting feedback stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 الاستقالات - Resignations
// ═══════════════════════════════════════════════════════════════════════════════

async function createResignation(req, res) {
  try {
    const { companyId } = req.user;
    const { employeeId } = req.body;
    const resignation = await resignationService.createResignation(companyId, employeeId, req.body);
    res.status(201).json({ success: true, resignation });
  } catch (error) {
    console.error('❌ Error creating resignation:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء إنشاء الاستقالة' });
  }
}

async function getResignations(req, res) {
  try {
    const { companyId } = req.user;
    const { status, limit } = req.query;
    const resignations = await resignationService.getResignations(companyId, { status, limit });
    res.json({ success: true, resignations });
  } catch (error) {
    console.error('❌ Error getting resignations:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الاستقالات' });
  }
}

async function getResignationById(req, res) {
  try {
    const { companyId } = req.user;
    const resignation = await resignationService.getResignationById(companyId, req.params.id);
    res.json({ success: true, resignation });
  } catch (error) {
    console.error('❌ Error getting resignation:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء جلب الاستقالة' });
  }
}

async function updateResignation(req, res) {
  try {
    const { companyId, id: approvedBy } = req.user;
    const resignation = await resignationService.updateResignation(companyId, req.params.id, { ...req.body, approvedBy });
    res.json({ success: true, resignation });
  } catch (error) {
    console.error('❌ Error updating resignation:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء تحديث الاستقالة' });
  }
}

async function getResignationStats(req, res) {
  try {
    const { companyId } = req.user;
    const { year } = req.query;
    const stats = await resignationService.getResignationStats(companyId, { year });
    res.json({ success: true, stats });
  } catch (error) {
    console.error('❌ Error getting resignation stats:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📅 العطلات الرسمية - Public Holidays
// ═══════════════════════════════════════════════════════════════════════════════

async function getPublicHolidays(req, res) {
  try {
    const { companyId } = req.user;
    const { getSharedPrismaClient } = require('../services/sharedDatabase');
    const prisma = getSharedPrismaClient();

    const settings = await prisma.hRSettings.findUnique({
      where: { companyId }
    });

    const holidays = settings?.publicHolidays ? JSON.parse(settings.publicHolidays) : [];
    res.json({ success: true, holidays });
  } catch (error) {
    console.error('❌ Error getting public holidays:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب العطلات' });
  }
}

async function updatePublicHolidays(req, res) {
  try {
    const { companyId } = req.user;
    const { holidays } = req.body;
    const { getSharedPrismaClient } = require('../services/sharedDatabase');
    const prisma = getSharedPrismaClient();

    await prisma.hRSettings.upsert({
      where: { companyId },
      update: { publicHolidays: JSON.stringify(holidays) },
      create: { companyId, publicHolidays: JSON.stringify(holidays) }
    });

    res.json({ success: true, message: 'تم حفظ العطلات بنجاح' });
  } catch (error) {
    console.error('❌ Error updating public holidays:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ العطلات' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ الإعدادات - Settings
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * جلب إعدادات HR
 * GET /api/hr/settings
 */
async function getHRSettings(req, res) {
  try {
    const { companyId } = req.user;
    const { getSharedPrismaClient } = require('../services/sharedDatabase');
    const prisma = getSharedPrismaClient();

    let settings = await prisma.hRSettings.findUnique({
      where: { companyId }
    });

    // إذا لم توجد إعدادات، أنشئ إعدادات افتراضية
    if (!settings) {
      settings = await prisma.hRSettings.create({
        data: { companyId }
      });
    }

    // تحويل workDays من JSON string إلى array
    const workDaysArray = JSON.parse(settings.workDays || '[1,2,3,4,5]');
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const workingDays = workDaysArray.map(d => dayNames[d]);

    res.json({
      success: true,
      settings: {
        workStartTime: settings.workStartTime,
        workEndTime: settings.workEndTime,
        breakDuration: settings.breakDuration,
        workingDays,
        annualLeaveDefault: settings.annualLeaveDefault,
        sickLeaveDefault: settings.sickLeaveDefault,
        carryOverLimit: settings.carryOverLimit,
        requireApproval: true,
        minAdvanceNotice: 3,
        payrollDay: settings.payrollDay,
        currency: 'EGP',
        taxRate: 10,
        socialInsuranceRate: Number(settings.socialInsuranceRate),
        overtimeRate: Number(settings.overtimeRate),
        allowRemoteCheckIn: true,
        requireLocation: false,
        lateThreshold: settings.lateGracePeriod,
        earlyLeaveThreshold: settings.earlyLeaveGracePeriod,
        autoAbsentMarking: true,
        notifyOnLeaveRequest: true,
        notifyOnAttendanceIssue: true,
        notifyOnPayrollGeneration: true,
        notifyManagers: true
      }
    });
  } catch (error) {
    console.error('❌ Error getting HR settings:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإعدادات' });
  }
}

/**
 * تحديث إعدادات HR
 * PUT /api/hr/settings
 */
async function updateHRSettings(req, res) {
  try {
    const { companyId } = req.user;
    const { getSharedPrismaClient } = require('../services/sharedDatabase');
    const prisma = getSharedPrismaClient();

    const {
      workStartTime,
      workEndTime,
      breakDuration,
      workingDays,
      annualLeaveDefault,
      sickLeaveDefault,
      carryOverLimit,
      payrollDay,
      socialInsuranceRate,
      overtimeRate,
      lateThreshold,
      earlyLeaveThreshold
    } = req.body;

    // تحويل workingDays من أسماء الأيام إلى أرقام
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const workDaysNumbers = workingDays?.map(day => dayNames.indexOf(day)).filter(d => d !== -1) || [1, 2, 3, 4, 5];

    const settings = await prisma.hRSettings.upsert({
      where: { companyId },
      update: {
        workStartTime: workStartTime || '09:00',
        workEndTime: workEndTime || '17:00',
        breakDuration: breakDuration || 60,
        workDays: JSON.stringify(workDaysNumbers),
        annualLeaveDefault: annualLeaveDefault || 21,
        sickLeaveDefault: sickLeaveDefault || 15,
        carryOverLimit: carryOverLimit || 5,
        payrollDay: payrollDay || 25,
        socialInsuranceRate: socialInsuranceRate || 14,
        overtimeRate: overtimeRate || 1.5,
        lateGracePeriod: lateThreshold || 15,
        earlyLeaveGracePeriod: earlyLeaveThreshold || 15
      },
      create: {
        companyId,
        workStartTime: workStartTime || '09:00',
        workEndTime: workEndTime || '17:00',
        breakDuration: breakDuration || 60,
        workDays: JSON.stringify(workDaysNumbers),
        annualLeaveDefault: annualLeaveDefault || 21,
        sickLeaveDefault: sickLeaveDefault || 15,
        carryOverLimit: carryOverLimit || 5,
        payrollDay: payrollDay || 25,
        socialInsuranceRate: socialInsuranceRate || 14,
        overtimeRate: overtimeRate || 1.5,
        lateGracePeriod: lateThreshold || 15,
        earlyLeaveGracePeriod: earlyLeaveThreshold || 15
      }
    });

    res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح', settings });
  } catch (error) {
    console.error('❌ Error updating HR settings:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الإعدادات' });
  }
}

module.exports = {
  // Settings
  getHRSettings,
  updateHRSettings,

  // Departments
  createDepartment,
  getDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  getDepartmentStats,

  // Employees
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  terminateEmployee,
  linkEmployeeToUser,
  getOrganizationChart,
  getEmployeeStats,

  // Attendance
  checkIn,
  checkOut,
  getAttendance,
  getTodayAttendance,
  updateAttendance,
  createManualAttendance,
  getMonthlyAttendanceReport,
  getAttendanceStats,

  // Leaves
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  getLeaveBalance,
  getLeaveCalendar,
  getLeaveStats,

  // Payroll
  createPayroll,
  generateMonthlyPayroll,
  getPayrolls,
  getPayrollById,
  updatePayroll,
  approvePayroll,
  markPayrollAsPaid,
  bulkMarkPayrollAsPaid,
  deletePayroll,
  getPayrollSummary,
  getAnnualPayrollReport,

  // Dashboard
  getHRDashboard,

  // Sync
  syncUsersToEmployees,

  // Documents
  createDocument,
  getEmployeeDocuments,
  getDocumentById,
  updateDocument,
  verifyDocument,
  deleteDocument,
  getExpiredDocuments,
  getDocumentStats,

  // Salary History
  getEmployeeSalaryHistory,
  getSalaryHistoryById,
  createSalaryHistory,
  getSalaryHistoryStats,
  getPromotionsReport,

  // Performance Reviews
  createPerformanceReview,
  getEmployeeReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getPerformanceStats,

  // Training
  createTraining,
  getEmployeeTrainings,
  getTrainingById,
  updateTraining,
  deleteTraining,
  getTrainingStats,

  // Warnings
  createWarning,
  getEmployeeWarnings,
  getWarningById,
  updateWarning,
  acknowledgeWarning,
  deleteWarning,
  getWarningStats,

  // Shifts
  createShift,
  getShifts,
  getShiftById,
  updateShift,
  deleteShift,
  assignShift,
  getEmployeeAssignments,
  removeAssignment,
  getShiftStats,

  // Benefits
  createBenefit,
  getBenefits,
  getBenefitById,
  updateBenefit,
  deleteBenefit,
  enrollEmployee,
  getEmployeeEnrollments,
  updateEnrollment,
  getBenefitStats,

  // Goals
  createGoal,
  getGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  getGoalStats,

  // Feedback
  createFeedback,
  getFeedback,
  getFeedbackById,
  updateFeedback,
  deleteFeedback,
  getFeedbackStats,

  // Resignations
  createResignation,
  getResignations,
  getResignationById,
  updateResignation,
  getResignationStats,

  // Public Holidays
  getPublicHolidays,
  updatePublicHolidays
};
