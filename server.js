const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static(__dirname));
app.get('/health', (_req,res) => res.json({ok:true,rooms:rooms.size}));

function makeCode(){let code;do{code=Math.random().toString(36).slice(2,7).toUpperCase();}while(rooms.has(code));return code;}
function roomPlayers(code){const room=rooms.get(code);return room?[...room.players.values()]:[];}
function broadcastRoom(code){io.to(code).emit('room-update',{players:roomPlayers(code)});}

io.on('connection',socket=>{
  socket.on('create-room',(data,cb)=>{
    const code=makeCode();const name=String(data?.name||'Player').slice(0,16);
    rooms.set(code,{players:new Map()});socket.join(code);socket.data.room=code;
    rooms.get(code).players.set(socket.id,{id:socket.id,name,x:0,y:1,z:0,color:0x168bff});
    cb?.({ok:true,code,id:socket.id});broadcastRoom(code);
  });
  socket.on('join-room',(data,cb)=>{
    const code=String(data?.code||'').toUpperCase();const room=rooms.get(code);
    if(!room)return cb?.({ok:false,error:'Room not found. Check the code.'});
    if(room.players.size>=8)return cb?.({ok:false,error:'This room is full (8 players max).'});
    const name=String(data?.name||'Player').slice(0,16);
    socket.join(code);socket.data.room=code;
    room.players.set(socket.id,{id:socket.id,name,x:0,y:1,z:0,color:0xff65b8});
    cb?.({ok:true,code,id:socket.id});broadcastRoom(code);
  });
  socket.on('player-ready',data=>{const code=socket.data.room;if(!code)return;const p=rooms.get(code)?.players.get(socket.id);if(p&&data?.name)p.name=String(data.name).slice(0,16);broadcastRoom(code);});
  socket.on('move',data=>{
    const code=socket.data.room;if(!code||data?.roomCode!==code)return;
    const p=rooms.get(code)?.players.get(socket.id);if(!p)return;
    p.x=Number(data.x)||0;p.y=Number(data.y)||0;p.z=Number(data.z)||0;
    socket.to(code).emit('player-moved',p);
  });
  socket.on('finish',()=>{const code=socket.data.room;if(!code)return;const p=rooms.get(code)?.players.get(socket.id);if(p)io.to(code).emit('player-finished',{name:p.name});});
  socket.on('restart-player',()=>{const code=socket.data.room;if(!code)return;const p=rooms.get(code)?.players.get(socket.id);if(p){p.x=0;p.y=1;p.z=0;broadcastRoom(code);}});
  socket.on('disconnect',()=>{
    const code=socket.data.room;if(!code)return;const room=rooms.get(code);if(!room)return;
    room.players.delete(socket.id);if(room.players.size===0)rooms.delete(code);else broadcastRoom(code);
  });
});
server.listen(PORT,()=>console.log(`OBBY RACE server running at http://localhost:${PORT}`));
