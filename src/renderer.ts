import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { type Action, type GameState, type Piece, symbols } from './rules';
const point = (i: number) => new T.Vector3((i % 8 - 3.5) * 1.12, .17, (Math.floor(i / 8) - 1.5) * 1.12);
function texture(draw: (c: CanvasRenderingContext2D) => void, size = 512): T.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d')!);
    const t = new T.CanvasTexture(canvas);
    t.colorSpace = T.SRGBColorSpace;
    return t;
}
function wood(): T.CanvasTexture {
    return texture(c => {
        c.fillStyle = '#61402a';
        c.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 1400; i++) {
            const y = Math.random() * 512;
            c.strokeStyle = `rgba(${Math.random() > .5 ? '22,9,3' : '194,143,81'},${Math.random() * .12})`;
            c.lineWidth = Math.random() * 2;
            c.beginPath();
            c.moveTo(0, y);
            c.bezierCurveTo(140, y + Math.random() * 14, 350, y - 9, 512, y + Math.random() * 8);
            c.stroke();
        }
    });
}
function face(p: Piece | null): T.CanvasTexture {
    return texture(c => {
        const g = c.createRadialGradient(210, 160, 20, 256, 256, 280);
        g.addColorStop(0, p ? '#efddb0' : '#60432a');
        g.addColorStop(1, p ? '#b39462' : '#2d2119');
        c.fillStyle = g;
        c.fillRect(0, 0, 512, 512);
        const ink = p ? (p.color === 'red' ? '#aa332b' : '#242e2b') : '#bd9858';
        c.strokeStyle = ink;
        c.lineWidth = 5;
        for (const r of [224, 211]) {
            c.beginPath();
            c.arc(256, 256, r, 0, Math.PI * 2);
            c.stroke();
        }
        if (p) {
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillStyle = 'rgba(255,255,230,.6)';
            c.font = 'bold 290px "Songti SC", "Noto Serif CJK SC", "SimSun", serif';
            c.fillText(symbols[p.color][p.rank], 259, 274);
            c.fillStyle = ink;
            c.fillText(symbols[p.color][p.rank], 256, 270);
        }
        else {
            c.save();
            c.translate(256, 256);
            for (let r = 0; r < 4; r++) {
                c.rotate(Math.PI / 2);
                c.lineWidth = 9;
                c.beginPath();
                c.moveTo(-125, -125);
                c.lineTo(115, -125);
                c.lineTo(115, -30);
                c.lineTo(30, -30);
                c.lineTo(30, -80);
                c.lineTo(75, -80);
                c.stroke();
            }
            c.rotate(Math.PI / 4);
            c.strokeRect(-42, -42, 84, 84);
            c.restore();
        }
    });
}
export class BoardRenderer {
    readonly renderer: T.WebGLRenderer;
    private scene = new T.Scene();
    private camera = new T.PerspectiveCamera(38, 1, .1, 80);
    private controls: OrbitControls;
    private meshes = new Map<string, T.Group>();
    private materials = new Map<string, T.MeshStandardMaterial>();
    private markers = new T.Group();
    private ray = new T.Raycaster();
    private pointer = new T.Vector2();
    private targets: T.Object3D[] = [];
    private frame = 0;
    private resize: ResizeObserver;
    private disposed = false;
    private hovering: T.Object3D | null = null;
    private tween: ((now: number) => void) | null = null;
    private ringGeometry = new T.RingGeometry(.40, .44, 64);
    private pieceGeometry: T.LatheGeometry;
    private diskGeometry = new T.CircleGeometry(.421, 64);
    private bodyMaterial: T.MeshStandardMaterial;
    private backMaterial: T.MeshStandardMaterial;
    private woodTexture = wood();
    private animationDone: (() => void) | null = null;
    private cameraTween: ((now: number) => void) | null = null;
    private onPick: (i: number) => void;
    private down: {
        x: number;
        y: number;
    } | null = null;
    reduced = false;
    constructor(private host: HTMLElement, onPick: (i: number) => void, reduced = false) {
        this.reduced = reduced;
        this.onPick = onPick;
        this.renderer = new T.WebGLRenderer({
            antialias: true, alpha: true
        });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = T.PCFSoftShadowMap;
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;
        host.append(this.renderer.domElement);
        this.renderer.domElement.setAttribute('aria-hidden', 'true');
        this.camera.position.set(0, 9.8, 8.8);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0, 0);
        this.controls.enableDamping = true;
        this.controls.enablePan = false;
        this.controls.minPolarAngle = .15;
        this.controls.maxPolarAngle = .92;
        this.controls.minAzimuthAngle = -.35;
        this.controls.maxAzimuthAngle = .35;
        this.controls.minDistance = 9;
        this.controls.maxDistance = 23;
        this.controls.mouseButtons.LEFT = T.MOUSE.ROTATE;
        this.controls.touches.ONE = T.TOUCH.ROTATE;
        this.scene.add(new T.HemisphereLight(0xffeed6, 0x384b43, 3));
        const sun = new T.DirectionalLight(0xffe0ac, 4);
        sun.position.set(-4, 9, 4);
        sun.castShadow = true;
        sun.shadow.mapSize.set(innerWidth < 700 ? 1024 : 2048, innerWidth < 700 ? 1024 : 2048);
        Object.assign(sun.shadow.camera, {
            left: -7, right: 7, top: 5, bottom: -5, near: .1, far: 25
        });
        sun.shadow.bias = -.0005;
        sun.shadow.normalBias = .02;
        sun.shadow.radius = 3;
        this.scene.add(sun);
        const fill = new T.DirectionalLight(0xb2cbc2, 1.4);
        fill.position.set(4, 4, -5);
        this.scene.add(fill);
        const boardMat = new T.MeshStandardMaterial({
            map: this.woodTexture, color: 0xa48b6c, roughness: .58
        });
        const frameMat = new T.MeshStandardMaterial({
            map: this.woodTexture, color: 0x5d3c29, roughness: .45
        });
        const box = (w: number, h: number, d: number, y: number, mat: T.Material) => {
            let geometry: T.BufferGeometry = new T.BoxGeometry(w, h, d);
            if (h > .08) {
                geometry.dispose();
                const shape = new T.Shape();
                shape.moveTo(-w / 2 + .04, -d / 2 + .04);
                shape.lineTo(w / 2 - .04, -d / 2 + .04);
                shape.lineTo(w / 2 - .04, d / 2 - .04);
                shape.lineTo(-w / 2 + .04, d / 2 - .04);
                shape.closePath();
                geometry = new T.ExtrudeGeometry(shape, { depth: h - .06, bevelEnabled: true, bevelThickness: .03, bevelSize: .04, bevelSegments: 3, steps: 1 });
                geometry.rotateX(-Math.PI / 2);
                geometry.translate(0, -(h - .06) / 2, 0);
            }
            const mesh = new T.Mesh(geometry, mat);
            mesh.position.y = y;
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            this.scene.add(mesh);
            return mesh;
        };
        box(9.65, .27, 5.15, -.22, frameMat);
        box(9.35, .12, 4.86, -.06, boardMat);
        const trim = new T.MeshStandardMaterial({
            color: 0x96703d, metalness: .55, roughness: .5
        });
        for (const z of [-2.44, 2.44]) {
            const m = box(9.4, .035, .025, .02, trim);
            m.position.z = z;
        }
        for (const x of [-4.7, 4.7]) {
            const m = box(.025, .035, 4.9, .02, trim);
            m.position.x = x;
        }
        const lines = new T.LineBasicMaterial({
            color: 0x281b13, transparent: true, opacity: .58
        });
        for (let row = 0; row <= 4; row++) {
            const z = (row - 2) * 1.12;
            this.scene.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-4.48, .009, z), new T.Vector3(4.48, .009, z)]), lines));
        }
        for (let col = 0; col <= 8; col++) {
            const x = (col - 4) * 1.12;
            this.scene.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(x, .009, -2.24), new T.Vector3(x, .009, 2.24)]), lines));
        }
        const ground = new T.Mesh(new T.PlaneGeometry(200, 200), new T.ShadowMaterial({
            opacity: .23
        }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -.37;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.pieceGeometry = new T.LatheGeometry([new T.Vector2(0, -.14), new T.Vector2(.39, -.14), new T.Vector2(.435, -.11), new T.Vector2(.45, -.055), new T.Vector2(.45, .055), new T.Vector2(.435, .11), new T.Vector2(.39, .14), new T.Vector2(0, .14)], 64);
        this.bodyMaterial = new T.MeshStandardMaterial({
            map: this.woodTexture, color: 0xd0a76b, roughness: .45
        });
        this.backMaterial = new T.MeshStandardMaterial({
            map: face(null), roughness: .62
        });
        this.scene.add(this.markers);
        for (let i = 0; i < 32; i++) {
            const tile = new T.Mesh(new T.PlaneGeometry(1.12, 1.12), new T.MeshBasicMaterial({
                visible: false, side: T.DoubleSide
            }));
            tile.rotation.x = -Math.PI / 2;
            tile.position.copy(point(i));
            tile.position.y = .025;
            tile.userData.square = i;
            this.scene.add(tile);
            this.targets.push(tile);
        }
        this.renderer.domElement.addEventListener('pointerdown', e => {
            this.down = {
                x: e.clientX, y: e.clientY
            };
        });
        this.renderer.domElement.addEventListener('pointerup', e => {
            if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 7) {
                const square = this.pick(e);
                if (square !== null)
                    this.onPick(square);
                else
                    this.onPick(-1);
            }
            this.down = null;
        });
        this.renderer.domElement.addEventListener('pointermove', e => {
            const i = this.pick(e);
            this.renderer.domElement.style.cursor = i === null ? 'grab' : 'pointer';
            if (this.hovering)
                this.hovering.scale.setScalar(1);
            this.hovering = [...this.meshes.values()].find(m => m.userData.square === i) ?? null;
            if (this.hovering && !this.tween)
                this.hovering.scale.setScalar(1.035);
        });
        this.resize = new ResizeObserver(() => this.fit());
        this.resize.observe(host);
        this.fit();
        if (!this.reduced) {
            this.camera.position.multiplyScalar(1.12);
            this.reset();
        }
        this.frame = requestAnimationFrame(this.tick);
    }
    private pick(e: PointerEvent): number | null {
        const r = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
        this.ray.setFromCamera(this.pointer, this.camera);
        const hit = this.ray.intersectObjects([...this.targets, ...this.meshes.values()], true)[0];
        let obj = hit?.object;
        while (obj && obj.userData.square === undefined)
            obj = obj.parent!;
        return obj?.userData.square ?? null;
    }
    private fit() {
        const w = this.host.clientWidth, h = this.host.clientHeight;
        if (!w || !h)
            return;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        const distance = Math.max(12, 6.2 / (Math.tan(T.MathUtils.degToRad(19)) * this.camera.aspect));
        this.controls.minDistance = distance * .78;
        this.controls.maxDistance = distance * 1.65;
        this.camera.position.set(0, distance * .76, distance * .65);
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }
    reset() {
        const start = this.camera.position.clone();
        this.fit();
        const end = this.camera.position.clone();
        if (this.reduced)
            return;
        this.camera.position.copy(start);
        const began = performance.now();
        this.cameraTween = now => {
            const t = Math.min(1, (now - began) / 650);
            this.camera.position.lerpVectors(start, end, t * t * (3 - 2 * t));
            if (t === 1)
                this.cameraTween = null;
        };
    }
    cancelAnimation() {
        this.tween = null;
        this.animationDone?.();
        this.animationDone = null;
    }
    private tick = (now: number) => {
        if (this.disposed)
            return;
        this.cameraTween?.(now);
        this.tween?.(now);
        this.controls.update();
        if (!document.hidden)
            this.renderer.render(this.scene, this.camera);
        this.frame = requestAnimationFrame(this.tick);
    };
    private make(p: Piece): T.Group {
        const g = new T.Group();
        const body = new T.Mesh(this.pieceGeometry, this.bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        g.add(body);
        const key = p.color + p.rank;
        let mat = this.materials.get(key);
        if (!mat) {
            mat = new T.MeshStandardMaterial({
                map: face(p), roughness: .56
            });
            this.materials.set(key, mat);
        }
        const top = new T.Mesh(this.diskGeometry, mat);
        top.rotation.x = -Math.PI / 2;
        top.position.y = .142;
        g.add(top);
        const back = new T.Mesh(this.diskGeometry, this.backMaterial);
        back.rotation.x = Math.PI / 2;
        back.position.y = -.142;
        g.add(back);
        return g;
    }
    sync(s: GameState) {
        for (const [id, m] of this.meshes)
            if (!s.board.some(p => p?.id === id)) {
                this.scene.remove(m);
                this.meshes.delete(id);
            }
        s.board.forEach((p, i) => {
            if (!p)
                return;
            let m = this.meshes.get(p.id);
            if (!m) {
                m = this.make(p);
                this.scene.add(m);
                this.meshes.set(p.id, m);
            }
            m.position.copy(point(i));
            m.rotation.set(p.revealed ? 0 : Math.PI, 0, 0);
            m.scale.setScalar(1);
            m.userData.square = i;
        });
    }
    highlight(selected: number | null, actions: Action[], last: number | null) {
        while (this.markers.children.length) {
            const child = this.markers.children[0] as T.Mesh;
            this.markers.remove(child);
            (child.material as T.Material).dispose();
        }
        const add = (i: number, color: number, radius = 1) => {
            const ring = new T.Mesh(this.ringGeometry, new T.MeshBasicMaterial({
                color, transparent: true, opacity: .9, side: T.DoubleSide
            }));
            ring.rotation.x = -Math.PI / 2;
            ring.position.copy(point(i));
            ring.position.y = .04;
            ring.scale.setScalar(radius);
            this.markers.add(ring);
        };
        if (last !== null)
            add(last, 0x99784e, 1.16);
        if (selected !== null)
            add(selected, 0xf4d68a, 1.18);
        actions.forEach(a => {
            if (a.type === 'MOVE' || a.type === 'CAPTURE')
                add(a.to, a.type === 'CAPTURE' ? 0xec8d70 : 0xbed3a2, a.type === 'MOVE' ? .55 : 1.17);
        });
    }
    async animate(before: GameState, after: GameState, a: Action): Promise<void> {
        if (this.reduced || a.type === 'RESIGN') {
            this.sync(after);
            return;
        }
        this.sync(before);
        const idx = a.type === 'FLIP' ? a.at : a.from, m = this.meshes.get(before.board[idx]!.id)!;
        const victim = a.type === 'CAPTURE' ? this.meshes.get(before.board[a.to]!.id) : null;
        const start = point(idx), dest = a.type === 'FLIP' ? start : point(a.to), duration = a.type === 'FLIP' ? 580 : a.type === 'CAPTURE' ? 480 : 340;
        await new Promise<void>(resolve => {
            this.animationDone = resolve;
            const began = performance.now();
            this.tween = now => {
                const t = Math.min(1, (now - began) / duration), ease = t * t * (3 - 2 * t);
                m.position.lerpVectors(start, dest, ease);
                if (a.type === 'FLIP') {
                    m.rotation.x = Math.PI * (1 - ease);
                    m.position.y += Math.sin(Math.PI * t) * .65;
                }
                else
                    m.position.y += Math.sin(Math.PI * t) * .12;
                if (victim) {
                    victim.position.y = .17 + t * .8;
                    victim.scale.setScalar(Math.max(.01, 1 - ease));
                }
                if (t >= 1) {
                    this.tween = null;
                    this.animationDone = null;
                    this.sync(after);
                    resolve();
                }
            };
        });
    }
    dispose() {
        this.cancelAnimation();
        this.disposed = true;
        cancelAnimationFrame(this.frame);
        this.resize.disconnect();
        this.controls.dispose();
        const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
        this.scene.traverse(o => {
            if (o instanceof T.Mesh || o instanceof T.Line) {
                geometries.add(o.geometry);
                const ms = Array.isArray(o.material) ? o.material : [o.material];
                ms.forEach(m => materials.add(m));
            }
        });
        this.materials.forEach(m => materials.add(m));
        materials.forEach(m => {
            const map = (m as T.MeshStandardMaterial).map;
            if (map)
                textures.add(map);
            m.dispose();
        });
        textures.forEach(t => t.dispose());
        geometries.forEach(g => g.dispose());
        this.scene.traverse(o => { if (o instanceof T.DirectionalLight) o.shadow.map?.dispose(); });
        this.ringGeometry.dispose();
        this.pieceGeometry.dispose();
        this.diskGeometry.dispose();
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
