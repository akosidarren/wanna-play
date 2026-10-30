import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const socket = window.io ? io() : null;
const menu = document.querySelector('#menu');
const statusEl = document.querySelector('#status');
const joinFields = document.querySelector('#joinFields');
const roomLabel = document.querySelector('#roomLabel');
const playerCount = document.querySelector('#playerCount');
const raceStatus = document.querySelector('#raceStatus');
const finishModal = document.querySelector('#finishModal');
const toastEl = document.querySelector('#toast');

let scene, camera, renderer, clock, localPlayer, roomCode = null, myId = null;
let players = new Map(), keys = {}, mobile = {}, velocityY = 0, grounded = false;
let checkpoint = new THREE.Vector3(0, 1, 0), finished = false, lastSend = 0;
const courseEnd = 92;
const mats = {
  blue: new THREE.MeshStandardMaterial({color:0x168bff,roughness:.55}),
  pink: new THREE.MeshStandardMaterial({color:0xff65b8,roughness:.55}),
  dark: new THREE.MeshStandardMaterial({color:0x172b4d,roughness:.8}),
  white: new THREE.MeshStandardMaterial({color:0xf4f7ff,roughness:.65}),
  gold: new THREE.MeshStandardMaterial({color:0xffd34f,roughness:.5}),
  green: new THREE.MeshStandardMaterial({color:0x42d99b,roughness:.6}),
  hazard: new THREE.MeshStandardMaterial({color:0xff4f72,roughness:.5})
};

