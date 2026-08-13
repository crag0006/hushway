import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import RouteCompare from './pages/RouteCompare'
import RefugeMap from './pages/RefugeMap'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/explore" element={<RouteCompare />} />
      <Route path="/quietplace" element={<RefugeMap />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
