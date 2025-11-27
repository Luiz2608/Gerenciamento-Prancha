import express from "express";
import { login } from "../controllers/authController.js";
import { authMiddleware } from "../utils/auth.js";
import { listDrivers, getDriver, createDriver, updateDriver, deleteDriver } from "../controllers/driverController.js";
import { listTrips, getTrip, createTrip, updateTrip, deleteTrip } from "../controllers/tripController.js";
import { dashboard } from "../controllers/dashboardController.js";
import { listDestinations, createDestination, deleteDestination, listServiceTypes, createServiceType, deleteServiceType, getTruck, updateTruck, backup } from "../controllers/adminController.js";
import { exportCsv, exportPdf } from "../controllers/exportController.js";

const router = express.Router();

router.post("/auth/login", login);

router.get("/dashboard", authMiddleware, dashboard);

router.get("/drivers", authMiddleware, listDrivers);
router.get("/drivers/:id", authMiddleware, getDriver);
router.post("/drivers", authMiddleware, createDriver);
router.put("/drivers/:id", authMiddleware, updateDriver);
router.delete("/drivers/:id", authMiddleware, deleteDriver);

router.get("/trips", authMiddleware, listTrips);
router.get("/trips/:id", authMiddleware, getTrip);
router.post("/trips", authMiddleware, createTrip);
router.put("/trips/:id", authMiddleware, updateTrip);
router.delete("/trips/:id", authMiddleware, deleteTrip);

router.get("/export/csv", authMiddleware, exportCsv);
router.get("/export/pdf", authMiddleware, exportPdf);

router.get("/admin/destinations", authMiddleware, listDestinations);
router.post("/admin/destinations", authMiddleware, createDestination);
router.delete("/admin/destinations/:id", authMiddleware, deleteDestination);

router.get("/admin/service-types", authMiddleware, listServiceTypes);
router.post("/admin/service-types", authMiddleware, createServiceType);
router.delete("/admin/service-types/:id", authMiddleware, deleteServiceType);

router.get("/admin/truck", authMiddleware, getTruck);
router.put("/admin/truck", authMiddleware, updateTruck);
router.get("/admin/backup", authMiddleware, backup);

export default router;