function makeAvatar(name, color=0x168bff, isLocal=false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color,roughness:.65});
  const skin = new THREE.MeshStandardMaterial({color:0xffd2b5});
  const head = new THREE.Mesh(new THREE.BoxGeometry(.72,.72,.72), skin); head.position.y=1.65; group.add(head);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.82,.9,.42), bodyMat); torso.position.y=.95; group.add(torso);
  const legs = [];
  for (const x of [-.23,.23]) { const leg=new THREE.Mesh(new THREE.BoxGeometry(.28,.62,.32),mats.dark); leg.position.set(x,.28,0); group.add(leg); legs.push(leg); }
  for (const x of [-.52,.52]) { const arm=new THREE.Mesh(new THREE.BoxGeometry(.24,.72,.28),bodyMat); arm.position.set(x,1.0,0); group.add(arm); }
  const hair = new THREE.Mesh(new THREE.BoxGeometry(.76,.2,.76), new THREE.MeshStandardMaterial({color:isLocal?0x20243a:0x482b39}));
  hair.position.y=2.04; group.add(hair);
  const label = makeLabel(name); label.position.y=2.45; group.add(label);
  group.userData.legs=legs; return group;
}
function makeLabel(text) {
  const c=document.createElement('canvas'); c.width=256;c.height=64;
  const ctx=c.getContext('2d');ctx.fillStyle='rgba(20,40,90,.78)';ctx.beginPath();ctx.roundRect(4,4,248,56,20);ctx.fill();
  ctx.font='bold  thirty 30px system-ui';ctx.font='bold 30px system-ui';ctx.textAlign='center';ctx.fillStyle='white';ctx.fillText(text.slice(0,16),128,43);
  const tex=new THREE.CanvasTexture(c);const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true}));spr.scale.set(2.3,.58,1);return spr;
}
function box(x,y,z,sx,sy,sz,mat,collide=true) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  if(collide) platforms.push({x,z,sx,sz,top:y+sy/2,mesh}); return mesh;
}
let platforms=[], hazards=[];
function buildWorld() {
  scene=new THREE.Scene();scene.background=new THREE.Color(0x8bd8ff);scene.fog=new THREE.Fog(0x8bd8ff,45,150);
  camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,250);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff,0x5684b4,2));
  const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-20,35,25);sun.castShadow=true;scene.add(sun);
  const floorMat=new THREE.MeshStandardMaterial({color:0x5fcae8,roughness:1});
  box(0,-1.2,courseEnd/2,18,1,courseEnd+30,floorMat,false);
  // Floating pastel course platforms.
  box(0,0,0,9,1,9,mats.blue);
  const path=[
    [0,0,8,5,1,5],[3,0,15,4,1,4],[-2,0,22,4,1,4],[2,0,29,4,1,4],
    [0,0,36,6,1,5],[4,0,44,4,1,4],[-1,0,51,4,1,4],[2,0,58,4,1,4],
    [0,0,66,6,1,5],[-3,0,74,4,1,4],[1,0,81,4,1,4],[0,0,90,10,1,8]
  ];
  path.forEach((p,i)=>box(...p,[mats.blue,mats.pink,mats.white][i%3]));
  // Low hurdles and spinning-style hazard bars.
  for(let i=0;i<6;i++){
    const z=12+i*12; const h=box(i%2?1:-1,.75,z,2.4,1.5,.7,mats.hazard,false);hazards.push({mesh:h,z,r:1.5});
  }
  // Checkpoint pads.
  [36,66].forEach(z=>{const pad=new THREE.Mesh(new THREE.CylinderGeometry(1.15,.9,.18,24),mats.green);pad.position.set(0,.62,z);scene.add(pad);});
  // Finish arch.
  box(-4,2,94,.7,4,.7,mats.gold,false);box(4,2,94,.7,4,.7,mats.gold,false);box(0,4,94,8,.6,.7,mats.gold,false);
  const flag=makeLabel('🏁 FINISH');flag.position.set(0,5,94);flag.scale.set(4,.9,1);scene.add(flag);
  for(let i=0;i<35;i++){const cloud=new THREE.Mesh(new THREE.SphereGeometry(1.8+Math.random()*1.8,12,10),new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.7}));cloud.position.set((Math.random()-.5)*65,12+Math.random()*18,Math.random()*105);scene.add(cloud);}
  clock=new THREE.Clock();
}
function addLocal(name) {localPlayer=makeAvatar(name,0x168bff,true);scene.add(localPlayer);localPlayer.position.copy(checkpoint);}
function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),1900);}
function startGame(code, name) {
  roomCode=code;roomLabel.textContent=code==='SOLO'?'SOLO MODE':'ROOM '+code;menu.classList.add('hidden');
  buildWorld();
  addLocal(name);
  if(socket?.connected){socket.emit('player-ready',{roomCode,name,color:0x168bff});}
  animate();
}
function showStatus(msg){statusEl.textContent=msg;}
document.querySelector('#createBtn').onclick=()=>{
  const name=document.querySelector('#playerName').value.trim()||'daa';
  if(!socket?.connected){startGame('SOLO',name);toast('Solo race started. Multiplayer needs the game server.');return;}
  socket.emit('create-room',{name},res=>{if(!res?.ok){showStatus(res?.error||'Could not create room.');return;}myId=res.id;startGame(res.code,name);});
};
document.querySelector('#joinBtn').onclick=()=>joinFields.classList.toggle('hidden');
document.querySelector('#confirmJoinBtn').onclick=()=>{
  const name=document.querySelector('#playerName').value.trim()||'lalaaa';const code=document.querySelector('#roomCode').value.trim().toUpperCase();
  if(!socket?.connected)return showStatus('Server unavailable. Run npm start to join a room.');
  socket.emit('join-room',{code,name},res=>{if(!res?.ok){showStatus(res?.error||'Could not join room.');return;}myId=res.id;startGame(code,name);});
};
document.querySelector('#leaveBtn').onclick=()=>location.reload();
document.querySelector('#restartBtn').onclick=()=>{finishModal.classList.add('hidden');finished=false;checkpoint.set(0,1,0);localPlayer.position.copy(checkpoint);velocityY=0;if(socket?.connected)socket.emit('restart-player',{roomCode});};
socket?.on('connect',()=>{document.querySelector('#createBtn').textContent='Create Room';showStatus('Connected! Create a room or join a friend.');});
socket?.on('connect_error',()=>{document.querySelector('#createBtn').textContent='Play Solo';showStatus('Server unavailable. Play Solo works; run npm start for multiplayer.');});
socket?.on('room-update',data=>{
  playerCount.textContent=`${data.players.length}/8 players`;
  data.players.forEach(p=>{
    if(p.id===socket.id)return;
    if(!players.has(p.id)){const av=makeAvatar(p.name,p.color||0xff65b8);scene.add(av);players.set(p.id,av);}
    const av=players.get(p.id);av.position.set(p.x,p.y,p.z);
  });
  for(const [id,av] of players){if(!data.players.some(p=>p.id===id)){scene.remove(av);players.delete(id);}}
});
socket?.on('player-moved',p=>{if(p.id===socket.id)return;let av=players.get(p.id);if(av)av.position.set(p.x,p.y,p.z);});
socket?.on('player-finished',p=>toast(`${p.name} reached the finish! 🏆`));
socket?.on('room-error',msg=>showStatus(msg));

