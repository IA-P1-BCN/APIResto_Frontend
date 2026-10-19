import { useEffect, type ComponentType } from 'react'
import { Route, Routes } from 'react-router-dom'
import { pingHealth } from './api/auth'
import { SET_PASSWORD_PATH } from './api/password'
import Layout from './components/Layout'
import { RequireAuth, RequireRole } from './components/ProtectedRoute'
import WakeUpBanner from './components/WakeUpBanner'
import { ConfirmProvider } from './context/ConfirmProvider'
import BarPage from './pages/BarPage'
import DashboardPage from './pages/DashboardPage'
import InvoicesPage from './pages/InvoicesPage'
import StatsPage from './pages/StatsPage'
import KitchenPage from './pages/KitchenPage'
import LoginPage from './pages/LoginPage'
import MenuPage from './pages/MenuPage'
import NotFoundPage from './pages/NotFoundPage'
import OrdersPage from './pages/OrdersPage'
import PlaceholderPage from './pages/PlaceholderPage'
import SocialCallbackPage from './pages/SocialCallbackPage'
import ReservationsPage from './pages/ReservationsPage'
import SecurityPage from './pages/SecurityPage'
import SetPasswordPage from './pages/SetPasswordPage'
import TablesPage from './pages/TablesPage'
import { NAV_ITEMS } from './routes/navigation'

const PAGES: Record<string, ComponentType> = {
  '/carta': MenuPage,
  '/mesas': TablesPage,
  '/reservas': ReservationsPage,
  '/pedidos': OrdersPage,
  '/cocina': KitchenPage,
  '/barra': BarPage,
  '/facturas': InvoicesPage,
  '/estadisticas': StatsPage,
  '/seguridad': SecurityPage,
}

export default function App() {
  useEffect(() => {
    pingHealth()
  }, [])

  return (
    <ConfirmProvider>
      <WakeUpBanner />
      <Routes>
        <Route path={SET_PASSWORD_PATH} element={<SetPasswordPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<SocialCallbackPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          {NAV_ITEMS.map((item) => {
            const Page = PAGES[item.path]
            return (
              <Route
                key={item.path}
                path={item.path}
                element={
                  <RequireRole roles={item.roles}>{Page ? <Page /> : <PlaceholderPage item={item} />}</RequireRole>
                }
              />
            )
          })}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ConfirmProvider>
  )
}
