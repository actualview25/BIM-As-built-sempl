import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

console.log('🚀 بدء تحميل التطبيق...');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 1, 11000
);
camera.position.set(0,0,0.1);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

let panoMesh = null;
const hotspotGroup = document.createElement('div');
document.body.appendChild(hotspotGroup);

const loader = new THREE.TextureLoader();

fetch('tour.json')
  .then(r => r.json())
  .then(data => {
    console.log('✅ تم تحميل JSON:', data);
    loadScene(data, 0);
  });

function loadScene(data, index){
  console.log('🔄 تحميل المشهد:', data[index].name);

  // تنظيف
  if (panoMesh) scene.remove(panoMesh);
  hotspotGroup.innerHTML = '';

  loader.load(data[index].image, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.SphereGeometry(5000, 60, 40);
    geometry.scale(-1,1,1); // مهم جداً

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide
    });

    panoMesh = new THREE.Mesh(geometry, material);
    scene.add(panoMesh);

    drawHotspots(data[index].hotspots || [], data);
  });
}

function drawHotspots(hotspots, data){
  hotspots.forEach(h => {
    const el = document.createElement('div');
    el.className = 'hotspot';
    el.onclick = () => loadScene(data, h.target);
    hotspotGroup.appendChild(el);

    h._el = el;
  });

  function update(){
    hotspots.forEach(h => {
      const v = new THREE.Vector3(h.x, h.y, h.z).project(camera);
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      h._el.style.left = x + 'px';
      h._el.style.top = y + 'px';
    });
  }

  renderer.setAnimationLoop(() => {
    update();
    renderer.render(scene, camera);
  });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
