let scenes = [];
let currentScene = 0;
let scene3D, camera, renderer, controls, sphereMesh;
let autoRotate = true;

// لتخزين المسارات والنقاط الساخنة لإزالة/تحديث كل مشهد
let pathObjects = [];
let hotspotElements = [];

function normalizeColor(color) {
    if (typeof color === 'number') return color;
    if (typeof color === 'string' && color.startsWith('#')) return parseInt(color.substring(1), 16);
    return 0xffffff;
}

function init() {
    console.log('🚀 بدء تحميل التطبيق...');
    fetch('tour-data.json')
        .then(res => {
            if (!res.ok) throw new Error('فشل تحميل JSON');
            return res.json();
        })
        .then(data => {
            scenes = data.scenes;
            console.log('✅ تم تحميل JSON:', scenes);
            setupScene();
            loadScene(0);
        })
        .catch(err => {
            console.error('❌ فشل تحميل JSON:', err);
        });
}

function setupScene() {
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x000000);

    // إضاءة عامة
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene3D.add(ambientLight);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 0, 0.1);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.5;

    document.getElementById('autoRotateBtn').onclick = () => {
        autoRotate = !autoRotate;
        controls.autoRotate = autoRotate;
        document.getElementById('autoRotateBtn').textContent = autoRotate ? '⏸️ إيقاف الدوران' : '▶️ تشغيل الدوران';
    };

    window.addEventListener('resize', onWindowResize);
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateHotspotPositions();
}

function loadScene(index) {
    const data = scenes[index];
    if (!data) return;
    currentScene = index;

    console.log('🔄 تحميل المشهد:', data.name);

    // إزالة المشهد السابق
    if (sphereMesh) scene3D.remove(sphereMesh);
    pathObjects.forEach(p => scene3D.remove(p));
    pathObjects = [];
    hotspotElements.forEach(e => e.remove());
    hotspotElements = [];

    // تحميل الصورة
    const loader = new THREE.TextureLoader();
    loader.load(
        data.image,
        (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.x = -1;

            const geometry = new THREE.SphereGeometry(500, 64, 64);
            const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
            sphereMesh = new THREE.Mesh(geometry, material);
            scene3D.add(sphereMesh);

            if (data.paths && data.paths.length > 0) drawPaths(data.paths);
            if (data.hotspots && data.hotspots.length > 0) drawHotspots(data.hotspots);
        },
        undefined,
        (err) => {
            console.error('❌ فشل تحميل الصورة:', data.image, err);
            alert(`خطأ في تحميل الصورة: ${data.image}`);
        }
    );
}

function drawPaths(paths) {
    paths.forEach(path => {
        const color = normalizeColor(path.color);
        const points = path.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            const dir = new THREE.Vector3().subVectors(end, start);
            const distance = dir.length();
            if (distance < 0.1) continue;

            const cylinder = new THREE.Mesh(
                new THREE.CylinderGeometry(1.5, 1.5, distance, 8),
                new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
            );

            cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            cylinder.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));

            scene3D.add(cylinder);
            pathObjects.push(cylinder);

            // نقاط بداية ونهاية الخطوط
            [start, end].forEach(pos => {
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(2, 8, 8),
                    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
                );
                sphere.position.copy(pos);
                scene3D.add(sphere);
                pathObjects.push(sphere);
            });
        }
    });
}

function drawHotspots(hotspotsData) {
    hotspotsData.forEach(h => {
        const div = document.createElement('div');
        div.className = 'hotspot';
        div.innerHTML = `<span class='hotspot-icon'>🚪</span>
                         <div class='hotspot-tooltip'>انتقال إلى: ${h.targetId || 'مشهد آخر'}</div>`;
        document.body.appendChild(div);
        hotspotElements.push(div);

        div.onclick = () => {
            const targetIndex = scenes.findIndex(s => s.id === h.targetId);
            if (targetIndex !== -1) loadScene(targetIndex);
        };
    });

    updateHotspotPositions();
}

function updateHotspotPositions() {
    if (!scenes[currentScene] || !scenes[currentScene].hotspots) return;

    scenes[currentScene].hotspots.forEach((h, i) => {
        const div = hotspotElements[i];
        if (!div) return;

        const vector = new THREE.Vector3(h.position[0], h.position[1], h.position[2]);
        camera.updateMatrixWorld();
        vector.project(camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        if (vector.z <= 1 && x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight) {
            div.style.left = x + 'px';
            div.style.top = y + 'px';
            div.style.display = 'block';
        } else div.style.display = 'none';
    });
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    updateHotspotPositions();
    if (renderer && scene3D && camera) renderer.render(scene3D, camera);
}

// بدء التطبيق
init();
// بدء التطبيق
init();
