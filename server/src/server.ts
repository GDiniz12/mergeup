import { Server } from "socket.io";
import express from "express";
import http from "node:http";
import "dotenv/config";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*", 
    methods: ["GET", "POST"]
  }
});

interface RoomData {
  players: string[];
  config: any;
  rematchVotes: string[];
}

const rooms: { [key: string]: RoomData } = {};

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  const roomId = socket.handshake.query.id as string;
  if (!roomId) {
    socket.disconnect();
    return;
  }

  // Novo fluxo de entrada controlado
  socket.on("join_room", (data: { isCreator: boolean, config?: any, password?: string }) => {
    // Cria a sala se não existir
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], config: null, rematchVotes: [] };
    }
    const room = rooms[roomId];

    // O criador da sala ou de uma revanche sempre manda a config inicial
    if (data.isCreator && data.config) {
      room.config = data.config;
    }

    // Impede mais de 2 jogadores
    if (room.players.length >= 2 && !room.players.includes(socket.id)) {
      socket.emit("error", "A sala já está cheia.");
      return;
    }

    // Verificação de Senha
    if (room.config?.hasPassword && !data.isCreator) {
      if (!data.password) {
        socket.emit("require_password");
        return;
      }
      if (data.password !== room.config.password) {
        socket.emit("wrong_password");
        return;
      }
    }

    // Autenticado! Adiciona na sala
    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
      socket.join(roomId);
      console.log(`Player ${socket.id} joined room ${roomId}`);
    }

    // Se a sala encheu, começa o jogo
    if (room.players.length === 2) {
      // Define um timestamp absoluto para o fim da partida (se for por tempo)
      const timeLimit = room.config?.timeLimit || 60;
      const endTime = Date.now() + (timeLimit * 1000); 

      // Envia para ambos os jogadores que o oponente conectou e o tempo exato de fim
      io.to(roomId).emit("opponent_connected", { endTime });
      
      if (room.config) {
        io.to(roomId).emit("room_config", room.config);
      }
    } else {
      socket.emit("waiting", { message: "Aguardando oponente..." });
    }
  });

  socket.on("game_state", (data: { gameboard: number[][], score: number }) => {
    socket.to(roomId).emit("opponent_game_state", data);
  });

  socket.on("game_over", (data: { reason: string }) => {
    socket.to(roomId).emit("opponent_game_over", data);
  });

  socket.on("rematch_vote", () => {
    if (rooms[roomId] && !rooms[roomId].rematchVotes.includes(socket.id)) {
      rooms[roomId].rematchVotes.push(socket.id);
      socket.to(roomId).emit("opponent_rematch_vote");

      if (rooms[roomId].rematchVotes.length === 2) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let newRoomId = '';
        for (let i = 0; i < 8; i++) newRoomId += chars.charAt(Math.floor(Math.random() * chars.length));
        io.to(roomId).emit("rematch_start", { newRoomId, config: rooms[roomId].config });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    if (rooms[roomId] && rooms[roomId].players.includes(socket.id)) {
      rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
      socket.to(roomId).emit("opponent_disconnected");
      
      if (rooms[roomId].players.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log("Running in port: " + (process.env.PORT || 3001));
});