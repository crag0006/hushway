import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import RouteCompare from './pages/RouteCompare'
import RefugeMap from './pages/RefugeMap'
import Community from './pages/Community'
import Resources from './pages/Resources'
import Contact from './pages/Contact'
import SignIn from './pages/SignIn'
import Register from './pages/SignUp'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/explore" element={<RouteCompare />} />
      <Route path="/quietplace" element={<RefugeMap />} />
      <Route path="/community" element={<Community />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/register" element={<Register />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
