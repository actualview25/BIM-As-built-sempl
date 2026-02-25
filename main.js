let scenes = [];
let currentScene = 0;
let scene3D, camera, renderer, controls, sphereMesh;
let autoRotate = true;

// لتخزين المسارات والنقاط الساخنة
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

    // إضاءة عامة للمسارات
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene3D.add(ambientLight);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1);  // الكاميرا داخل الكرة

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
    const imagePath = data.image;
    
    console.log('محاولة تحميل الصورة:', imagePath);
    
    loader.load(
        imagePath,
        (texture) => {
            console.log('✅ تم تحميل الصورة:', imagePath);
            createSphereWithTexture(texture, data);
        },
        undefined,
        (err) => {
            console.error('❌ فشل تحميل الصورة:', imagePath, err);
            alert(`خطأ في تحميل الصورة: ${imagePath}\nتأكد من وجود الملف في مجلد panos/`);
        }
    );
}

function createSphereWithTexture(texture, data) {
    // تعديل إعدادات النسيج
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    
    // الكرة بحجم 100
    const geometry = new THREE.SphereGeometry(100, 64, 64);
    const material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        side: THREE.BackSide
    });
    
    sphereMesh = new THREE.Mesh(geometry, material);
    scene3D.add(sphereMesh);

    // رسم المسارات - مع تعديل الإحداثيات
    if (data.paths && data.paths.length > 0) {
        console.log('رسم المسارات:', data.paths.length);
        drawPaths(data.paths);
    }
    
    // رسم النقاط الساخنة
    if (data.hotspots && data.hotspots.length > 0) {
        console.log('رسم النقاط الساخنة:', data.hotspots.length);
        drawHotspots(data.hotspots);
    }
}

function drawPaths(paths) {
    paths.forEach(path => {
        const color = normalizeColor(path.color);
        
        // تعديل IMPORTANT: تقليل حجم المسارات وجعلها قريبة من الكرة
        const points = path.points.map(p => {
            // تصغير الإحداثيات وجعلها على سطح الكرة
            return new THREE.Vector3(
                p[0] * 2,  // تصغير المسافة
                p[1] * 2,
                p[2] * 2
            );
        });

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            
            // التأكد من أن النقاط على سطح الكرة
            start.normalize().multiplyScalar(98); // أقل بقليل من نصف القطر
            end.normalize().multiplyScalar(98);
            
            const dir = new THREE.Vector3().subVectors(end, start);
            const distance = dir.length();
            
            if (distance < 0.1) continue;

            // إنشاء اسطوانة صغيرة للخط
            const cylinder = new THREE.Mesh(
                new THREE.CylinderGeometry(0.5, 0.5, distance, 6),
                new THREE.MeshStandardMaterial({ 
                    color: color, 
                    emissive: color, 
                    emissiveIntensity: 0.5 
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

function drawHotspots(hotspotsData) {
    hotspotsData.forEach((h, index) => {
        const div = document.createElement('div');
        div.className = 'hotspot';
        div.innerHTML = `
            <span class='hotspot-icon'>🚪</span>
            <div class='hotspot-tooltip'>
                <strong>انتقال إلى: ${h.targetId || 'مشهد آخر'}</strong>
            </div>
        `;
        document.body.appendChild(div);
        hotspotElements.push(div);

        div.onclick = () => {
            const targetIndex = scenes.findIndex(s => s.id === h.targetId);
            if (targetIndex !== -1) {
                console.log('الانتقال إلى:', h.targetId);
                loadScene(targetIndex);
            }
        };
    });

    setTimeout(updateHotspotPositions, 100);
}

function updateHotspotPositions() {
    if (!scenes[currentScene] || !scenes[currentScene].hotspots) return;

    scenes[currentScene].hotspots.forEach((h, i) => {
        const div = hotspotElements[i];
        if (!div) return;

        // تعديل IMPORTANT: نفس تعديل المسارات للنقاط الساخنة
        const vector = new THREE.Vector3(
            h.position[0] * 2,
            h.position[1] * 2,
            h.position[2] * 2
        );
        
        // وضع النقطة على سطح الكرة
        vector.normalize().multiplyScalar(99);
        
        camera.updateMatrixWorld();
        vector.project(camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        if (vector.z < 1 && x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight) {
            div.style.left = x + 'px';
            div.style.top = y + 'px';
            div.style.display = 'block';
        } else {
            div.style.display = 'none';
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls) controls.update();
    updateHotspotPositions();
    
    if (renderer && scene3D && camera) {
        renderer.render(scene3D, camera);
    }
}

// بدء التطبيق
init();
