/**
 * 👥 HR Services Index
 * تصدير جميع خدمات الموارد البشرية
 */

const employeeService = require('./employeeService');
const departmentService = require('./departmentService');
const attendanceService = require('./attendanceService');
const leaveService = require('./leaveService');
const payrollService = require('./payrollService');

module.exports = {
  employeeService,
  departmentService,
  attendanceService,
  leaveService,
  payrollService
};
