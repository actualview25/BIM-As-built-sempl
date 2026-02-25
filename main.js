let scenes = [];
let currentScene = 0;
let scene3D, camera, renderer, controls, sphereMesh;
let autoRotate = true;

// قائمة بجميع المسارات الممكنة للصور
const possiblePaths = [
    'panos/scene0.jpg',
    'panos/scene-0.jpg', 
    'panos/scene_0.jpg',
    'panos/0.jpg',
    'panos/1.jpg',
    'panos/2.jpg',
    'panos/3.jpg',
    'panos/4.jpg',
    'scene0.jpg',
    'scene-0.jpg',
    'scene_0.jpg'
];

function normalizeColor(color) {
    if (typeof color === 'number') return color;
    if (typeof color === 'string' && color.startsWith('#')) return parseInt(color.substring(1), 16);
    return 0xffffff;
}

function init() {
    console.log('بدء تحميل التطبيق...');
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
            document.body.innerHTML += `
                <div style="position:fixed;top:10px;right:10px;background:red;color:white;padding:15px;z-index:1000;">
                    خطأ في تحميل ملف tour-data.json
                </div>
            `;
        });
}

function setupScene() {
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0,0,0.1);

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
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

    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// دالة ذكية لتحميل الصورة مع محاولة مسارات متعددة
function loadImageWithFallback(imagePath, successCallback, errorCallback, attempt = 0) {
    const loader = new THREE.TextureLoader();
    
    // استخراج رقم المشهد من المسار
    const sceneNumber = imagePath.match(/\d+/)?.[0] || '0';
    
    // قائمة المسارات للمحاولة
    const pathsToTry = [
        imagePath,  // المسار الأصلي: panos/scene0.jpg
        `panos/scene-${sceneNumber}.jpg`,  // panos/scene-0.jpg
        `panos/scene_${sceneNumber}.jpg`,  // panos/scene_0.jpg
        `panos/${sceneNumber}.jpg`,  // panos/0.jpg
        `scene${sceneNumber}.jpg`,  // scene0.jpg (بدون مجلد)
        `scene-${sceneNumber}.jpg`,  // scene-0.jpg
        `scene_${sceneNumber}.jpg`,  // scene_0.jpg
        `./panos/scene${sceneNumber}.jpg`,  // مع ./ في البداية
        `/panos/scene${sceneNumber}.jpg`,  // مع / في البداية
    ];
    
    console.log(`محاولة تحميل الصورة ${attempt + 1}/${pathsToTry.length}: ${pathsToTry[attempt]}`);
    
    loader.load(
        pathsToTry[attempt],
        // نجاح
        (texture) => {
            console.log(`✅ تم تحميل الصورة بنجاح: ${pathsToTry[attempt]}`);
            successCallback(texture);
        },
        // تقدم
        undefined,
        // فشل - جرب المسار التالي
        (error) => {
            console.log(`❌ فشل المسار: ${pathsToTry[attempt]}`);
            if (attempt < pathsToTry.length - 1) {
                // جرب المسار التالي
                loadImageWithFallback(imagePath, successCallback, errorCallback, attempt + 1);
            } else {
                // كل المسارات فشلت
                console.error('❌ كل المسارات فشلت للصورة:', imagePath);
                if (errorCallback) errorCallback(error);
                
                // عرض رسالة خطأ للمستخدم
                const errorMsg = document.createElement('div');
                errorMsg.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(255,0,0,0.9);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    z-index: 1000;
                    text-align: center;
                    direction: rtl;
                `;
                errorMsg.innerHTML = `
                    <h3>⚠️ خطأ في تحميل الصورة</h3>
                    <p>لم يتم العثور على الصورة: scene${sceneNumber}.jpg</p>
                    <p>تأكد من وجود الملف في مجلد panos/</p>
                    <button onclick="this.parentElement.remove()" style="margin-top:10px;padding:5px 20px;">حسناً</button>
                `;
                document.body.appendChild(errorMsg);
            }
        }
    );
}

function loadScene(index) {
    const data = scenes[index];
    if(!data) return;
    currentScene = index;
    console.log('🔄 تحميل المشهد:', data.name);

    if(sphereMesh) scene3D.remove(sphereMesh);
    document.querySelectorAll('.hotspot').forEach(e => e.remove());

    // استخدام الدالة الذكية لتحميل الصورة
    loadImageWithFallback(
        data.image,
        (texture) => {
            // دالة النجاح
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.x = -1;

            const geometry = new THREE.SphereGeometry(500, 128, 128);
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide
            });
            sphereMesh = new THREE.Mesh(geometry, material);
            scene3D.add(sphereMesh);

            if (data.paths) drawPaths(data.paths);
            
            // تأخير لرسم النقاط الساخنة
            setTimeout(() => {
                if (data.hotspots) drawHotspots(data.hotspots);
            }, 500);
        },
        (error) => {
            // دالة الخطأ النهائية
            console.error('❌ فشل تحميل الصورة للمشهد:', data.name);
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
            const dist = dir.length();
            
            if (dist < 0.5) continue;
            
            const cylinder = new THREE.Mesh(
                new THREE.CylinderGeometry(2, 2, dist, 12),
                new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: 0.3
                })
            );
            
            // توجيه الاسطوانة
            const quaternion = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                dir.clone().normalize()
            );
            cylinder.applyQuaternion(quaternion);
            
            // وضع الاسطوانة في المنتصف
            const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            cylinder.position.copy(center);
            
            scene3D.add(cylinder);
        }
    });
}

function drawHotspots(hotspots) {
    document.querySelectorAll('.hotspot').forEach(e => e.remove());
    
    hotspots.forEach(h => {
        const vector = new THREE.Vector3(h.position[0], h.position[1], h.position[2]);
        
        camera.updateMatrixWorld();
        vector.project(camera);
        
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
        
        if (vector.z > 1 || x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) {
            return;
        }

        const div = document.createElement('div');
        div.className = 'hotspot';
        div.style.left = x + 'px';
        div.style.top = y + 'px';
        div.style.color = '#44aaff';
        
        div.innerHTML = `
            <span class='hotspot-icon'>🚪</span>
            <div class='hotspot-tooltip'>
                <strong>انتقال إلى: ${h.targetId}</strong>
            </div>
        `;
        
        div.onclick = (e) => {
            e.stopPropagation();
            const targetIndex = scenes.findIndex(s => s.id === h.targetId);
            if (targetIndex !== -1) {
                console.log('الانتقال إلى:', h.targetId);
                loadScene(targetIndex);
            }
        };
        
        document.body.appendChild(div);
    });
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene3D && camera) renderer.render(scene3D, camera);
}

// بدء التطبيق
init();
