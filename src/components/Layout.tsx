import { NavLink, Outlet } from 'react-router-dom'
import { exitDemo, isDemoChosen } from '../api/demo'
import { USE_MOCK } from '../config'
import { useAuth } from '../context/useAuth'
import { labelFor, navItemsFor, ROLE_LABEL } from '../routes/navigation'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <div className="layout">
      <header className="topbar">
        <NavLink to="/" className="brand">
          🍽️ APIResto
        </NavLink>
        <div className="user-box">
          <span>
            {user.name} · <span className="badge">{ROLE_LABEL[user.role]}</span>
          </span>
          <ThemeToggle />
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {USE_MOCK &&
        (isDemoChosen() ? (
          <div className="banner banner-info banner-demo">
            <span>Estás en la demo: datos de prueba guardados solo en este navegador.</span>
            <button type="button" className="btn btn-secondary" onClick={exitDemo}>
              Salir de la demo
            </button>
          </div>
        ) : (
          <div className="banner banner-info">Modo simulado: datos de prueba, sin conexión a la API.</div>
        ))}

      <div className="body">
        <nav className="sidebar" aria-label="Navegación principal">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          {navItemsFor(user.role).map((item) => (
            <NavLink key={item.path} to={item.path}>
              {labelFor(item, user.role)}
            </NavLink>
          ))}
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
