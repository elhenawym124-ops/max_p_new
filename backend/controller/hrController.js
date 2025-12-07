/**
 * 👥 HR Controller
 * API endpoints لإدارة الموارد البشرية
 */

const {
  employeeService,
  departmentService,
  attendanceService,
  leaveService,
  payrollService
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
  syncUsersToEmployees
};
