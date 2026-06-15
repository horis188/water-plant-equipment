import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import MainDashboardView from '../views/MainDashboardView.vue'
import DeviceManageView from '../views/DeviceManageView.vue'
import DeviceDetailView from '../views/DeviceDetailView.vue'
import SparepartsView from '../views/SparepartsView.vue'
import HandoverView from '../views/HandoverView.vue'
import WorkOrderView from '../views/WorkOrderView.vue'
import InspectionView from '../views/InspectionView.vue'
import InspectionAdminView from '../views/InspectionAdminView.vue'
import MaintenanceAdminView from '../views/MaintenanceAdminView.vue'
import AdminLayout from '../views/admin/AdminLayout.vue'
import PositionsView from '../views/admin/PositionsView.vue'
import ShiftsView from '../views/admin/ShiftsView.vue'
import TeamsView from '../views/admin/TeamsView.vue'
import UsersView from '../views/admin/UsersView.vue'
import PlaceholderView from '../views/admin/PlaceholderView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: MainDashboardView
    },
    {
      path: '/main',
      name: 'main',
      component: MainDashboardView
    },
    {
      path: '/device/inuse',
      name: 'device-inuse',
      component: DeviceManageView
    },
    {
      path: '/device/warning',
      name: 'device-warning',
      component: DeviceManageView
    },
    {
      path: '/device/maintenance',
      name: 'device-maintenance',
      component: DeviceManageView
    },
    {
      path: '/device/changes',
      name: 'device-changes',
      component: DeviceManageView
    },
    {
      path: '/device/detail/:id',
      name: 'device-detail',
      component: DeviceDetailView
    },
    {
      path: '/spareparts',
      name: 'spareparts',
      component: SparepartsView
    },
    {
      path: '/handover',
      name: 'handover',
      component: HandoverView
    },
    {
      path: '/workorder',
      name: 'workorder',
      component: WorkOrderView
    },
    {
      path: '/inspection',
      name: 'inspection',
      component: InspectionView
    },
    {
      path: '/inspection-admin',
      name: 'inspection-admin',
      component: InspectionAdminView
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: MaintenanceAdminView
    },
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAdmin: true },
      children: [
        { path: '', redirect: '/admin/positions' },
        { path: 'positions', name: 'admin-positions', component: PositionsView, meta: { title: '岗位字典', desc: '维护值班岗位 (一期制水/旧厂制水/...) 基础数据' } },
        { path: 'shifts', name: 'admin-shifts', component: ShiftsView, meta: { title: '班次时间配置', desc: '配置早班/日班/夜班的开始结束时间, 系统按配置自动判断当前班次' } },
        { path: 'teams', name: 'admin-teams', component: TeamsView, meta: { title: '班组配置', desc: '管理 A/B/C/D 班组及成员, 维护带班/值班人员' } },
        { path: 'users', name: 'admin-users', component: UsersView, meta: { title: '用户管理', desc: '增删改查用户, 重置密码, 启停账号, 绑定角色与岗位' } },
        { path: 'roles', name: 'admin-roles', component: PlaceholderView, meta: { title: '角色与权限', desc: '管理角色及权限点, 控制菜单/按钮可见性' } }
      ]
    }
  ]
})

// 路由守卫: 需系统管理人的页面
router.beforeEach((to, _from, next) => {
  if (to.meta?.requiresAdmin) {
    // 与 useDeviceStore.setCurrentUser 保持一致: sessionStorage + key 'currentUser'
    const raw = sessionStorage.getItem('currentUser')
    const u = raw ? JSON.parse(raw) : null
    if (!u || u.role !== '系统管理人') {
      alert('权限不足, 仅系统管理人可访问')
      return next('/main')
    }
  }
  next()
})

export default router
