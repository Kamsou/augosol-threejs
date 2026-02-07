import * as THREE from 'three'

export default class Particles {
  constructor(scene) {
    this.scene = scene
    this._time = 0

    this._createAmbientParticles()
    this._createFallingLeaves()
  }

  _createAmbientParticles() {
    const count = 150
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const particleColors = [
      new THREE.Color(0xffe5c4),
      new THREE.Color(0xf59e0b),
      new THREE.Color(0xfbbf4d),
      new THREE.Color(0xd4a87a),
    ]

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200
      positions[i * 3 + 1] = 1 + Math.random() * 15
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200

      const color = particleColors[Math.floor(Math.random() * particleColors.length)]
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
    })

    this.particles = new THREE.Points(geometry, material)
    this.scene.add(this.particles)

    this._positions = positions
    this._count = count
  }

  _createFallingLeaves() {
    const leafCount = 20
    const leafGeo = new THREE.PlaneGeometry(0.25, 0.35)
    const leafMat = new THREE.MeshBasicMaterial({
      color: 0x9a7b3a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    })

    this._leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafCount)
    this._leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    this._leafData = []
    const dummy = new THREE.Matrix4()

    for (let i = 0; i < leafCount; i++) {
      const data = {
        x: (Math.random() - 0.5) * 200,
        y: 5 + Math.random() * 20,
        z: (Math.random() - 0.5) * 200,
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        rz: Math.random() * Math.PI,
        speed: 0.3 + Math.random() * 0.5,
        drift: (Math.random() - 0.5) * 0.5,
        rotSpeed: (Math.random() - 0.5) * 2,
      }
      this._leafData.push(data)

      const color = new THREE.Color()
      color.setHSL(0.08 + Math.random() * 0.1, 0.4 + Math.random() * 0.3, 0.3 + Math.random() * 0.2)
      this._leafMesh.setColorAt(i, color)
    }

    if (this._leafMesh.instanceColor) this._leafMesh.instanceColor.needsUpdate = true
    this.scene.add(this._leafMesh)
    this._leafDummy = new THREE.Matrix4()
    this._leafEuler = new THREE.Euler()
  }

  update(dt) {
    this._time += dt

    const positions = this.particles.geometry.attributes.position.array
    for (let i = 0; i < this._count; i++) {
      positions[i * 3 + 1] += Math.sin(this._time + i * 0.5) * 0.003
      positions[i * 3] += Math.sin(this._time * 0.5 + i) * 0.002
      positions[i * 3 + 2] += Math.cos(this._time * 0.3 + i) * 0.002
    }
    this.particles.geometry.attributes.position.needsUpdate = true
    this.particles.material.opacity = 0.4 + Math.sin(this._time * 0.8) * 0.2

    const dummy = this._leafDummy
    const euler = this._leafEuler
    for (let i = 0; i < this._leafData.length; i++) {
      const d = this._leafData[i]
      d.y -= d.speed * dt
      d.x += d.drift * dt
      d.rx += d.rotSpeed * dt
      d.rz += d.rotSpeed * 0.5 * dt

      if (d.y < -1) {
        d.y = 15 + Math.random() * 10
        d.x = (Math.random() - 0.5) * 200
        d.z = (Math.random() - 0.5) * 200
      }

      euler.set(d.rx, d.ry, d.rz)
      dummy.makeRotationFromEuler(euler)
      dummy.setPosition(d.x, d.y, d.z)
      this._leafMesh.setMatrixAt(i, dummy)
    }
    this._leafMesh.instanceMatrix.needsUpdate = true
  }
}
