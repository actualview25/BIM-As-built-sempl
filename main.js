let scenes = [];
let currentScene = 0;
let scene3D, camera, renderer, controls, sphereMesh;
let autoRotate = true;
let pathObjects = [];
let hotspotElements = [];

// ثابت لتحجيم المسارات
const SCALE_FACTOR = 30; // جرب 30, 40, 50 حسب الحاجة

function normalizeColor(color) {
    if (typeof color === 'number') return color;
    return 0xffffff;
}

function init() {
    console.log('🚀 بدء التحميل...');
    fetch('tour-data.json')
        .then(res => res.json())
        .then(data => {
            scenes = data.scenes;
            console.log('✅ تم تحميل JSON بنجاح');
            setupScene();
            loadScene(0);
        })
        .catch(err => {
            console.error('❌ خطأ في JSON:', err);
            alert('خطأ في ملف JSON - تأكد من تنسيقه');
        });
}

function setupScene() {
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.8;

    document.getElementById('autoRotateBtn').onclick = () => {
        autoRotate = !autoRotate;
        controls.autoRotate = autoRotate;
        document.getElementById('autoRotateBtn').textContent = autoRotate ? '⏸️ إيقاف' : '▶️ تشغيل';
    };

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function loadScene(index) {
    const data = scenes[index];
    if (!data) return;
    
    console.log('تحميل المشهد:', data.name);
    currentScene = index;

    // تنظيف
    if (sphereMesh) scene3D.remove(sphereMesh);
    pathObjects.forEach(p => scene3D.remove(p));
    pathObjects = [];
    hotspotElements.forEach(e => e.remove());
    hotspotElements = [];

    // تحميل الصورة
    new THREE.TextureLoader().load(data.image, texture => {
        // إنشاء الكرة
        const geometry = new THREE.SphereGeometry(500, 64, 64);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            side: THREE.BackSide 
        });
        sphereMesh = new THREE.Mesh(geometry, material);
        scene3D.add(sphereMesh);

        // رسم المسارات
        if (data.paths && data.paths.length > 0) {
            drawPaths(data.paths);
        }
        
        // رسم النقاط الساخنة
        if (data.hotspots && data.hotspots.length > 0) {
            drawHotspots(data.hotspots);
        }
    }, undefined, (err) => {
        console.error('فشل تحميل الصورة:', data.image);
    });
}

function drawPaths(paths) {
    paths.forEach(path => {
        const color = normalizeColor(path.color);
        
        // تحويل النقاط مع التحجيم
        const points = path.points.map(p => new THREE.Vector3(
            p[0] * SCALE_FACTOR,
            p[1] * SCALE_FACTOR,
            p[2] * SCALE_FACTOR
        ));

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            
            const dir = new THREE.Vector3().subVectors(end, start);
            const dist = dir.length();
            
            if (dist < 1) continue;

            // خط المسار
            const cylinder = new THREE.Mesh(
                new THREE.CylinderGeometry(2, 2, dist, 6),
                new THREE.MeshStandardMaterial({ 
                    color: color,
                    emissive: color,
                    emissiveIntensity: 0.3
                })
            );

            cylinder.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                dir.clone().normalize()
            );
            
            cylinder.position.copy(
                new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
            );

            scene3D.add(cylinder);
            pathObjects.push(cylinder);
        }
    });
}

function drawHotspots(hotspots) {
    hotspots.forEach(h => {
        const div = document.createElement('div');
        div.className = 'hotspot';
        div.innerHTML = '<span class="hotspot-icon">🚪</span>';
        div.title = `انتقال إلى ${h.targetId}`;
        document.body.appendChild(div);
        
        hotspotElements.push({
            element: div,
            position: h.position
        });

        div.onclick = () => {
            const target = scenes.findIndex(s => s.id === h.targetId);
            if (target !== -1) loadScene(target);
        };
    });
    
    updateHotspots();
}

function updateHotspots() {
    hotspotElements.forEach(item => {
        const vec = new THREE.Vector3(
            item.position[0] * SCALE_FACTOR,
            item.position[1] * SCALE_FACTOR,
            item.position[2] * SCALE_FACTOR
        );
        
        vec.project(camera);
        
        const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vec.y * 0.5 + 0.5) * window.innerHeight;
        
        if (vec.z < 1 && x > 0 && x < window.innerWidth && y > 0 && y < window.innerHeight) {
            item.element.style.left = x + 'px';
            item.element.style.top = y + 'px';
            item.element.style.display = 'block';
        } else {
            item.element.style.display = 'none';
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateHotspots();
    renderer.render(scene3D, camera);
}

init();
