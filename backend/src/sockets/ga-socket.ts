import { Server } from "socket.io";

export function setupSocket(io: Server) {
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });

    // Client can request to join a specific schedule room
    socket.on("join_schedule", (jadwalMasterId: number) => {
      socket.join(`schedule_${jadwalMasterId}`);
      console.log(`📋 Client ${socket.id} joined schedule room: ${jadwalMasterId}`);
    });

    socket.on("leave_schedule", (jadwalMasterId: number) => {
      socket.leave(`schedule_${jadwalMasterId}`);
    });
  });
}
