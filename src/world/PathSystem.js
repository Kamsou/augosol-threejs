import * as THREE from 'three'
import { PENSIONS, COURSE, coursePoint } from '../utils/Constants.js'

export default class PathSystem {
  constructor(scene, terrain) {
    this.scene = scene
    this.terrain = terrain
    this.pathPoints = []
    // Trail from the spawn to each pension, as [{ key, points: [{ x, z }] }]
    this.trails = []

    const origin = new THREE.Vector3(0, 0, 0)

    for (const key of Object.keys(PENSIONS)) {
      const pensionPos = PENSIONS[key].position
      const dir = new THREE.Vector3().subVectors(pensionPos, origin).normalize()
      const stopDistance = 16
      const target = new THREE.Vector3().copy(pensionPos).sub(dir.multiplyScalar(stopDistance))
      this.trails.push({ key, points: this._generatePathPoints(origin, target) })
    }

    // A trail to the jumping course, ending a little before the start gate
    const gate = coursePoint(Math.PI)
    const toGate = new THREE.Vector3().subVectors(gate, origin)
    this._generatePathPoints(origin, gate.clone().sub(toGate.normalize().multiplyScalar(6)))

    // The course's riding track: mown, dirt ring through the jumps and the arch
    const [rx, rz] = COURSE.radii
    const perimeter = Math.PI * (3 * (rx + rz) - Math.sqrt((3 * rx + rz) * (rx + 3 * rz)))
    const samples = Math.ceil(perimeter / 1.2)
    const point = new THREE.Vector3()
    for (let i = 0; i < samples; i++) {
      coursePoint((i / samples) * Math.PI * 2, point)
      this.pathPoints.push(point.x, point.z)
    }

    terrain.setPathPoints(new Float32Array(this.pathPoints))
  }

  _generatePathPoints(from, to) {
    const segments = 40
    const points = []

    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const x = THREE.MathUtils.lerp(from.x, to.x, t)
      const z = THREE.MathUtils.lerp(from.z, to.z, t)

      // Add curve variation (existing algorithm)
      const perpX = -(to.z - from.z)
      const perpZ = (to.x - from.x)
      const len = Math.sqrt(perpX * perpX + perpZ * perpZ)
      const curve = Math.sin(t * Math.PI) * 5
      const cx = x + (perpX / len) * curve * 0.3
      const cz = z + (perpZ / len) * curve * 0.3

      // Store flattened x, z coordinates
      this.pathPoints.push(cx, cz)
      points.push({ x: cx, z: cz })
    }
    return points
  }
}
