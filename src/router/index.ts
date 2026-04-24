import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import MainDashboardView from '../views/MainDashboardView.vue'
import DeviceManageView from '../views/DeviceManageView.vue'
import DeviceDetailView from '../views/DeviceDetailView.vue'
import SparepartsView from '../views/SparepartsView.vue'
import WorkOrderView from '../views/WorkOrderView.vue'
import InspectionView from '../views/InspectionView.vue'

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
      path: '/workorder',
      name: 'workorder',
      component: WorkOrderView
    },
    {
      path: '/inspection',
      name: 'inspection',
      component: InspectionView
    }
  ]
})

export default router
