let scenes = [];
let currentScene = 0;
let scene3D, camera, renderer, controls, sphereMesh;
let autoRotate = true;

function normalizeColor(color) {
    if (typeof color === 'number') return color;
    if (typeof color === 'string' && color.startsWith('#')) return parseInt(color.substring(1), 16);
    return 0xffffff;
}

function init() {
    fetch('tour-data.json')
        .then(res => res.json())
        .then(data => {
            scenes = data.scenes;
            console.log('✅ تم تحميل JSON:', scenes);
            setupScene();
            loadScene(currentScene);
        })
        .catch(err => console.error('❌ فشل تحميل JSON:', err));
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

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        // إعادة رسم النقاط الساخنة بعد تغيير الحجم
        if (scenes[currentScene]) {
            setTimeout(() => drawHotspots(scenes[currentScene].hotspots), 200);
        }
    });

    animate();
}

function loadScene(index) {
    const data = scenes[index];
    if(!data) return;
    currentScene = index;
    console.log('🔄 تحميل المشهد:', data.name, 'الصورة:', data.image);

    if(sphereMesh) scene3D.remove(sphereMesh);
    document.querySelectorAll('.hotspot').forEach(e => e.remove());

    new THREE.TextureLoader().load(data.image, texture => {
        console.log('✅ تم تحميل الصورة:', data.image);
        
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.x = -1;

        const geometry = new THREE.SphereGeometry(500,128,128);
        const material = new THREE.MeshBasicMaterial({map: texture, side: THREE.BackSide});
        sphereMesh = new THREE.Mesh(geometry, material);
        scene3D.add(sphereMesh);

        if(data.paths) drawPaths(data.paths);
        
        // تأخير بسيط لرسم النقاط الساخنة بعد تحميل الصورة
        setTimeout(() => {
            if(data.hotspots) drawHotspots(data.hotspots);
        }, 500);

    }, undefined, err => {
        console.error('❌ فشل تحميل الصورة:', data.image, err);
        alert(`خطأ في تحميل الصورة: ${data.image}\nتأكد من وجودها داخل مجلد panos/`);
    });
}

function drawPaths(paths) {
    paths.forEach(path => {
        const color = normalizeColor(path.color);
        const points = path.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
        for(let i=0;i<points.length-1;i++){
            const start=points[i], end=points[i+1];
            const dir = new THREE.Vector3().subVectors(end,start);
            const dist = dir.length();
            if(dist<0.5) continue;
            
            const cyl = new THREE.Mesh(
                new THREE.CylinderGeometry(2,2,dist,12),
                new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: 0.3
                })
            );
            
            // توجيه الاسطوانة
            const quaternion = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0,1,0), 
                dir.clone().normalize()
            );
            cyl.applyQuaternion(quaternion);
            
            // وضع الاسطوانة في المنتصف بين النقطتين
            cyl.position.copy(new THREE.Vector3().addVectors(start,end).multiplyScalar(0.5));
            
            scene3D.add(cyl);
        }
    });
}

function drawHotspots(hotspots) {
    // إزالة النقاط الساخنة القديمة
    document.querySelectorAll('.hotspot').forEach(e => e.remove());
    
    hotspots.forEach(h => {
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
                <strong>انتقال إلى: ${h.targetId}</strong>
            </div>
        `;
        
        // حدث النقر للانتقال إلى المشهد التالي
        div.onclick = (e) => {
            e.stopPropagation();
            const targetIndex = scenes.findIndex(s => s.id === h.targetId);
            if(targetIndex !== -1) {
                console.log('الانتقال إلى:', h.targetId);
                loadScene(targetIndex);
            }
        };
        
        document.body.appendChild(div);
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene3D, camera);
    
    // تحديث مواقع النقاط الساخنة أثناء الدوران (اختياري)
    if (scenes[currentScene] && scenes[currentScene].hotspots) {
        // يمكن إضافة تحديث مستمر للمواقع إذا أردت
        // لكن هذا قد يؤثر على الأداء
    }
}

// بدء التطبيق
init();
