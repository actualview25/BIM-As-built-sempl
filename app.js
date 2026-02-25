let scene, camera, renderer, sphere;
let currentSceneData = null;

const pathGroups = {
  EL: new THREE.Group(),
  WP: new THREE.Group(),
  AC: new THREE.Group()
};

init();
loadData();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 0.1);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  Object.values(pathGroups).forEach(g => scene.add(g));

  animate();
}

function loadData() {
  fetch("data.json")
    .then(res => res.json())
    .then(data => {
      buildSceneMenu(data.scenes);
      loadScene(data.scenes[0]);
    });
}

function buildSceneMenu(scenes) {
  const menu = document.getElementById("sceneMenu");
  menu.innerHTML = "";

  scenes.forEach(sceneData => {
    const btn = document.createElement("button");
    btn.textContent = sceneData.name;
    btn.onclick = () => loadScene(sceneData);
    menu.appendChild(btn);
  });
}

function loadScene(sceneData) {
  currentSceneData = sceneData;

  // remove old sphere
  if (sphere) {
    scene.remove(sphere);
    sphere.geometry.dispose();
  }

  // clear paths
  Object.values(pathGroups).forEach(group => {
    group.clear();
  });

  // panorama
  const geometry = new THREE.SphereGeometry(50, 64, 64);
  geometry.scale(-1, 1, 1);

  const texture = new THREE.TextureLoader().load(sceneData.image);
  const material = new THREE.MeshBasicMaterial({ map: texture });

  sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // draw paths
  sceneData.paths.forEach(path => drawPath(path));
}

function drawPath(path) {
  const group = pathGroups[path.type];
  if (!group) return;

  const colorMap = {
    EL: 0xff0000,
    WP: 0x0000ff,
    AC: 0x00ff00
  };

  for (let i = 0; i < path.points.length - 1; i++) {
    const p1 = new THREE.Vector3(...path.points[i]);
    const p2 = new THREE.Vector3(...path.points[i + 1]);

    const dir = new THREE.Vector3().subVectors(p2, p1);
    const length = dir.length();

    const geometry = new THREE.CylinderGeometry(0.05, 0.05, length, 8);
    const material = new THREE.MeshBasicMaterial({ color: colorMap[path.type] });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize()
    );

    group.add(mesh);
  }
}

// layer toggles
document.querySelectorAll('#layersPanel input').forEach(cb => {
  cb.addEventListener('change', e => {
    const layer = e.target.dataset.layer;
    pathGroups[layer].visible = e.target.checked;
  });
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
