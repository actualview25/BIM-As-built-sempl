let scenes = [];
let currentScene = 0;
let scene3D, camera, renderer, controls, sphereMesh;
let ambientLight, directionalLight; // ← تعريف عالمي
let autoRotate = true;

function normalizeColor(color) {
    if (typeof color === 'number') return color;
    if (typeof color === 'string' && color.startsWith('#')) return parseInt(color.substring(1), 16);
    return 0xffffff;
}

// بدء التطبيق
function init() {
    console.log('بدء تحميل التطبيق...');
    fetch('tour-data.json')
        .then(res => res.json())
        .then(data => {
            scenes = data.scenes;
            console.log('✅ تم تحميل JSON:', scenes);
            setupScene();
            loadScene(0);
        })
        .catch(err => {
            console.error('❌ فشل تحميل JSON:', err);
            alert('فشل تحميل البيانات، تأكد من وجود ملف tour-data.json');
        });
}

// إعداد المشهد
function setupScene() {
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x000000);

    // إضاءة
    ambientLight = new THREE.AmbientLight(0x404040);
    scene3D.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1,1,1);
    scene3D.add(directionalLight);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    camera.position.set(0,0,0.1);

    renderer = new THREE.WebGLRenderer({antialias:true});
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

// تغيير حجم الشاشة
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// تحميل المشهد
function loadScene(index) {
    const data = scenes[index];
    if (!data) return;

    currentScene = index;
    console.log('🔄 تحميل المشهد:', data.name, data);

    // إزالة المشهد القديم
    scene3D.traverse(child => {
        if (child !== camera && child !== ambientLight && child !== directionalLight) {
            scene3D.remove(child);
        }
    });
    document.querySelectorAll('.hotspot').forEach(e => e.remove());

    // تحميل الصورة
    const loader = new THREE.TextureLoader();
    loader.load(
        data.image,
        (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.x = -1;

            const geometry = new THREE.SphereGeometry(500, 128, 128);
            const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
            sphereMesh = new THREE.Mesh(geometry, material);
            scene3D.add(sphereMesh);

            if (data.paths && data.paths.length) drawPaths(data.paths);
            if (data.hotspots && data.hotspots.length) drawHotspots(data.hotspots);
        },
        undefined,
        () => { alert(`❌ فشل تحميل الصورة: ${data.image}`); }
    );
}

// رسم المسارات
function drawPaths(paths) {
    paths.forEach(path => {
        const color = normalizeColor(path.color);
        const points = path.points.map(p => new THREE.Vector3(p[0],p[1],p[2]));

        for (let i=0; i<points.length-1; i++) {
            const start = points[i], end = points[i+1];
            const dir = new THREE.Vector3().subVectors(end,start);
            const distance = dir.length();
            if (distance<0.1) continue;

            const cylinder = new THREE.Mesh(
                new THREE.CylinderGeometry(1.5,1.5,distance,8),
                new THREE.MeshStandardMaterial({ color:color, emissive:color, emissiveIntensity:0.5 })
            );
            cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
            cylinder.position.copy(new THREE.Vector3().addVectors(start,end).multiplyScalar(0.5));
            scene3D.add(cylinder);
        }
    });
}

// رسم النقاط الساخنة
function drawHotspots(hotspotsData) {
    hotspotsData.forEach(h => {
        const vector = new THREE.Vector3(h.position[0],h.position[1],h.position[2]);
        camera.updateMatrixWorld();
        vector.project(camera);

        const x = (vector.x*0.5+0.5)*window.innerWidth;
        const y = (-vector.y*0.5+0.5)*window.innerHeight;

        if (vector.z>1 || x<0 || x>window.innerWidth || y<0 || y>window.innerHeight) return;

        const div = document.createElement('div');
        div.className = 'hotspot';
        div.style.left = x+'px';
        div.style.top = y+'px';
        div.innerHTML = `<span class='hotspot-icon'>🚪</span>
                         <div class='hotspot-tooltip'><strong>انتقال إلى: ${h.targetId}</strong></div>`;

        div.onclick = (e) => {
            e.stopPropagation();
            const targetIndex = scenes.findIndex(s => s.id===h.targetId);
            if (targetIndex!==-1) loadScene(targetIndex);
        };

        document.body.appendChild(div);
    });
}

// تحديث النقاط الساخنة أثناء التحريك
function updateHotspotPositions() {
    if (!scenes[currentScene] || !scenes[currentScene].hotspots) return;

    document.querySelectorAll('.hotspot').forEach((div,index)=>{
        const h = scenes[currentScene].hotspots[index];
        if (!h) return;

        const vector = new THREE.Vector3(h.position[0],h.position[1],h.position[2]);
        camera.updateMatrixWorld();
        vector.project(camera);

        const x = (vector.x*0.5+0.5)*window.innerWidth;
        const y = (-vector.y*0.5+0.5)*window.innerHeight;

        if (vector.z<=1 && x>=0 && x<=window.innerWidth && y>=0 && y<=window.innerHeight) {
            div.style.left = x+'px';
            div.style.top = y+'px';
            div.style.display = 'block';
        } else div.style.display = 'none';
    });
}

// حلقة التحريك
function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    updateHotspotPositions();
    renderer.render(scene3D,camera);
}

// بدء التطبيق
init();
