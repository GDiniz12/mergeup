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

// Tipagem da Sala
interface RoomData {
  players: string[];
  config: any; // RoomConfig do frontend
  rematchVotes: string[];
}

const rooms: { [key: string]: RoomData } = {};

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Pega o ID da sala pela URL que o frontend passou
  const roomId = socket.handshake.query.id as string;
  if (!roomId) {
    socket.disconnect();
    return;
  }

  // Cria a sala se não existir
  if (!rooms[roomId]) {
    rooms[roomId] = { players: [], config: null, rematchVotes: [] };
  }

  const room = rooms[roomId];

  // Limite de 2 jogadores
  if (room.players.length >= 2) {
    socket.emit("error", "A sala já está cheia.");
    return;
  }

  room.players.push(socket.id);
  socket.join(roomId);
  console.log(`Player ${socket.id} joined room ${roomId}`);

  // Quando os 2 jogadores entrarem, avise a todos na sala para começar
  if (room.players.length === 2) {
    io.to(roomId).emit("opponent_connected");
    // Se o criador da sala já tiver enviado a configuração, repassa ao novo jogador
    if (room.config) {
      io.to(roomId).emit("room_config", room.config);
    }
  } else {
    socket.emit("waiting", { message: "Aguardando oponente..." });
  }

  // Recebe a configuração da sala do dono e compartilha
  socket.on("set_room_config", (config) => {
    if (rooms[roomId]) {
      rooms[roomId].config = config;
      socket.to(roomId).emit("room_config", config);
    }
  });

  // Atualização em tempo real de ambos o jogo e o score
  socket.on("game_state", (data: { gameboard: number[][], score: number }) => {
    socket.to(roomId).emit("opponent_game_state", data);
  });

  // Notifica o outro jogador que alguém ganhou ou perdeu
  socket.on("game_over", (data: { reason: string }) => {
    socket.to(roomId).emit("opponent_game_over", data);
  });

  // Sistema de Revanche
  socket.on("rematch_vote", () => {
    if (rooms[roomId] && !rooms[roomId].rematchVotes.includes(socket.id)) {
      rooms[roomId].rematchVotes.push(socket.id);
      
      // Avisa o adversário que o jogador atual quer revanche
      socket.to(roomId).emit("opponent_rematch_vote");

      // Se os dois votaram, cria uma nova sala automaticamente
      if (rooms[roomId].rematchVotes.length === 2) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let newRoomId = '';
        for (let i = 0; i < 8; i++) newRoomId += chars.charAt(Math.floor(Math.random() * chars.length));

        // Envia o redirecionamento com a mesma configuração de jogo
        io.to(roomId).emit("rematch_start", { newRoomId, config: rooms[roomId].config });
      }
    }
  });

  // Desconexão
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    if (rooms[roomId]) {
      rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
      socket.to(roomId).emit("opponent_disconnected");
      
      // Limpa a sala se ficar vazia
      if (rooms[roomId].players.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

server.listen(process.env.PORT || 3001, () => {
  console.log("Running in port: " + (process.env.PORT || 3001));
});