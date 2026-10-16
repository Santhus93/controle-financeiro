import { lazy, Suspense } from 'react'
import { Login } from './components/Login'
import { useAuth } from './contexts/AuthContext'
import './App.css'

// O painel (Firestore, gráficos e componentes) só é baixado depois do login.
const Dashboard = lazy(() => import('./Dashboard'))

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-spinner" />
      <strong>{label}</strong>
    </div>
  )
}

function App() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen label="Verificando acesso..." />
  if (!user) return <Login />

  return (
    <Suspense fallback={<LoadingScreen label="Carregando suas faturas..." />}>
      <Dashboard />
    </Suspense>
  )
}

export default App
