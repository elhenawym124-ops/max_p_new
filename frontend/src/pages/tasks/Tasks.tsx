import React, { useState, useEffect } from 'react';
import { buildApiUrl } from '../../utils/urlHelper';
import { useCurrency } from '../../hooks/useCurrency';
import { useDateFormat } from '../../hooks/useDateFormat';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  EyeIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  UserIcon,
  CalendarIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface Task {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: string;
  assignedTo: string;
  assignedToName: string;
  createdBy: string;
  createdByName: string;
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
  progress: number;
  tags: string[];
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  priority: 'low' | 'medium' | 'high';
  startDate: string;
  endDate: string;
  budget: number;
  spentBudget: number;
  progress: number;
  managerId: string;
  managerName: string;
  teamMembers: string[];
  tags: string[];
  createdAt: string;
}

const Tasks: React.FC = () => {
  const { formatPrice } = useCurrency();
  const { formatDate } = useDateFormat();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');
  const [filters, setFilters] = useState({
    projectId: '',
    status: '',
    priority: '',
    assignedTo: '',
  });

  // Users state
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  
  // Project modals
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  
  // Edit states
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    startDate: '',
    endDate: '',
    budget: 0,
    managerId: '',
    teamMembers: [] as string[],
    tags: [] as string[],
  });

  const [newTask, setNewTask] = useState({
    projectId: '',
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    type: 'general',
    assignedTo: '1',
    assignedToName: 'أحمد المدير',
    createdBy: '1',
    createdByName: 'أحمد المدير',
    dueDate: '',
    estimatedHours: 0,
    tags: [] as string[],
  });

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    fetchUsers();
  }, [filters]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl('users'), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
        const token = localStorage.getItem('accessToken');

      const response = await fetch(buildApiUrl(`tasks?${queryParams}`) , {
        headers : {
          Authorization : `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
              const token = localStorage.getItem('accessToken');

      const response = await fetch(buildApiUrl('projects') , {
        headers : {
          Authorization : `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setProjects(data.data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const createTask = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl('tasks'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTask),
      });

      const data = await response.json();
      if (data.success) {
        fetchTasks();
        setShowCreateTaskModal(false);
        setNewTask({
          projectId: '',
          title: '',
          description: '',
          priority: 'medium',
          type: 'general',
          assignedTo: '1',
          assignedToName: 'أحمد المدير',
          createdBy: '1',
          createdByName: 'أحمد المدير',
          dueDate: '',
          estimatedHours: 0,
          tags: [],
        });
        alert('تم إنشاء المهمة بنجاح');
      } else {
        alert(data.error || 'فشل في إنشاء المهمة');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('فشل في إنشاء المهمة');
    }
  };

  const updateTaskStatus = async (taskId: string, status: string, progress?: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl(`tasks/${taskId}/status`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, progress }),
      });

      const data = await response.json();
      if (data.success) {
        fetchTasks();
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(data.data);
        }
        alert('تم تحديث حالة المهمة بنجاح');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('فشل في تحديث حالة المهمة');
    }
  };

  // Create Project
  const createProject = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl('projects'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newProject),
      });

      const data = await response.json();
      if (data.success) {
        fetchProjects();
        setShowCreateProjectModal(false);
        setNewProject({
          name: '',
          description: '',
          priority: 'medium',
          startDate: '',
          endDate: '',
          budget: 0,
          managerId: '',
          teamMembers: [],
          tags: [],
        });
        alert('تم إنشاء المشروع بنجاح');
      } else {
        alert(data.error || 'فشل في إنشاء المشروع');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('فشل في إنشاء المشروع');
    }
  };

  // Update Task
  const updateTask = async () => {
    if (!editingTask) return;
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl(`tasks/${editingTask.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingTask),
      });

      const data = await response.json();
      if (data.success) {
        fetchTasks();
        setShowEditTaskModal(false);
        setEditingTask(null);
        alert('تم تحديث المهمة بنجاح');
      } else {
        alert(data.error || 'فشل في تحديث المهمة');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      alert('فشل في تحديث المهمة');
    }
  };

  // Delete Task
  const deleteTask = async (taskId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المهمة؟')) return;
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl(`tasks/${taskId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        fetchTasks();
        setShowTaskModal(false);
        setSelectedTask(null);
        alert('تم حذف المهمة بنجاح');
      } else {
        alert(data.error || 'فشل في حذف المهمة');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('فشل في حذف المهمة');
    }
  };

  // Update Project
  const updateProject = async () => {
    if (!editingProject) return;
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl(`projects/${editingProject.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingProject),
      });

      const data = await response.json();
      if (data.success) {
        fetchProjects();
        setShowEditProjectModal(false);
        setEditingProject(null);
        alert('تم تحديث المشروع بنجاح');
      } else {
        alert(data.error || 'فشل في تحديث المشروع');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('فشل في تحديث المشروع');
    }
  };

  // Delete Project
  const deleteProject = async (projectId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟')) return;
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(buildApiUrl(`projects/${projectId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        fetchProjects();
        setShowProjectModal(false);
        setSelectedProject(null);
        alert('تم حذف المشروع بنجاح');
      } else {
        alert(data.error || 'فشل في حذف المشروع');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('فشل في حذف المشروع');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'in_progress':
        return <ExclamationTriangleIcon className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckIcon className="h-5 w-5 text-green-500" />;
      case 'cancelled':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'في الانتظار';
      case 'in_progress':
        return 'قيد التنفيذ';
      case 'completed':
        return 'مكتمل';
      case 'cancelled':
        return 'ملغي';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'عاجل';
      case 'high':
        return 'عالي';
      case 'medium':
        return 'متوسط';
      case 'low':
        return 'منخفض';
      default:
        return priority;
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    return dueDate && new Date(dueDate) < new Date() && status !== 'completed';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <ClipboardDocumentListIcon className="h-8 w-8 text-indigo-600 mr-3" />
              إدارة المهام والمشاريع
            </h1>
            <p className="mt-2 text-gray-600">تنظيم ومتابعة المهام والمشاريع</p>
          </div>
          <div className="flex space-x-2 space-x-reverse">
            <button
              onClick={() => setShowCreateTaskModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              مهمة جديدة
            </button>
            <button
              onClick={() => setShowCreateProjectModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              مشروع جديد
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 space-x-reverse">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'tasks'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              المهام ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'projects'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              المشاريع ({projects.length})
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'tasks' && (
        <>
          {/* Filters */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المشروع
                </label>
                <select
                  value={filters.projectId}
                  onChange={(e) => setFilters({...filters, projectId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">جميع المشاريع</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الحالة
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">جميع الحالات</option>
                  <option value="pending">في الانتظار</option>
                  <option value="in_progress">قيد التنفيذ</option>
                  <option value="completed">مكتمل</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الأولوية
                </label>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters({...filters, priority: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">جميع الأولويات</option>
                  <option value="urgent">عاجل</option>
                  <option value="high">عالي</option>
                  <option value="medium">متوسط</option>
                  <option value="low">منخفض</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  المسؤول
                </label>
                <select
                  value={filters.assignedTo}
                  onChange={(e) => setFilters({...filters, assignedTo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">جميع المسؤولين</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => setFilters({ projectId: '', status: '', priority: '', assignedTo: '' })}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                إعادة تعيين
              </button>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المهمة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المشروع
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      المسؤول
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الحالة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الأولوية
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      التقدم
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      تاريخ الاستحقاق
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tasks.map((task) => (
                    <tr key={task.id} className={`hover:bg-gray-50 ${isOverdue(task.dueDate, task.status) ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {task.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {task.description.substring(0, 50)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <FolderIcon className="h-4 w-4 text-gray-400 mr-1" />
                          {task.projectName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <UserIcon className="h-4 w-4 text-gray-400 mr-1" />
                          {task.assignedToName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {getStatusIcon(task.status)}
                          <span className="mr-1">{getStatusText(task.status)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {getPriorityText(task.priority)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900 mr-2">
                            {task.progress}%
                          </div>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ width: `${task.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center text-sm ${isOverdue(task.dueDate, task.status) ? 'text-red-600' : 'text-gray-900'}`}>
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {task.dueDate ? 
                            formatDate(task.dueDate) : 
                            'غير محدد'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2 space-x-reverse">
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowTaskModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="عرض"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setShowEditTaskModal(true);
                            }}
                            className="text-yellow-600 hover:text-yellow-900"
                            title="تعديل"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-red-600 hover:text-red-900"
                            title="حذف"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                          {task.status === 'pending' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'in_progress')}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              بدء
                            </button>
                          )}
                          {task.status === 'in_progress' && (
                            <button
                              onClick={() => updateTaskStatus(task.id, 'completed')}
                              className="text-green-600 hover:text-green-900"
                            >
                              إكمال
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {tasks.length === 0 && (
              <div className="text-center py-12">
                <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">لا توجد مهام</h3>
                <p className="mt-1 text-sm text-gray-500">لم يتم العثور على مهام تطابق المعايير المحددة.</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'projects' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {projects.map((project) => (
              <div key={project.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    project.status === 'active' ? 'bg-green-100 text-green-800' :
                    project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    project.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {project.status === 'active' ? 'نشط' :
                     project.status === 'completed' ? 'مكتمل' :
                     project.status === 'planning' ? 'تخطيط' : 'متوقف'}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">{project.description}</p>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">التقدم:</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>المدير:</span>
                    <span>{project.managerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الميزانية:</span>
                    <span>{formatPrice(project.budget || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>المنفق:</span>
                    <span>{formatPrice(project.spentBudget || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>تاريخ الانتهاء:</span>
                    <span>{formatDate(project.endDate)}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1">
                  {project.tags.map((tag, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Project Actions */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-2 space-x-reverse">
                  <button
                    onClick={() => {
                      setSelectedProject(project);
                      setShowProjectModal(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-900"
                    title="عرض"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingProject(project);
                      setShowEditProjectModal(true);
                    }}
                    className="text-yellow-600 hover:text-yellow-900"
                    title="تعديل"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="text-red-600 hover:text-red-900"
                    title="حذف"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {projects.length === 0 && (
            <div className="text-center py-12">
              <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">لا توجد مشاريع</h3>
              <p className="mt-1 text-sm text-gray-500">لم يتم إنشاء أي مشاريع بعد.</p>
            </div>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">إنشاء مهمة جديدة</h3>
              <button onClick={() => setShowCreateTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="عنوان المهمة"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف *</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="وصف المهمة"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المشروع</label>
                  <select
                    value={newTask.projectId}
                    onChange={(e) => setNewTask({...newTask, projectId: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">بدون مشروع</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الأولوية</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">منخفض</option>
                    <option value="medium">متوسط</option>
                    <option value="high">عالي</option>
                    <option value="urgent">عاجل</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المسؤول</label>
                  <select
                    value={newTask.assignedTo}
                    onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {users.length > 0 ? users.map((user) => (
                      <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>
                    )) : (
                      <option value="">لا يوجد مستخدمين</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الساعات المقدرة</label>
                <input
                  type="number"
                  value={newTask.estimatedHours}
                  onChange={(e) => setNewTask({...newTask, estimatedHours: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="0"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2 space-x-reverse">
              <button
                onClick={() => setShowCreateTaskModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                إلغاء
              </button>
              <button
                onClick={createTask}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                إنشاء المهمة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">تفاصيل المهمة</h3>
              <button onClick={() => setShowTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-xl font-bold text-gray-900">{selectedTask.title}</h4>
                <p className="text-gray-600 mt-2">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">المشروع</span>
                  <p className="font-medium">{selectedTask.projectName}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">المسؤول</span>
                  <p className="font-medium">{selectedTask.assignedToName}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">الحالة</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTask.status)}`}>
                    {getStatusText(selectedTask.status)}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">الأولوية</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedTask.priority)}`}>
                    {getPriorityText(selectedTask.priority)}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">التقدم</span>
                  <div className="flex items-center mt-1">
                    <span className="font-medium mr-2">{selectedTask.progress}%</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${selectedTask.progress}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">تاريخ الاستحقاق</span>
                  <p className={`font-medium ${isOverdue(selectedTask.dueDate, selectedTask.status) ? 'text-red-600' : ''}`}>
                    {selectedTask.dueDate ? formatDate(selectedTask.dueDate) : 'غير محدد'}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">الساعات المقدرة</span>
                  <p className="font-medium">{selectedTask.estimatedHours} ساعة</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">الساعات الفعلية</span>
                  <p className="font-medium">{selectedTask.actualHours} ساعة</p>
                </div>
              </div>

              {selectedTask.tags && selectedTask.tags.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500">الوسوم</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedTask.tags.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => deleteTask(selectedTask.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                حذف المهمة
              </button>
              <div className="flex space-x-2 space-x-reverse">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  إغلاق
                </button>
                <button
                  onClick={() => {
                    setEditingTask(selectedTask);
                    setShowTaskModal(false);
                    setShowEditTaskModal(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  تعديل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditTaskModal && editingTask && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">تعديل المهمة</h3>
              <button onClick={() => setShowEditTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">العنوان *</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف *</label>
                <textarea
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                  <select
                    value={editingTask.status}
                    onChange={(e) => setEditingTask({...editingTask, status: e.target.value as 'pending' | 'in_progress' | 'completed' | 'cancelled'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pending">في الانتظار</option>
                    <option value="in_progress">قيد التنفيذ</option>
                    <option value="completed">مكتمل</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الأولوية</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({...editingTask, priority: e.target.value as 'low' | 'medium' | 'high' | 'urgent'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">منخفض</option>
                    <option value="medium">متوسط</option>
                    <option value="high">عالي</option>
                    <option value="urgent">عاجل</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">التقدم (%)</label>
                  <input
                    type="number"
                    value={editingTask.progress}
                    onChange={(e) => setEditingTask({...editingTask, progress: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0"
                    max="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={editingTask.dueDate ? editingTask.dueDate.split('T')[0] : ''}
                    onChange={(e) => setEditingTask({...editingTask, dueDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الساعات المقدرة</label>
                  <input
                    type="number"
                    value={editingTask.estimatedHours}
                    onChange={(e) => setEditingTask({...editingTask, estimatedHours: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الساعات الفعلية</label>
                  <input
                    type="number"
                    value={editingTask.actualHours}
                    onChange={(e) => setEditingTask({...editingTask, actualHours: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2 space-x-reverse">
              <button
                onClick={() => setShowEditTaskModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                إلغاء
              </button>
              <button
                onClick={updateTask}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">إنشاء مشروع جديد</h3>
              <button onClick={() => setShowCreateProjectModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المشروع *</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="اسم المشروع"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف *</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="وصف المشروع"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الأولوية</label>
                  <select
                    value={newProject.priority}
                    onChange={(e) => setNewProject({...newProject, priority: e.target.value as 'low' | 'medium' | 'high'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">منخفض</option>
                    <option value="medium">متوسط</option>
                    <option value="high">عالي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الميزانية</label>
                  <input
                    type="number"
                    value={newProject.budget}
                    onChange={(e) => setNewProject({...newProject, budget: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البدء</label>
                  <input
                    type="date"
                    value={newProject.startDate}
                    onChange={(e) => setNewProject({...newProject, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={newProject.endDate}
                    onChange={(e) => setNewProject({...newProject, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مدير المشروع</label>
                <select
                  value={newProject.managerId}
                  onChange={(e) => setNewProject({...newProject, managerId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">اختر المدير</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2 space-x-reverse">
              <button
                onClick={() => setShowCreateProjectModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                إلغاء
              </button>
              <button
                onClick={createProject}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                إنشاء المشروع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Details Modal */}
      {showProjectModal && selectedProject && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">تفاصيل المشروع</h3>
              <button onClick={() => setShowProjectModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-xl font-bold text-gray-900">{selectedProject.name}</h4>
                <p className="text-gray-600 mt-2">{selectedProject.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">الحالة</span>
                  <span className={`block mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedProject.status === 'active' ? 'bg-green-100 text-green-800' :
                    selectedProject.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    selectedProject.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedProject.status === 'active' ? 'نشط' :
                     selectedProject.status === 'completed' ? 'مكتمل' :
                     selectedProject.status === 'planning' ? 'تخطيط' : 'متوقف'}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">الأولوية</span>
                  <span className={`block mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedProject.priority)}`}>
                    {getPriorityText(selectedProject.priority)}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">المدير</span>
                  <p className="font-medium">{selectedProject.managerName}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">التقدم</span>
                  <div className="flex items-center mt-1">
                    <span className="font-medium mr-2">{selectedProject.progress}%</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${selectedProject.progress}%` }}></div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">الميزانية</span>
                  <p className="font-medium">{formatPrice(selectedProject.budget || 0)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">المنفق</span>
                  <p className="font-medium">{formatPrice(selectedProject.spentBudget || 0)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">تاريخ البدء</span>
                  <p className="font-medium">{selectedProject.startDate ? formatDate(selectedProject.startDate) : 'غير محدد'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">تاريخ الانتهاء</span>
                  <p className="font-medium">{selectedProject.endDate ? formatDate(selectedProject.endDate) : 'غير محدد'}</p>
                </div>
              </div>

              {selectedProject.tags && selectedProject.tags.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500">الوسوم</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedProject.tags.map((tag, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => deleteProject(selectedProject.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                حذف المشروع
              </button>
              <div className="flex space-x-2 space-x-reverse">
                <button
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  إغلاق
                </button>
                <button
                  onClick={() => {
                    setEditingProject(selectedProject);
                    setShowProjectModal(false);
                    setShowEditProjectModal(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  تعديل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProjectModal && editingProject && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">تعديل المشروع</h3>
              <button onClick={() => setShowEditProjectModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المشروع *</label>
                <input
                  type="text"
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف *</label>
                <textarea
                  value={editingProject.description}
                  onChange={(e) => setEditingProject({...editingProject, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                  <select
                    value={editingProject.status}
                    onChange={(e) => setEditingProject({...editingProject, status: e.target.value as 'planning' | 'active' | 'completed' | 'on_hold'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="planning">تخطيط</option>
                    <option value="active">نشط</option>
                    <option value="completed">مكتمل</option>
                    <option value="on_hold">متوقف</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الأولوية</label>
                  <select
                    value={editingProject.priority}
                    onChange={(e) => setEditingProject({...editingProject, priority: e.target.value as 'low' | 'medium' | 'high'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">منخفض</option>
                    <option value="medium">متوسط</option>
                    <option value="high">عالي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الميزانية</label>
                  <input
                    type="number"
                    value={editingProject.budget}
                    onChange={(e) => setEditingProject({...editingProject, budget: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المنفق</label>
                  <input
                    type="number"
                    value={editingProject.spentBudget}
                    onChange={(e) => setEditingProject({...editingProject, spentBudget: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البدء</label>
                  <input
                    type="date"
                    value={editingProject.startDate ? editingProject.startDate.split('T')[0] : ''}
                    onChange={(e) => setEditingProject({...editingProject, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    value={editingProject.endDate ? editingProject.endDate.split('T')[0] : ''}
                    onChange={(e) => setEditingProject({...editingProject, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التقدم (%)</label>
                <input
                  type="number"
                  value={editingProject.progress}
                  onChange={(e) => setEditingProject({...editingProject, progress: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2 space-x-reverse">
              <button
                onClick={() => setShowEditProjectModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                إلغاء
              </button>
              <button
                onClick={updateProject}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
