import { HashRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Drivers from "./pages/Drivers.jsx";
import Trips from "./pages/Trips.jsx";
import History from "./pages/History.jsx";
import Admin from "./pages/Admin.jsx";
import FleetTrucks from "./pages/FleetTrucks.jsx";
import FleetPranchas from "./pages/FleetPranchas.jsx";
import HistoryTruck from "./pages/HistoryTruck.jsx";
import HistoryPrancha from "./pages/HistoryPrancha.jsx";
import Costs from "./pages/Costs.jsx";
import MainLayout from "./layouts/MainLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/motoristas" element={<Drivers />} />
            <Route path="/viagens" element={<Trips />} />
            <Route path="/historico" element={<History />} />
            <Route path="/historico-caminhao" element={<HistoryTruck />} />
            <Route path="/historico-prancha" element={<HistoryPrancha />} />
            <Route path="/frota/caminhoes" element={<FleetTrucks />} />
            <Route path="/frota/pranchas" element={<FleetPranchas />} />
            <Route path="/custos" element={<Costs />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
