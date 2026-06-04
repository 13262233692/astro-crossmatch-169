import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class StarRenderer {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.webglRenderer = null;
        this.controls = null;
        this.starMeshes = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedGroup = null;
        this.onStarClick = null;
        this.onStarHover = null;
        this.pointSize = 3;
        this.bgColor = 0x0a0a1a;
        this.centerRA = 180;
        this.centerDec = 30;
        this.radius = 5;
        this.sphereRadius = 100;
        this.showGaia = true;
        this.show2MASS = true;
        this.showMatched = true;
        this._gridGroup = null;
        this._axisGroup = null;
        this._bgStars = null;

        this._init();
    }

    _init() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.bgColor);

        this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
        this.camera.position.set(0, 0, 250);

        this.webglRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.webglRenderer.setSize(w, h);
        this.webglRenderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.webglRenderer.domElement);

        this.controls = new OrbitControls(this.camera, this.webglRenderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 0.8;

        this._gridGroup = this._createGrid();
        this.scene.add(this._gridGroup);

        this._axisGroup = this._createAxes();
        this.scene.add(this._axisGroup);

        this._addBackgroundStars();

        this._setupEvents();

        this._animate();
    }

    _localizePosition(ra, dec) {
        const cRA = this.centerRA * Math.PI / 180;
        const cDec = this.centerDec * Math.PI / 180;
        const pRA = ra * Math.PI / 180;
        const pDec = dec * Math.PI / 180;

        const deltaRA = (pRA - cRA) * Math.cos(cDec);
        const deltaDec = pDec - cDec;

        const scale = this.sphereRadius * Math.PI / 180;
        const x = deltaRA * scale;
        const y = deltaDec * scale;

        return new THREE.Vector3(x, y, 0);
    }

    _createGrid() {
        const group = new THREE.Group();
        const scale = this.sphereRadius * Math.PI / 180;
        const gridMat = new THREE.LineBasicMaterial({ color: 0x1a2a4a, transparent: true, opacity: 0.3 });

        for (let dDec = -this.radius; dDec <= this.radius; dDec += 1) {
            const pts = [];
            for (let dRA = -this.radius; dRA <= this.radius; dRA += 0.1) {
                const x = dRA * Math.cos((this.centerDec + dDec) * Math.PI / 180) * scale;
                const y = dDec * scale;
                pts.push(new THREE.Vector3(x, y, 0));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            group.add(new THREE.Line(geo, gridMat));
        }

        for (let dRA = -this.radius; dRA <= this.radius; dRA += 1) {
            const pts = [];
            for (let dDec = -this.radius; dDec <= this.radius; dDec += 0.1) {
                const x = dRA * Math.cos((this.centerDec + dDec) * Math.PI / 180) * scale;
                const y = dDec * scale;
                pts.push(new THREE.Vector3(x, y, 0));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            group.add(new THREE.Line(geo, gridMat));
        }

        return group;
    }

    _createAxes() {
        const group = new THREE.Group();
        const scale = this.sphereRadius * Math.PI / 180;
        const len = (this.radius + 0.5) * scale;

        const raPts = [new THREE.Vector3(-len, 0, 0), new THREE.Vector3(len, 0, 0)];
        group.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(raPts),
            new THREE.LineBasicMaterial({ color: 0x4444ff })
        ));

        const decPts = [new THREE.Vector3(0, -len, 0), new THREE.Vector3(0, len, 0)];
        group.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(decPts),
            new THREE.LineBasicMaterial({ color: 0x44ff44 })
        ));

        const raLabel = this._makeTextSprite('RA →', { color: '#6688ff' });
        raLabel.position.set(len + 5, 0, 0);
        group.add(raLabel);

        const decLabel = this._makeTextSprite('Dec →', { color: '#66ff88' });
        decLabel.position.set(0, len + 5, 0);
        group.add(decLabel);

        return group;
    }

    _makeTextSprite(text, opts = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = opts.color || '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 32);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(12, 6, 1);
        return sprite;
    }

    _addBackgroundStars() {
        const count = 2000;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 500 + Math.random() * 500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0x555577, size: 0.5, sizeAttenuation: true });
        this._bgStars = new THREE.Points(geo, mat);
        this.scene.add(this._bgStars);
    }

    clearStars() {
        if (this.selectedGroup) {
            this._disposeGroup(this.selectedGroup);
            this.scene.remove(this.selectedGroup);
            this.selectedGroup = null;
        }
        for (const mesh of this.starMeshes) {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        }
        this.starMeshes = [];
    }

    _disposeGroup(group) {
        group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }

    renderSources(sources, type) {
        const colorMap = {
            gaia: 0x4488ff,
            '2mass': 0xff6644,
            matched: 0x44ff88
        };

        const baseColor = new THREE.Color(colorMap[type] || 0xffffff);
        const positions = [];
        const colors = [];

        for (let i = 0; i < sources.length; i++) {
            const src = sources[i];
            const pos = this._localizePosition(src.ra, src.dec);
            positions.push(pos.x, pos.y, pos.z);

            const c = baseColor.clone();
            if (src.mag) {
                const magVal = Object.values(src.mag)[0];
                const brightness = 1.0 - (magVal - 12) / 14;
                c.multiplyScalar(Math.max(0.3, Math.min(1.0, brightness)));
            }
            colors.push(c.r, c.g, c.b);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: this.pointSize,
            vertexColors: true,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.9
        });

        const points = new THREE.Points(geo, mat);
        points.userData.layerType = type;
        points._sourceData = sources.map(s => ({ source: s, type }));
        this.scene.add(points);
        this.starMeshes.push(points);

        return points;
    }

    renderMatchLines(matches) {
        const positions = [];
        for (const m of matches) {
            const p1 = this._localizePosition(m.gaia.ra, m.gaia.dec);
            const p2 = this._localizePosition(m.twomass.ra, m.twomass.dec);
            positions.push(p1.x, p1.y, p1.z);
            positions.push(p2.x, p2.y, p2.z);
        }

        if (positions.length === 0) return;

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({
            color: 0x44ff88,
            transparent: true,
            opacity: 0.2
        });
        const lines = new THREE.LineSegments(geo, mat);
        lines.userData.layerType = 'matchLines';
        this.scene.add(lines);
        this.starMeshes.push(lines);
    }

    updateVisibility() {
        for (const mesh of this.starMeshes) {
            const t = mesh.userData.layerType;
            if (t === 'gaia') mesh.visible = this.showGaia;
            else if (t === '2mass') mesh.visible = this.show2MASS;
            else if (t === 'matched') mesh.visible = this.showMatched;
            else if (t === 'matchLines') mesh.visible = this.showMatched;
        }
    }

    updatePointSize(size) {
        this.pointSize = size;
        for (const mesh of this.starMeshes) {
            if (mesh.material && mesh.material.size !== undefined) {
                mesh.material.size = size;
            }
        }
    }

    updateBackground(color) {
        this.bgColor = new THREE.Color(color).getHex();
        this.scene.background = new THREE.Color(this.bgColor);
    }

    highlightStar(source) {
        if (this.selectedGroup) {
            this._disposeGroup(this.selectedGroup);
            this.scene.remove(this.selectedGroup);
        }

        const pos = this._localizePosition(source.ra, source.dec);
        const group = new THREE.Group();

        const geo = new THREE.SphereGeometry(2.5, 16, 16);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.4,
            wireframe: true
        });
        const sphere = new THREE.Mesh(geo, mat);
        sphere.position.copy(pos);
        group.add(sphere);

        const ringGeo = new THREE.RingGeometry(4, 4.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.lookAt(this.camera.position);
        ring.userData.isRing = true;
        group.add(ring);

        this.selectedGroup = group;
        this.scene.add(group);
    }

    rebuildGrid() {
        if (this._gridGroup) {
            this.scene.remove(this._gridGroup);
            this._disposeGroup(this._gridGroup);
        }
        if (this._axisGroup) {
            this.scene.remove(this._axisGroup);
            this._disposeGroup(this._axisGroup);
        }
        this._gridGroup = this._createGrid();
        this._axisGroup = this._createAxes();
        this.scene.add(this._gridGroup);
        this.scene.add(this._axisGroup);
    }

    _setupEvents() {
        const canvas = this.webglRenderer.domElement;

        canvas.addEventListener('click', (e) => {
            this._updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.raycaster.params.Points.threshold = 4;

            const pointMeshes = this.starMeshes.filter(m => m.isPoints && m.visible);
            const intersects = this.raycaster.intersectObjects(pointMeshes);

            if (intersects.length > 0) {
                const hit = intersects[0];
                const mesh = hit.object;
                const idx = hit.index;
                if (mesh._sourceData && idx < mesh._sourceData.length) {
                    const data = mesh._sourceData[idx];
                    if (this.onStarClick) this.onStarClick(data);
                }
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            this._updateMouse(e);
            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.raycaster.params.Points.threshold = 3;

            const pointMeshes = this.starMeshes.filter(m => m.isPoints && m.visible);
            const intersects = this.raycaster.intersectObjects(pointMeshes);

            if (intersects.length > 0) {
                const hit = intersects[0];
                const mesh = hit.object;
                const idx = hit.index;
                if (mesh._sourceData && idx < mesh._sourceData.length) {
                    const data = mesh._sourceData[idx];
                    if (this.onStarHover) this.onStarHover(data);
                }
            } else if (this.onStarHover) {
                this.onStarHover(null);
            }
        });

        window.addEventListener('resize', () => this._onResize());
    }

    _updateMouse(e) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    _onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.webglRenderer.setSize(w, h);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        this.controls.update();

        if (this.selectedGroup) {
            this.selectedGroup.traverse((child) => {
                if (child.userData.isRing) {
                    child.lookAt(this.camera.position);
                }
            });
        }

        this.webglRenderer.render(this.scene, this.camera);
    }
}
