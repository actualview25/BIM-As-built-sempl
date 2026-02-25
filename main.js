let scenes = [];
let currentScene = 0;
let scene3D, camera, renderer, controls, sphereMesh;
let autoRotate = true;
let pathObjects = [];
let hotspotElements = [];

// ثابت التحجيم
const SCALE = 30;

function init() {
    console.log('بدء التحميل...');
    fetch('tour-data.json')
        .then(res => res.json())
        .then(data => {
            scenes = data.scenes;
            console.log('✅ تم تحميل JSON');
            setupScene();
            loadScene(0);
        })
        .catch(err => {
            console.error('خطأ:', err);
            alert('خطأ في ملف JSON');
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
    
    currentScene = index;

    // تنظيف
    if (sphereMesh) scene3D.remove(sphereMesh);
    pathObjects.forEach(p => scene3D.remove(p));
    pathObjects = [];
    hotspotElements.forEach(e => e.remove());
    hotspotElements = [];

    // تحميل الصورة
    new THREE.TextureLoader().load(data.image, texture => {
        // الكرة
        const geometry = new THREE.SphereGeometry(500, 64, 64);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture, 
            side: THREE.BackSide 
        });
        sphereMesh = new THREE.Mesh(geometry, material);
        scene3D.add(sphereMesh);

        // المسارات
        if (data.paths) {
            data.paths.forEach(path => {
                const points = path.points.map(p => new THREE.Vector3(
                    p[0] * SCALE,
                    p[1] * SCALE,
                    p[2] * SCALE
                ));
                
                for (let i = 0; i < points.length - 1; i++) {
                    const start = points[i];
                    const end = points[i + 1];
                    const dir = new THREE.Vector3().subVectors(end, start);
                    const dist = dir.length();
                    
                    const cylinder = new THREE.Mesh(
                        new THREE.CylinderGeometry(2, 2, dist, 6),
                        new THREE.MeshStandardMaterial({ color: path.color })
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

        // النقاط الساخنة
        if (data.hotspots) {
            data.hotspots.forEach(h => {
                const div = document.createElement('div');
                div.className = 'hotspot';
                div.innerHTML = '🚪';
                div.style.fontSize = '30px';
                div.style.position = 'absolute';
                div.style.cursor = 'pointer';
                div.style.zIndex = '100';
                div.style.transform = 'translate(-50%, -50%)';
                document.body.appendChild(div);
                
                hotspotElements.push({
                    element: div,
                    pos: h.position
                });

                div.onclick = () => {
                    const target = scenes.findIndex(s => s.id === h.targetId);
                    if (target !== -1) loadScene(target);
                };
            });
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    // تحديث مواقع النقاط
    hotspotElements.forEach(item => {
        const vec = new THREE.Vector3(
            item.pos[0] * SCALE,
            item.pos[1] * SCALE,
            item.pos[2] * SCALE
        );
        
        vec.project(camera);
        
        const x = (vec.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vec.y * 0.5 + 0.5) * window.innerHeight;
        
        if (vec.z < 1) {
            item.element.style.left = x + 'px';
            item.element.style.top = y + 'px';
            item.element.style.display = 'block';
        } else {
            item.element.style.display = 'none';
        }
    });
    
    controls.update();
    renderer.render(scene3D, camera);
}

init();
