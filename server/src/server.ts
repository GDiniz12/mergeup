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

io.on("connection", (socket) => {
  socket.on("gameboard", (msg) => {
    console.log("Message received: " + msg);
  });
});

server.listen(process.env.PORT, () => {
  console.log("Running in port: " + process.env.PORT);
})