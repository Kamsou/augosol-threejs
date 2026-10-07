import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const MAP_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap']
const MERGEABLE = new Set(['MeshStandardMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial', 'MeshBasicMaterial'])

// Cloned assets each carry their own copy of the same material: key them by what they look like
function materialKey(m) {
  return [
    m.type, m.color?.getHex(), m.emissive?.getHex(), m.emissiveIntensity,
    m.roughness, m.metalness, m.side, m.flatShading, m.vertexColors, m.alphaTest, m.envMapIntensity,
    ...MAP_SLOTS.map(slot => m[slot]?.uuid),
  ].join('|')
}

function usesMaps(m) {
  return MAP_SLOTS.some(slot => m[slot])
}

function toFloat(attr) {
  const out = new Float32Array(attr.count * attr.itemSize)
  for (let i = 0; i < attr.count; i++) {
    for (let c = 0; c < attr.itemSize; c++) out[i * attr.itemSize + c] = attr.getComponent(i, c)
  }
  return new THREE.BufferAttribute(out, attr.itemSize)
}

function prepare(mesh, rootInverse, material) {
  const src = mesh.geometry
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', toFloat(src.attributes.position))
  if (src.attributes.normal) geo.setAttribute('normal', toFloat(src.attributes.normal))
  else geo.computeVertexNormals()
  if (usesMaps(material)) {
    if (!src.attributes.uv) return null
    geo.setAttribute('uv', toFloat(src.attributes.uv))
  }
  if (material.vertexColors) {
    if (!src.attributes.color) return null
    geo.setAttribute('color', toFloat(src.attributes.color))
  }
  if (src.index) geo.setIndex(Array.from(src.index.array))
  else geo.setIndex([...Array(src.attributes.position.count).keys()])

  mesh.updateWorldMatrix(true, false)
  geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld))
  return geo
}

// Collapse the static, opaque meshes under `root` into one mesh per distinct material.
// Anything animated or special (transparent, shader, skinned, multi-material) is left alone.
export function mergeStatic(root, isExcluded = () => false) {
  root.updateMatrixWorld(true)
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map()

  root.traverse(obj => {
    // Leaves only: removing a parent would also drop its unmerged children
    if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh || !obj.visible || obj.children.length) return
    if (Array.isArray(obj.material) || isExcluded(obj)) return
    const m = obj.material
    if (!MERGEABLE.has(m.type) || m.transparent || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return
    const key = materialKey(m)
    if (!buckets.has(key)) buckets.set(key, { material: m, meshes: [] })
    buckets.get(key).meshes.push(obj)
  })

  let removed = 0
  for (const { material, meshes } of buckets.values()) {
    if (meshes.length < 2) continue
    const geometries = []
    const used = []
    for (const mesh of meshes) {
      const geo = prepare(mesh, rootInverse, material)
      if (geo) {
        geometries.push(geo)
        used.push(mesh)
      }
    }
    if (geometries.length < 2) continue
    const merged = mergeGeometries(geometries, false)
    if (!merged) continue

    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = used.some(m => m.castShadow)
    mesh.receiveShadow = used.some(m => m.receiveShadow)
    root.add(mesh)
    for (const m of used) {
      m.parent.remove(m)
      removed++
    }
    for (const g of geometries) g.dispose()
  }
  return removed
}
