let scenes = [];
let currentScene = 0;
let scene3D, camera, renderer, controls, sphereMesh;
let autoRotate = true;
let hotspots = []; // لتخزين النقاط الساخنة الحالية

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
        });
}

function setupScene() {
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x000000);

    // إضافة إضاءة خفيفة للمسارات
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene3D.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
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
    
    // إعادة رسم النقاط الساخنة بعد تغيير الحجم
    if (scenes[currentScene] && scenes[currentScene].hotspots) {
        updateHotspotPositions(scenes[currentScene].hotspots);
    }
}

// دالة ذكية لتحميل الصورة
function loadImageWithFallback(imagePath, successCallback, errorCallback) {
    const loader = new THREE.TextureLoader();
    
    // استخراج رقم المشهد من المسار
    const sceneNumber = imagePath.match(/\d+/)?.[0] || '0';
    
    // قائمة المسارات للمحاولة
    const pathsToTry = [
        imagePath,  // المسار الأصلي: panos/scene0.jpg
        `panos/scene-${sceneNumber}.jpg`,  // panos/scene-0.jpg
        `panos/${sceneNumber}.jpg`,  // panos/0.jpg
        `scene${sceneNumber}.jpg`,  // scene0.jpg
        `./panos/scene${sceneNumber}.jpg`,  // مع ./
    ];
    
    let attempt = 0;
    
    function tryNextPath() {
        if (attempt >= pathsToTry.length) {
            console.error('❌ كل المسارات فشلت للصورة:', imagePath);
            if (errorCallback) errorCallback();
            return;
        }
        
        console.log(`محاولة ${attempt + 1}/${pathsToTry.length}: ${pathsToTry[attempt]}`);
        
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
                tryNextPath();
            }
        );
    }
    
    tryNextPath();
}

function loadScene(index) {
    const data = scenes[index];
    if (!data) return;
    
    currentScene = index;
    console.log('🔄 تحميل المشهد:', data.name, data);

    // إزالة المشهد السابق
    if (sphereMesh) scene3D.remove(sphereMesh);
    
    // إزالة المسارات السابقة (إذا كنا نخزنها بشكل منفصل)
    // يمكن تحسين هذا بحفظ المسارات في مصفوفة
    scene3D.children = scene3D.children.filter(child => child === camera || child === ambientLight || child === directionalLight);
    
    document.querySelectorAll('.hotspot').forEach(e => e.remove());

    // تحميل الصورة
    loadImageWithFallback(
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
            } else {
                console.log('لا توجد مسارات في هذا المشهد');
            }
            
            // رسم النقاط الساخنة
            if (data.hotspots && data.hotspots.length > 0) {
                console.log('رسم النقاط الساخنة:', data.hotspots.length);
                // تأخير بسيط للتأكد من تحميل الصورة بالكامل
                setTimeout(() => {
                    drawHotspots(data.hotspots);
                }, 300);
            } else {
                console.log('لا توجد نقاط ساخنة في هذا المشهد');
            }
        },
        () => {
            alert(`خطأ في تحميل الصورة للمشهد: ${data.name}`);
        }
    );
}

function drawPaths(paths) {
    paths.forEach(path => {
        const color = normalizeColor(path.color);
        console.log('رسم مسار بلون:', color.toString(16), path.type);
        
        const points = path.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
        
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            
            // حساب الاتجاه والمسافة
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
            
            // إضافة كرة صغيرة في نقاط التحول (اختياري)
            if (i === 0) {
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(2, 8, 8),
                    new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.3 })
                );
                sphere.position.copy(start);
                scene3D.add(sphere);
            }
            
            if (i === points.length - 2) {
                const sphere = new THREE.Mesh(
                    new THREE.SphereGeometry(2, 8, 8),
                    new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.3 })
                );
                sphere.position.copy(end);
                scene3D.add(sphere);
            }
        }
    });
}

function drawHotspots(hotspotsData) {
    // إزالة النقاط الساخنة القديمة
    document.querySelectorAll('.hotspot').forEach(e => e.remove());
    
    console.log('رسم نقاط ساخنة:', hotspotsData.length);
    
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
        
        console.log(`نقطة ${index} في:`, h.position, 'على الشاشة:', x, y, 'z:', vector.z);
        
        // تجاهل النقاط خلف الكاميرا
        if (vector.z > 1) {
            console.log('نقطة خلف الكاميرا:', h.position);
            return;
        }
        
        // تجاهل النقاط خارج الشاشة
        if (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight) {
            console.log('نقطة خارج الشاشة:', h.position);
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
            
            if (!h.targetId) {
                console.warn('لا يوجد targetId لهذه النقطة');
                return;
            }
            
            const targetIndex = scenes.findIndex(s => s.id === h.targetId);
            console.log('النقر على نقطة، البحث عن:', h.targetId, 'النتيجة:', targetIndex);
            
            if (targetIndex !== -1) {
                loadScene(targetIndex);
            } else {
                alert(`لم يتم العثور على المشهد: ${h.targetId}`);
            }
        };
        
        document.body.appendChild(div);
    });
}

function updateHotspotPositions(hotspotsData) {
    // تحديث مواقع النقاط الساخنة (للاستخدام مع التكبير/التصغير)
    document.querySelectorAll('.hotspot').forEach((div, index) => {
        if (index < hotspotsData.length) {
            const h = hotspotsData[index];
            const vector = new THREE.Vector3(h.position[0], h.position[1], h.position[2]);
            
            camera.updateMatrixWorld();
            vector.project(camera);
            
            const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
            
            if (vector.z <= 1 && x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight) {
                div.style.left = x + 'px';
                div.style.top = y + 'px';
                div.style.display = 'block';
            } else {
                div.style.display = 'none';
            }
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls) controls.update();
    
    // تحديث مواقع النقاط الساخنة أثناء الدوران
    if (scenes[currentScene] && scenes[currentScene].hotspots) {
        updateHotspotPositions(scenes[currentScene].hotspots);
    }
    
    if (renderer && scene3D && camera) {
        renderer.render(scene3D, camera);
    }
}

// بدء التطبيق
init();
