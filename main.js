import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

console.log('🚀 بدء تحميل التطبيق...');

let scene, camera, renderer, sphere;
let currentData = [];
const hotspotLayer = document.createElement('div');
document.body.appendChild(hotspotLayer);

init();

function init(){
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75, window.innerWidth/window.innerHeight, 1, 11000
  );
  camera.position.set(0,0,0.1);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  fetch('tour.json')
    .then(r => r.json())
    .then(data => {
      console.log('✅ تم تحميل JSON:', data);
      currentData = data;
      loadScene(0);
      animate();
    })
    .catch(err => console.error('❌ فشل تحميل JSON:', err));
}

function loadScene(index){
  console.log('🔄 تحميل المشهد:', currentData[index].name);

  hotspotLayer.innerHTML = '';
  if (sphere) scene.remove(sphere);

  const loader = new THREE.TextureLoader();
  loader.load(currentData[index].image, texture => {

    texture.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.SphereGeometry(5000, 64, 48);
    geo.scale(-1,1,1);

    const mat = new THREE.MeshBasicMaterial({ map:texture });
    sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    createHotspots(currentData[index].hotspots || []);
  });
}

function createHotspots(hotspots){
  hotspots.forEach(h => {
    const el = document.createElement('div');
    el.className = 'hotspot';
    el.onclick = () => loadScene(h.target);
    hotspotLayer.appendChild(el);
    h._el = el;
  });
}

function updateHotspots(){
  currentData.forEach(sceneData=>{
    (sceneData.hotspots||[]).forEach(h=>{
      if(!h._el) return;
      const v = new THREE.Vector3(h.x,h.y,h.z).project(camera);
      h._el.style.left = (v.x*0.5+0.5)*innerWidth+'px';
      h._el.style.top  = (-v.y*0.5+0.5)*innerHeight+'px';
    });
  });
}

function animate(){
  requestAnimationFrame(animate);
  updateHotspots();
  renderer.render(scene,camera);
}

window.addEventListener('resize',()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
