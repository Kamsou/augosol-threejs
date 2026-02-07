import * as THREE from 'three'
import { PENSIONS } from '../utils/Constants.js'

export default class PathSystem {
  constructor(scene, terrain) {
    this.scene = scene
    this.terrain = terrain

    const pathMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
      metalness: 0.0,
    })

    const origin = new THREE.Vector3(0, 0, 0)

    for (const key of Object.keys(PENSIONS)) {
      const target = PENSIONS[key].position
      this._createPath(origin, target, pathMat)
    }
  }

  _createPath(from, to, material) {
    const segments = 40
    const baseWidth = 2.2

    const points = []
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const x = THREE.MathUtils.lerp(from.x, to.x, t)
      const z = THREE.MathUtils.lerp(from.z, to.z, t)

      const perpX = -(to.z - from.z)
      const perpZ = (to.x - from.x)
      const len = Math.sqrt(perpX * perpX + perpZ * perpZ)
      const curve = Math.sin(t * Math.PI) * 5
      const cx = x + (perpX / len) * curve * (Math.random() > 0.5 ? 1 : -1) * 0.3
      const cz = z + (perpZ / len) * curve * 0.3
      const y = this.terrain.getHeightAt(cx, cz) + 0.06
      points.push(new THREE.Vector3(cx, y, cz))
    }

    const vertices = []
    const colors = []
    const indices = []

    const centerColor = new THREE.Color(0xc4a060)
    const edgeColor = new THREE.Color(0x8a7040)

    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      let dir
      if (i < points.length - 1) {
        dir = new THREE.Vector3().subVectors(points[i + 1], p).normalize()
      } else {
        dir = new THREE.Vector3().subVectors(p, points[i - 1]).normalize()
      }

      const perp = new THREE.Vector3(-dir.z, 0, dir.x)

      const t = i / (points.length - 1)
      const widthNoise = 0.85 + Math.sin(t * 12) * 0.1 + Math.sin(t * 5.3) * 0.05
      const halfW = (baseWidth / 2) * widthNoise

      const edgeJitter = Math.sin(i * 1.7) * 0.15

      vertices.push(
        p.x - perp.x * halfW, p.y + edgeJitter * 0.02, p.z - perp.z * halfW,
        p.x + perp.x * halfW, p.y - edgeJitter * 0.02, p.z + perp.z * halfW,
      )

      const variation = Math.random() * 0.04 - 0.02
      const leftCol = edgeColor.clone()
      leftCol.r += variation
      leftCol.g += variation
      const rightCol = edgeColor.clone()
      rightCol.r -= variation
      rightCol.g -= variation

      colors.push(leftCol.r, leftCol.g, leftCol.b)
      colors.push(rightCol.r, rightCol.g, rightCol.b)

      if (i < points.length - 1) {
        const base = i * 2
        indices.push(base, base + 1, base + 2)
        indices.push(base + 1, base + 3, base + 2)
      }
    }


    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()

    const mesh = new THREE.Mesh(geometry, material)
    mesh.receiveShadow = true
    this.scene.add(mesh)
  }
}
