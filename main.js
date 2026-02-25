let scenes = [];
let currentScene = 0;
let scene3D, camera, renderer, controls, sphereMesh;
let autoRotate = true;
let ambientLight, directionalLight; // تخزين الإضاءة كمتغيرات عامة

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
            document.body.innerHTML += '<div style="color:red;padding:20px;">خطأ في تحميل ملف JSON</div>';
        });
}

function setupScene() {
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x000000);

    // إضافة إضاءة خفيفة للمسارات
    ambientLight = new THREE.AmbientLight(0x404040);
    scene3D.add(ambientLight);
    
    directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene3D.add(directionalLight);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 0.1);

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.0;

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

// دالة مبسطة لتحميل الصورة
function loadSceneImage(imagePath, successCallback, errorCallback) {
    const loader = new THREE.TextureLoader();
    const sceneNumber = imagePath.match(/\d+/)?.[0] || '0';
    
    // نجرب المسارين المحتملين فقط
    const pathsToTry = [
        imagePath,                    // panos/scene0.jpg
        `panos/scene-${sceneNumber}.jpg` // panos/scene-0.jpg
    ];
    
    let attempt = 0;
    
    function tryNext() {
        if (attempt >= pathsToTry.length) {
            console.error('❌ فشل تحميل الصورة من كل المسارات');
            if (errorCallback) errorCallback();
            return;
        }
        
        console.log(`محاولة تحميل: ${pathsToTry[attempt]}`);
        
        loader.load(
            pathsToTry[attempt],
            (texture) => {
                console.log(`✅ تم تحميل الصورة: ${pathsToTry[attempt]}`);
                successCallback(texture);
            },
            undefined,
            (error) => {
                console.log(`❌ فشل: ${pathsToTry[attempt]}`);
                attempt++;
                tryNext();
            }
        );
    }
    
    tryNext();
}

function loadScene(index) {
    const data = scenes[index];
    if (!data) return;
    
    currentScene = index;
    console.log('🔄 تحميل المشهد:', data.name);

    // إزالة الكرة القديمة فقط، مع الاحتفاظ بالإضاءة
    if (sphereMesh) {
        scene3D.remove(sphereMesh);
        sphereMesh = null;
    }
    
    // إزالة جميع المسارات القديمة (أي شيء ليس إضاءة أو كاميرا)
    const itemsToRemove = [];
    scene3D.children.forEach(child => {
        if (child !== ambientLight && child !== directionalLight && child !== camera) {
            itemsToRemove.push(child);
        }
    });
    itemsToRemove.forEach(child => scene3D.remove(child));
    
    // إزالة النقاط الساخنة القديمة
    document.querySelectorAll('.hotspot').forEach(e => e.remove());

    // تحميل الصورة الجديدة
    loadSceneImage(
        data.image,
        (texture) => {
            // تكوين الصورة
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

            // رسم المسارات
            if (data.paths && data.paths.length > 0) {
                console.log('رسم المسارات:', data.paths.length);
                drawPaths(data.paths);
            }
            
            // رسم النقاط الساخنة
            if (data.hotspots && data.hotspots.length > 0) {
                console.log('رسم النقاط الساخنة:', data.hotspots.length);
                // تأخير بسيط للتأكد من اكتمال التحميل
                setTimeout(() => {
                    drawHotspots(data.hotspots);
                }, 300);
            }
        },
        () => {
            alert(`خطأ في تحميل الصورة: ${data.image}\nتأكد من وجود الملف في مجلد panos/`);
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
            
            const direction = new THREE.Vector3().subVectors(end, start);
            const distance = direction.length();
            
            if (distance < 0.1) continue;
            
            // إنشاء اسطوانة للخط
            const cylinder = new THREE.Mesh(
                new THREE.CylinderGeometry(1.5, 1.5, distance, 8),
                new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: 0.5
                })
            );
            
            // توجيه الاسطوانة
            cylinder.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                direction.clone().normalize()
            );
            
            // وضع الاسطوانة في المنتصف
            const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            cylinder.position.copy(center);
            
            scene3D.add(cylinder);
        }
    });
}

function drawHotspots(hotspotsData) {
    // إزالة النقاط الساخنة القديمة
    document.querySelectorAll('.hotspot').forEach(e => e.remove());
    
    hotspotsData.forEach((h, index) => {
        // تحويل النقطة من إحداثيات المسرح إلى إحداثيات الشاشة
        const vector = new THREE.Vector3(h.position[0], h.position[1], h.position[2]);
        
        // تحديث مصفوفة الكاميرا
        camera.updateMatrixWorld();
        
        // إسقاط النقطة على الشاشة
        vector.project(camera);
        
        // تحويل إلى إحداثيات بكسل
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
        
        // تجاهل النقاط خلف الكاميرا أو خارج الشاشة
        if (vector.z > 1 || x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) {
            return;
        }

        // إنشاء عنصر HTML للنقطة الساخنة
        const div = document.createElement('div');
        div.className = 'hotspot';
        div.style.left = x + 'px';
        div.style.top = y + 'px';
        div.style.color = '#44aaff';
        
        // إضافة أيقونة وتلميح
        div.innerHTML = `
            <span class='hotspot-icon'>🚪</span>
            <div class='hotspot-tooltip'>
                <strong>انتقال إلى: ${h.targetId || 'مشهد آخر'}</strong>
            </div>
        `;
        
        // حدث النقر للانتقال
        div.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (!h.targetId) return;
            
            const targetIndex = scenes.findIndex(s => s.id === h.targetId);
            if (targetIndex !== -1) {
                loadScene(targetIndex);
            }
        };
        
        document.body.appendChild(div);
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls) controls.update();
    
    if (renderer && scene3D && camera) {
        renderer.render(scene3D, camera);
    }
}

// بدء التطبيق
init();
