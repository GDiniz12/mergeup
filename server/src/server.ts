import { Server } from "socket.io";
import express from "express";
import http from "node:http";
import "dotenv/config";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL, 
    methods: ["GET", "POST"]
  }
});

interface PlayerRoom {
  players: string[];
  ready: { [key: string]: boolean };
}

const rooms: { [key: string]: PlayerRoom } = {};
let waitingPlayer: string | null = null;

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Find or create a room for the player
  if (!waitingPlayer) {
    waitingPlayer = socket.id;
    socket.emit("waiting", { message: "Waiting for opponent..." });
    console.log("Player waiting for opponent:", socket.id);
  } else {
    const roomId = `room-${waitingPlayer}-${socket.id}`;
    rooms[roomId] = {
      players: [waitingPlayer, socket.id],
      ready: { [waitingPlayer]: false, [socket.id]: false }
    };

    io.to(waitingPlayer).emit("opponent_connected", { opponentId: socket.id });
    socket.emit("opponent_connected", { opponentId: waitingPlayer });

    io.to(waitingPlayer).socketsJoin(roomId);
    socket.join(roomId);

    console.log("Room created:", roomId);
    waitingPlayer = null;
  }

  socket.on("gameboard", (gameboard: number[][]) => {
    const playerRoom = Object.values(rooms).find(room => room.players.includes(socket.id));
    if (playerRoom) {
      const opponentId = playerRoom.players.find(id => id !== socket.id);
      if (opponentId) {
        io.to(opponentId).emit("opponent_gameboard", { gameboard });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    
    if (socket.id === waitingPlayer) {
      waitingPlayer = null;
    }

    const roomId = Object.keys(rooms).find(id => rooms[id].players.includes(socket.id));
    if (roomId) {
      const playerRoom = rooms[roomId];
      const opponentId = playerRoom.players.find(id => id !== socket.id);
      if (opponentId) {
        io.to(opponentId).emit("opponent_disconnected");
      }
      delete rooms[roomId];
    }
  });
});

server.listen(process.env.PORT, () => {
  console.log("Running in port: " + process.env.PORT);
})