import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ViewerProvider } from './context/ViewerContext'
import CategoryPage from './pages/CategoryPage'
import Dashboard from './pages/Dashboard'
import Insights from './pages/Insights'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <ViewerProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/:categoria" element={<CategoryPage />} />
            <Route path="/insights" element={<Insights />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ViewerProvider>
    </BrowserRouter>
  )
}
