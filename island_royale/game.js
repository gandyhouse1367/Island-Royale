import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const menu = document.querySelector('#menu');
const hud = document.querySelector('#hud');
const playBtn = document.querySelector('#playBtn');
const connection = document.querySelector('#connection');
const modeSelect = document.querySelector('#mode');
const toastEl = document.querySelector('#toast');
const isMobile = matchMedia('(pointer:coarse)').matches;

let scene, camera, renderer, clock, player, playerBody, yaw=0, pitch=0;
let keys={}, started=false, health=100, shield=50, ammo=30, reloading=false;
let socket=null, myId=null, players=new Map(), bots=[], buildings=[];
let buildMode=false, lastShot=0, stormRadius=92, stormTick=0, matchStartedAt=0;
const WORLD=220, raycaster=new THREE.Raycaster(), tempVec=new THREE.Vector3();

function say(msg){toastEl.textContent=msg;setTimeout(()=>{if(toastEl.textContent===msg)toastEl.textContent=''},2600)}
function setStatus(s){connection.textContent=s}
function connect(){
  const protocol=location.protocol==='https:'?'wss':'ws';
  const host=location.host||'localhost:3000';
  socket=new WebSocket(`${protocol}://${host}`);
  socket.onopen=()=>setStatus('Server connected • Ready to play');
  socket.onclose=()=>setStatus('Offline mode • Start the server for multiplayer');
  socket.onerror=()=>setStatus('Server unavailable • Offline practice is ready');
  socket.onmessage=(ev)=>{
    const msg=JSON.parse(ev.data);
    if(msg.type==='welcome'){myId=msg.id;syncPlayers(msg.players||[])}
    if(msg.type==='players')syncPlayers(msg.players||[]);
    if(msg.type==='joined'){say(`${msg.name} joined the island`);syncPlayers(msg.players||[])}
    if(msg.type==='left'){removeRemote(msg.id);syncPlayers(msg.players||[])}
    if(msg.type==='state'){syncPlayers(msg.players||[])}
  };
}
function send(data){if(socket&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
function syncPlayers(list){
  const seen=new Set();
  for(const p of list){if(p.id===myId)continue;seen.add(p.id);let r=players.get(p.id);if(!r){r=makeCharacter(0x28b9ff);scene.add(r.group);players.set(p.id,r)}
    r.target.set(p.x||0,0,p.z||0);r.name=p.name||'Player';}
  for(const [id,r] of players){if(!seen.has(id)){scene.remove(r.group);players.delete(id)}}
  document.querySelector('#alive').textContent=`ALIVE: ${Math.max(1,list.length+1)}`;
}
function removeRemote(id){const r=players.get(id);if(r){scene.remove(r.group);players.delete(id)}}

function makeCharacter(color){
  const group=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color,roughness:.75});
  const skin=new THREE.MeshStandardMaterial({color:0xf2bd91});
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.8,1.05,.42),mat);torso.position.y=1.25;group.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.29,16,12),skin);head.position.y=2.05;group.add(head);
  for(const x of [-.23,.23]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.25,.8,.3),new THREE.MeshStandardMaterial({color:0x263c62}));leg.position.set(x,.42,0);group.add(leg)}
  const r={group,target:new THREE.Vector3(),name:'Player'};return r;
}
function addTree(x,z){
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.25,.35,2.2,7),new THREE.MeshStandardMaterial({color:0x79502d}));trunk.position.set(x,1.1,z);scene.add(trunk);
  const crown=new THREE.Mesh(new THREE.ConeGeometry(1.6,3.5,7),new THREE.MeshStandardMaterial({color:0x247a45}));crown.position.set(x,3.7,z);scene.add(crown);
}
function addRock(x,z,s=1){
  const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),new THREE.MeshStandardMaterial({color:0x77818a,roughness:1}));m.position.set(x,s*.55,z);m.rotation.set(Math.random(),Math.random(),Math.random());scene.add(m);
}
function createWorld(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x8bd4f2);scene.fog=new THREE.Fog(0x8bd4f2,85,210);
  camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,500);
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;document.body.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xd9f4ff,0x58734b,2));
  const sun=new THREE.DirectionalLight(0xfff1d2,2.4);sun.position.set(-35,65,25);sun.castShadow=true;scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(WORLD,WORLD),new THREE.MeshStandardMaterial({color:0x5cae55,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  // Shoreline and shallow water
  const water=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.MeshStandardMaterial({color:0x259bd0,roughness:.25,metalness:.1}));water.rotation.x=-Math.PI/2;water.position.y=-.18;scene.add(water);
  const roadMat=new THREE.MeshStandardMaterial({color:0x666b6b});
  for(let i=0;i<3;i++){const road=new THREE.Mesh(new THREE.BoxGeometry(5,.04,70),roadMat);road.position.set(-35+i*35,.03,0);scene.add(road)}
  for(let i=0;i<90;i++){const x=(Math.random()-.5)*180,z=(Math.random()-.5)*180;if(Math.abs(x)<12&&Math.abs(z)<12)continue;addTree(x,z)}
  for(let i=0;i<35;i++){addRock((Math.random()-.5)*175,(Math.random()-.5)*175,.5+Math.random()*.9)}
  // small POI buildings
  const colors=[0xe0a45f,0xc9d2d7,0x9a7dce,0xd96b52];
  for(let i=0;i<9;i++){const x=(Math.random()-.5)*140,z=(Math.random()-.5)*140;const b=new THREE.Mesh(new THREE.BoxGeometry(7,4.5,7),new THREE.MeshStandardMaterial({color:colors[i%4]}));b.position.set(x,2.25,z);scene.add(b);const roof=new THREE.Mesh(new THREE.ConeGeometry(5.5,2.5,4),new THREE.MeshStandardMaterial({color:0x4a5264}));roof.position.set(x,5.7,z);roof.rotation.y=Math.PI/4;scene.add(roof)}
  player=makeCharacter(0xffc12e);scene.add(player.group);player.group.position.set(0,0,0);
  clock=new THREE.Clock();
}
function startGame(){
  if(started)return;started=true;menu.classList.add('hidden');hud.classList.remove('hidden');
  createWorld();matchStartedAt=Date.now();document.body.requestPointerLock?.();
  if(isMobile)document.querySelector('#mobileControls').classList.remove('hidden');
  animate();
  const name=document.querySelector('#playerName').value.trim()||'Player';
  send({type:'join',name,mode:modeSelect.value});
  say('You landed on the island. Find your gear!');
}
function shoot(){
  if(!started||ammo<=0||reloading)return;
  const now=performance.now();if(now-lastShot<180)return;lastShot=now;ammo--;document.querySelector('#ammo').textContent=`${ammo} / 90`;
  // Visual tracer
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);
  const start=camera.position.clone(),end=start.add(dir.multiplyScalar(55));
  const geo=new THREE.BufferGeometry().setFromPoints([camera.position.clone(),end]);
  const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffe18a}));scene.add(line);setTimeout(()=>scene.remove(line),65);
  send({type:'shot',x:player.group.position.x,z:player.group.position.z});
  if(ammo===0){reloading=true;say('Reloading…');setTimeout(()=>{ammo=30;reloading=false;document.querySelector('#ammo').textContent='30 / 90'},1300)}
}
function build(){
  if(modeSelect.value==='zero'){say('Building is disabled in Zero Build');return}
  const dir=new THREE.Vector3();camera.getWorldDirection(dir);const pos=player.group.position.clone().add(dir.multiplyScalar(5));pos.y=1.5;
  const piece=new THREE.Mesh(new THREE.BoxGeometry(4,.25,4),new THREE.MeshStandardMaterial({color:0x9b7652}));piece.position.copy(pos);piece.rotation.y=player.group.rotation.y;scene.add(piece);buildings.push(piece);say('Build piece placed');
}
function update(dt){
  if(!player)return;
  const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const move=new THREE.Vector3();if(keys.KeyW||keys.ArrowUp)move.add(forward);if(keys.KeyS||keys.ArrowDown)move.sub(forward);if(keys.KeyD||keys.ArrowRight)move.add(right);if(keys.KeyA||keys.ArrowLeft)move.sub(right);
  if(move.lengthSq())move.normalize().multiplyScalar(12*dt);
  player.group.position.add(move);player.group.position.x=THREE.MathUtils.clamp(player.group.position.x,-WORLD/2+5,WORLD/2-5);player.group.position.z=THREE.MathUtils.clamp(player.group.position.z,-WORLD/2+5,WORLD/2-5);
  player.group.rotation.y=yaw;player.group.position.y=0;
  const target=new THREE.Vector3(player.group.position.x+Math.sin(yaw)*8,5.2,player.group.position.z+Math.cos(yaw)*8);
  camera.position.lerp(target,.18);camera.lookAt(player.group.position.x,1.35,player.group.position.z);
  for(const r of players.values())r.group.position.lerp(r.target,.18);
  // Storm contracts over time; safe zone currently centered on origin.
  const elapsed=(Date.now()-matchStartedAt)/1000;stormRadius=Math.max(18,92-elapsed*.18);
  stormTick+=dt;if(stormTick>1){stormTick=0;if(Math.hypot(player.group.position.x,player.group.position.z)>stormRadius){health=Math.max(0,health-2);updateVitals();if(health===0){say('You were caught in the storm.');health=100;player.group.position.set(0,0,0)}}}
  document.querySelector('#matchInfo').textContent=`STORM: ${Math.round(stormRadius)}m`;
  if(socket&&socket.readyState===WebSocket.OPEN)send({type:'move',x:player.group.position.x,z:player.group.position.z,rotation:yaw});
}
function updateVitals(){document.querySelector('#healthText').textContent=health;document.querySelector('#shieldText').textContent=shield;document.querySelector('#healthBar').style.width=health+'%';document.querySelector('#shieldBar').style.width=shield*2+'%'}
function animate(){if(!started)return;requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);update(dt);renderer.render(scene,camera)}
playBtn.addEventListener('click',startGame);
window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyB')build();if(e.code==='Space')player?.group.position.setY(.25)});
window.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='Space'&&player)player.group.position.y=0});
window.addEventListener('mousemove',e=>{if(document.pointerLockElement){yaw-=e.movementX*.0025;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.002,-.8,.8)}});
window.addEventListener('mousedown',e=>{if(e.button===0&&started)shoot()});
window.addEventListener('resize',()=>{if(camera&&renderer){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}});
document.querySelector('#mobileFire').addEventListener('click',shoot);
document.querySelector('#mobileBuild').addEventListener('click',build);
document.querySelector('#joystick').addEventListener('touchstart',e=>{e.preventDefault();keys.KeyW=true},{passive:false});
document.querySelector('#joystick').addEventListener('touchend',()=>{keys.KeyW=false});
connect();
