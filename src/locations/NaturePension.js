import * as THREE from 'three'
import PensionLocation from './PensionLocation.js'

export default class NaturePension extends PensionLocation {
  build() {
    // Lush grass ground
    const grassGeo = new THREE.CircleGeometry(18, 24)
    grassGeo.rotateX(-Math.PI / 2)
    const grass = new THREE.Mesh(grassGeo, new THREE.MeshStandardMaterial({
      color: 0x5a8a3a, flatShading: true, roughness: 0.95,
    }))
    grass.position.y = 0.01
    this.group.add(grass)

    // Trees around the perimeter
    const treeTypes = ['tree_pine', 'tree_oak', 'tree_birch']
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2
      const radius = 10 + Math.random() * 8
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const type = treeTypes[i % treeTypes.length]
      const scale = 0.7 + Math.random() * 0.6

      if (!this._placeAsset(type, { x, y: 0, z }, Math.random() * Math.PI * 2, scale)) {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.35, 3, 5),
          new THREE.MeshStandardMaterial({ color: 0x5a3a1a, flatShading: true })
        )
        trunk.position.set(x, 1.5, z)
        trunk.castShadow = true
        this.group.add(trunk)

        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(1.5, 4, 6),
          new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x3a6b2a : 0x4a8035, flatShading: true })
        )
        crown.position.set(x, 4, z)
        crown.castShadow = true
        this.group.add(crown)
      }
    }

    // Pond with animated water shader
    const pondGeo = new THREE.CircleGeometry(4, 24)
    pondGeo.rotateX(-Math.PI / 2)
    this._pondMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x2288aa) },
        uOpacity: { value: 0.75 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.y += sin(pos.x * 2.0 + uTime * 1.5) * 0.05;
          pos.y += cos(pos.z * 3.0 + uTime * 2.0) * 0.03;
          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          float wave = sin(vUv.x * 8.0 + uTime) * 0.5 + 0.5;
          float wave2 = cos(vUv.y * 6.0 + uTime * 0.7) * 0.5 + 0.5;
          vec3 col = uColor + vec3(0.05, 0.08, 0.12) * wave * wave2;
          float fresnel = pow(1.0 - abs(dot(normalize(vec3(0.0, 1.0, 0.0)), normalize(vWorldPos))), 2.0);
          col += vec3(0.15) * fresnel;
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    })
    const pond = new THREE.Mesh(pondGeo, this._pondMat)
    pond.position.set(3, 0.05, -2)
    this.group.add(pond)

    // Rocks around pond
    const rockTypes = ['rock_1', 'rock_2', 'rock_3']
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const type = rockTypes[i % rockTypes.length]
      const pos = {
        x: 3 + Math.cos(angle) * 4.3,
        y: 0,
        z: -2 + Math.sin(angle) * 4.3,
      }
      if (!this._placeAsset(type, pos, Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.3)) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.4, 0),
          new THREE.MeshStandardMaterial({ color: 0x8a8070, flatShading: true })
        )
        rock.position.set(pos.x, 0.15, pos.z)
        rock.rotation.set(Math.random(), Math.random(), Math.random())
        this.group.add(rock)
      }
    }

    // Open shelter
    const shelterWood = new THREE.MeshStandardMaterial({ color: 0x6b4226, flatShading: true })
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, flatShading: true })
    const shelterPosts = [[-4, -6], [-4, -3], [-1, -6], [-1, -3]]
    for (const [sx, sz] of shelterPosts) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 2.8, 5),
        shelterWood
      )
      post.position.set(sx, 1.4, sz)
      post.castShadow = true
      this.group.add(post)
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 4), roofMat)
    roof.position.set(-2.5, 2.9, -4.5)
    roof.castShadow = true
    this.group.add(roof)

    // Wooden fence with double rails
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, flatShading: true })
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2
      const r = 14
      const pos = { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r }

      if (!this._placeAsset('fence_wood', pos, angle + Math.PI / 2, 0.6)) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 1.2, 4),
          woodMat
        )
        post.position.set(pos.x, 0.6, pos.z)
        this.group.add(post)
      }

      // Rails between posts
      if (i < 15) {
        const nextAngle = ((i + 1) / 16) * Math.PI * 2
        const ax = Math.cos(angle) * r, az = Math.sin(angle) * r
        const bx = Math.cos(nextAngle) * r, bz = Math.sin(nextAngle) * r
        const dx = bx - ax, dz = bz - az
        const len = Math.sqrt(dx * dx + dz * dz)

        for (const h of [0.4, 0.8]) {
          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(len, 0.06, 0.06),
            woodMat
          )
          rail.position.set((ax + bx) / 2, h, (az + bz) / 2)
          rail.rotation.y = -Math.atan2(dz, dx)
          this.group.add(rail)
        }
      }
    }

    // Wildflowers
    for (let i = 0; i < 25; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 2 + Math.random() * 11
      const type = i % 2 === 0 ? 'flower_1' : 'flower_2'
      const pos = { x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r }

      if (!this._placeAsset(type, pos, Math.random() * Math.PI * 2, 0.4 + Math.random() * 0.4)) {
        const flowerColors = [0xf59e0b, 0xfbbf4d, 0xffffff]
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 4, 3),
          new THREE.MeshStandardMaterial({ color: flowerColors[i % 3], flatShading: true })
        )
        flower.position.set(pos.x, 0.15, pos.z)
        this.group.add(flower)
      }
    }

    // Grass clumps
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 3 + Math.random() * 10
      this._placeAsset('grass_clump', {
        x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r,
      }, Math.random() * Math.PI * 2, 0.5 + Math.random() * 0.5)
    }

    // Bushes
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const r = 10 + Math.random() * 3
      this._placeAsset(
        i % 2 === 0 ? 'bush_1' : 'bush_2',
        { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r },
        Math.random() * Math.PI * 2,
        0.6 + Math.random() * 0.4
      )
    }
  }

  update(dt) {
    super.update(dt)
    if (this._pondMat) {
      this._pondMat.uniforms.uTime.value += dt
    }
  }
}
