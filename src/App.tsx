import { useEffect, type ComponentType } from 'react'
import { Route, Routes } from 'react-router-dom'
import { pingHealth } from './api/auth'
import Layout from './components/Layout'
import { RequireAuth, RequireRole } from './components/ProtectedRoute'
import WakeUpBanner from './components/WakeUpBanner'
import { ConfirmProvider } from './context/ConfirmProvider'
import BarPage from './pages/BarPage'
import DashboardPage from './pages/DashboardPage'
import KitchenPage from './pages/KitchenPage'
import LoginPage from './pages/LoginPage'
import MenuPage from './pages/MenuPage'
import NotFoundPage from './pages/NotFoundPage'
import OrdersPage from './pages/OrdersPage'
import PlaceholderPage from './pages/PlaceholderPage'
import ReservationsPage from './pages/ReservationsPage'
import TablesPage from './pages/TablesPage'
import { NAV_ITEMS } from './routes/navigation'

const PAGES: Record<string, ComponentType> = {
  '/carta': MenuPage,
  '/mesas': TablesPage,
  '/reservas': ReservationsPage,
  '/pedidos': OrdersPage,
  '/cocina': KitchenPage,
  '/barra': BarPage,
}

export default function App() {
  useEffect(() => {
    pingHealth()
  }, [])

  return (
    <ConfirmProvider>
      <WakeUpBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