function inputVector(){
  const f=(keys.KeyW||keys.ArrowUp||mobile.forward?1:0)-(keys.KeyS||keys.ArrowDown||mobile.back?1:0);
  const r=(keys.KeyD||keys.ArrowRight||mobile.right?1:0)-(keys.KeyA||keys.ArrowLeft||mobile.left?1:0);
  return new THREE.Vector3(r,0,f).normalize();
}
function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);
  if(!localPlayer)return;
  const dir=inputVector();localPlayer.position.x+=dir.x*8*dt;localPlayer.position.z+=dir.z*8*dt;
  localPlayer.position.x=THREE.MathUtils.clamp(localPlayer.position.x,-7,7);
  if((keys.Space||mobile.jump)&&grounded){velocityY=9.5;grounded=false;}
  velocityY-=22*dt;localPlayer.position.y+=velocityY*dt;
  grounded=false;
  // Basic platform collision based on player's footprint.
  for(const p of platforms){
    const inside=Math.abs(localPlayer.position.x-p.x)<p.sx/2+.25 && Math.abs(localPlayer.position.z-p.z)<p.sz/2+.25;
    const feet=localPlayer.position.y;
    if(inside&&velocityY<=0&&feet>=p.top-.12&&feet<=p.top+.35){localPlayer.position.y=p.top;velocityY=0;grounded=true;}
  }
  if(localPlayer.position.y< -8){localPlayer.position.copy(checkpoint);velocityY=0;toast('Oops! Back to checkpoint.');}
  if(localPlayer.position.z>34&&checkpoint.z<30){checkpoint.set(0,1,36);toast('Checkpoint reached!');}
  if(localPlayer.position.z>64&&checkpoint.z<60){checkpoint.set(0,1,66);toast('Checkpoint reached!');}
  hazards.forEach(h=>{if(Math.abs(localPlayer.position.z-h.z)<.65&&Math.abs(localPlayer.position.x-h.mesh.position.x)<1.5&&localPlayer.position.y<2.4){localPlayer.position.copy(checkpoint);velocityY=0;toast('Obstacle hit! Try again.');}});
  if(localPlayer.position.z>=courseEnd&&!finished){finished=true;finishModal.classList.remove('hidden');document.querySelector('#winnerText').textContent='You crossed the finish line!';if(socket?.connected)socket.emit('finish',{roomCode});}
  camera.position.lerp(new THREE.Vector3(localPlayer.position.x,localPlayer.position.y+7,localPlayer.position.z-11),.09);camera.lookAt(localPlayer.position.x,localPlayer.position.y+1,localPlayer.position.z+3);
  if(socket?.connected&&performance.now()-lastSend>50){lastSend=performance.now();socket.emit('move',{roomCode,x:localPlayer.position.x,y:localPlayer.position.y,z:localPlayer.position.z});}
  renderer.render(scene,camera);
}
addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
addEventListener('keyup',e=>keys[e.code]=false);
document.querySelectorAll('[data-move]').forEach(btn=>{
  const key=btn.dataset.move;const on=()=>mobile[key]=true;const off=()=>mobile[key]=false;
  btn.addEventListener('pointerdown',e=>{e.preventDefault();on();});['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev,off));
});
const jump=document.querySelector('#jumpBtn');jump.addEventListener('pointerdown',e=>{e.preventDefault();mobile.jump=true;});['pointerup','pointerleave','pointercancel'].forEach(ev=>jump.addEventListener(ev,()=>mobile.jump=false));
addEventListener('resize',()=>{if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
