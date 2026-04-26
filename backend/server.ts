import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

// Routes
import authRoutes from "./src/routes/auth.routes.ts";
import dashboardRoutes from "./src/routes/dashboard.routes.ts";
import waktuRoutes from "./src/routes/waktu.routes.ts";
import matkulRoutes from "./src/routes/matkul.routes.ts";
import dosenRoutes from "./src/routes/dosen.routes.ts";
import ruanganRoutes from "./src/routes/ruangan.routes.ts";
import preferensiRoutes from "./src/routes/preferensi.routes.ts";
import scheduleRoutes from "./src/routes/schedule.routes.ts";
import masterRoutes from "./src/routes/master.routes.ts";

// Socket
import { setupSocket } from "./src/sockets/ga-socket.ts";
import { setIoInstance } from "./src/controllers/schedule.controller.ts";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
  },
});

// Pass io to schedule controller
setIoInstance(io);

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/waktu", waktuRoutes);
app.use("/api/matkul", matkulRoutes);
app.use("/api/dosen", dosenRoutes);
app.use("/api/ruangan", ruanganRoutes);
app.use("/api/preferensi", preferensiRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/master", masterRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Socket.io setup
setupSocket(io);

// Start server
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 CBGA Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready on ws://localhost:${PORT}`);
  console.log(`\n📌 API Endpoints:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/dashboard/stats`);
  console.log(`   CRUD   /api/waktu`);
  console.log(`   CRUD   /api/matkul`);
  console.log(`   CRUD   /api/dosen`);
  console.log(`   CRUD   /api/ruangan`);
  console.log(`   CRUD   /api/preferensi`);
  console.log(`   POST   /api/schedule/generate`);
  console.log(`   GET    /api/schedule/result/:id`);
  console.log(`   PUT    /api/schedule/update-slot/:detailId`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
