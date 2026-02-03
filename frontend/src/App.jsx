import { HashRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Drivers from "./pages/Drivers.jsx";
import Trips from "./pages/Trips.jsx";
import FleetTrucks from "./pages/FleetTrucks.jsx";
import FleetPranchas from "./pages/FleetPranchas.jsx";
import Costs from "./pages/Costs.jsx";
import MainLayout from "./layouts/MainLayout.jsx";
import ExportarDados from "./pages/ExportarDados.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  console.log("App Version: 1.0.2 - Fixed Storage Import");
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/motoristas" element={<Drivers />} />
            <Route path="/viagens" element={<Trips />} />
            <Route path="/frota/caminhoes" element={<FleetTrucks />} />
            <Route path="/frota/pranchas" element={<FleetPranchas />} />
            <Route path="/custos" element={<Costs />} />
            <Route path="/exportar" element={<ExportarDados />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
