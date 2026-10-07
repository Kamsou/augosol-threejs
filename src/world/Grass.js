import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'
import { WORLD_SIZE, TERRAIN_SEGMENTS, PENSIONS, GRASS, SUN_DIRECTION } from '../utils/Constants.js'
import { WIND, WIND_GLSL } from './Wind.js'

const MASK_RES = 512

// Injected into MeshLambertMaterial so blades get the scene lights, fog and the sun's shadows
const vertexPars = /* glsl */ `
  ${WIND_GLSL}

  uniform sampler2D uGroundMap;
  uniform sampler2D uMask;
  uniform float uWorldSize;
  uniform float uGridRes;
  uniform float uTileSize;
  uniform float uMaxBlades;
  uniform vec3 uPlayerPos;
  uniform float uPushRadius;
  uniform float uBladeWidth;
  uniform float uBladeHeight;
  uniform vec2 uDensityRange;
  uniform float uMinDensity;
  uniform vec2 uFadeRange;

  attribute vec2 aOffset;
  attribute vec4 aRand;

  varying float vT;
  varying float vRand;
  varying float vGust;
  varying vec3 vGrassWorld;
`

// Replaces <beginnormal_vertex>: computes the blade and the normal it is lit with
const vertexBlade = /* glsl */ `
  // Each tile reuses the same random layout, rotated/mirrored per tile to hide the repetition
  vec2 tileOrigin = modelMatrix[3].xz;
  float tileHash = fract(sin(dot(floor(tileOrigin / uTileSize + 0.5), vec2(12.9898, 78.233))) * 43758.5453);
  vec2 local = aOffset - uTileSize * 0.5;
  if (tileHash > 0.5) local.x = -local.x;
  float quarter = floor(fract(tileHash * 7.13) * 4.0);
  if (quarter >= 1.0) local = vec2(-local.y, local.x);
  if (quarter >= 2.0) local = -local;
  if (quarter >= 3.0) local = vec2(-local.y, local.x);
  vec2 worldXZ = tileOrigin + local + uTileSize * 0.5;

  // One fetch: height + terrain normal
  vec2 g = (worldXZ + uWorldSize * 0.5) / uWorldSize * (uGridRes - 1.0);
  vec4 groundData = texture2D(uGroundMap, (g + 0.5) / uGridRes);
  float ground = groundData.r;
  vec3 terrainNormal = normalize(groundData.gba);

  // One fetch: grass mask (paths, yards) + clump noise
  vec2 maskData = texture2D(uMask, (worldXZ + uWorldSize * 0.5) / uWorldSize).rg;

  // Density thins out continuously with distance: no visible LOD steps
  float dist = length(worldXZ - uPlayerPos.xz);
  float density = mix(1.0, uMinDensity, smoothstep(uDensityRange.x, uDensityRange.y, dist));
  float rank = float(gl_InstanceID) / uMaxBlades;
  float keep = 1.0 - smoothstep(density - 0.04, density, rank);
  float edgeFade = 1.0 - smoothstep(uFadeRange.x, uFadeRange.y, dist);
  // Only bare on steep banks
  float terrainOk = smoothstep(0.55, 0.75, terrainNormal.y);

  float bladeH = uBladeHeight * aRand.x * (0.55 + maskData.g * 0.9) * maskData.r * edgeFade * terrainOk * keep;

  float t = position.y;
  float side = position.x;
  // Sparser far blades get wider so the meadow keeps its coverage
  float width = uBladeWidth * (0.75 + aRand.z * 0.5) * (1.0 - t * 0.6) * min(inversesqrt(density), 2.0);

  float ang = aRand.y * 6.2831853;
  vec2 facing = vec2(cos(ang), sin(ang));
  vec2 perp = vec2(-facing.y, facing.x);

  vec3 p = vec3(perp.x * side * width, t * bladeH, perp.y * side * width);

  // Wind: travelling gusts + per-blade flutter
  float gust = windGust(worldXZ);
  float flutter = sin(uTime * 2.6 + aRand.w * 25.0 + worldXZ.x * 0.35) * 0.14;
  float windAmt = (gust * 1.15 + flutter) * uWindStrength;
  vec2 bend = facing * (0.12 + aRand.w * 0.3) + uWindDir * windAmt;

  // The horse parts the grass around its hooves
  vec2 toBlade = worldXZ - uPlayerPos.xz;
  float push = 1.0 - smoothstep(uPushRadius * 0.25, uPushRadius, dist);
  bend += (toBlade / max(dist, 0.001)) * push * 1.7;

  float k = t * t;
  float bendLen = min(length(bend), 1.6);
  p.xz += bend * k * bladeH * 0.85;
  p.y *= 1.0 - bendLen * 0.3 * k;

  vec3 grassWorld = vec3(worldXZ.x + p.x, ground - 0.06 + p.y, worldXZ.y + p.z);

  // Mostly the terrain normal (soft, meadow-like shading), tilted a bit with the bend
  vec3 objectNormal = normalize(terrainNormal + vec3(bend.x, 0.0, bend.y) * 0.25 * t);

  vT = t;
  vRand = aRand.z;
  vGust = gust;
  vGrassWorld = grassWorld;
`

const fragmentPars = /* glsl */ `
  ${WIND_GLSL}

  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform vec3 uDryColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;

  varying float vT;
  varying float vRand;
  varying float vGust;
  varying vec3 vGrassWorld;
`

const fragmentColor = /* glsl */ `
  float dry = smoothstep(0.55, 0.9, windNoise(vGrassWorld.xz * 0.025 + 41.0));

  vec3 grassCol = mix(uBaseColor, uTipColor, smoothstep(0.0, 1.0, vT));
  grassCol = mix(grassCol, uDryColor * (0.6 + 0.4 * vT), dry * 0.4);
  grassCol *= 0.82 + vRand * 0.36;
  // Self-occlusion near the roots
  grassCol *= mix(0.45, 1.0, smoothstep(0.0, 0.6, vT));
  diffuseColor.rgb = grassCol;
`

const fragmentEmissive = /* glsl */ `
  #include <emissivemap_fragment>
  // Golden back-light shining through the blades, and a sheen where gusts bend the meadow
  vec3 grassView = normalize(vGrassWorld - cameraPosition);
  float backlit = pow(max(dot(grassView, uSunDir), 0.0), 3.0);
  totalEmissiveRadiance += uSunColor * vT * (backlit * 0.35 + vGust * vGust * 0.06);
`

// Lit from the terrain normal on both faces: never flip it for back faces
const normalBegin = THREE.ShaderChunk.normal_fragment_begin.replace(/normal\s*\*=\s*faceDirection;/g, '')

// The meadow is a ring of tiles that follows the rider. Each tile is its own mesh,
// so three.js frustum-culls it, and far tiles draw fewer, simpler blades.
export default class Grass {
  constructor(scene, terrain) {
    this.scene = scene
    this.terrain = terrain

    const tile = GRASS.tileSize
    this._maxBlades = Math.round(tile * tile * GRASS.density)
    this._radius = GRASS.rings * tile

    this.uniforms = {
      ...WIND,
      uGroundMap: { value: this._createGroundTexture() },
      uMask: { value: this._createMaskTexture() },
      uWorldSize: { value: WORLD_SIZE },
      uGridRes: { value: TERRAIN_SEGMENTS + 1 },
      uTileSize: { value: tile },
      uMaxBlades: { value: this._maxBlades },
      uPlayerPos: { value: new THREE.Vector3() },
      uPushRadius: { value: GRASS.pushRadius },
      uBladeWidth: { value: GRASS.bladeWidth },
      uBladeHeight: { value: GRASS.bladeHeight },
      uDensityRange: { value: new THREE.Vector2(...GRASS.densityRange) },
      uMinDensity: { value: GRASS.minDensity },
      uFadeRange: { value: new THREE.Vector2(this._radius - 12, this._radius) },
      uBaseColor: { value: new THREE.Color(0x1b3612) },
      uTipColor: { value: new THREE.Color(0x6a9a38) },
      uDryColor: { value: new THREE.Color(0xb8995a) },
      uSunColor: { value: new THREE.Color(0xffc285) },
      uSunDir: { value: SUN_DIRECTION.clone() },
    }

    this.material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${vertexPars}`)
        .replace('#include <beginnormal_vertex>', vertexBlade)
        // three.js applies the tile's modelMatrix afterwards, so go back to tile-local space
        .replace('#include <begin_vertex>', 'vec3 transformed = grassWorld - modelMatrix[3].xyz;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${fragmentPars}`)
        .replace('#include <color_fragment>', fragmentColor)
        .replace('#include <normal_fragment_begin>', normalBegin)
        .replace('#include <emissivemap_fragment>', fragmentEmissive)
    }

    this._createLods()
    this._createTiles()
  }

  _density(dist) {
    const [a, b] = GRASS.densityRange
    const t = THREE.MathUtils.clamp((dist - a) / (b - a), 0, 1)
    return THREE.MathUtils.lerp(1, GRASS.minDensity, t * t * (3 - 2 * t))
  }

  _createLods() {
    const tile = GRASS.tileSize
    const offsets = new Float32Array(this._maxBlades * 2)
    const rand = new Float32Array(this._maxBlades * 4)
    for (let i = 0; i < this._maxBlades; i++) {
      offsets[i * 2] = Math.random() * tile
      offsets[i * 2 + 1] = Math.random() * tile
      rand[i * 4] = 0.6 + Math.random() * 0.6
      rand[i * 4 + 1] = Math.random()
      rand[i * 4 + 2] = Math.random()
      rand[i * 4 + 3] = Math.random()
    }
    // Shared by every LOD: a LOD only draws the first N blades (they are uniformly spread)
    const offsetAttr = new THREE.InstancedBufferAttribute(offsets, 2)
    const randAttr = new THREE.InstancedBufferAttribute(rand, 4)
    const sphere = new THREE.Sphere(new THREE.Vector3(tile / 2, 0, tile / 2), tile * 0.75 + 6)

    this._lods = GRASS.lods.map(([from, segments]) => {
      const geometry = this._createBladeGeometry(segments)
      geometry.setAttribute('aOffset', offsetAttr)
      geometry.setAttribute('aRand', randAttr)
      // Enough blades for the densest point a tile of this LOD can contain
      geometry.instanceCount = Math.ceil(this._maxBlades * Math.min(this._density(from) + 0.04, 1))
      geometry.boundingSphere = sphere
      return { from, geometry }
    })
  }

  _createBladeGeometry(segments) {
    const positions = []
    const indices = []

    for (let i = 0; i < segments; i++) {
      const t = i / segments
      positions.push(-0.5, t, 0, 0.5, t, 0)
    }
    positions.push(0, 1, 0)

    for (let i = 0; i < segments - 1; i++) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const last = (segments - 1) * 2
    indices.push(last, last + 1, last + 2)

    const geometry = new THREE.InstancedBufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    return geometry
  }

  _createTiles() {
    const side = GRASS.rings * 2 + 1
    this._tiles = []
    for (let i = 0; i < side * side; i++) {
      const mesh = new THREE.Mesh(this._lods[0].geometry, this.material)
      mesh.receiveShadow = true
      mesh.matrixAutoUpdate = false
      mesh.visible = false
      mesh.position.set(Infinity, 0, Infinity)
      this.scene.add(mesh)
      this._tiles.push(mesh)
    }
  }

  // Terrain height + normal baked into one float texture so the vertex shader plants blades anywhere
  _createGroundTexture() {
    const res = TERRAIN_SEGMENTS + 1
    const positions = this.terrain.geometry.attributes.position
    const normals = this.terrain.geometry.attributes.normal
    const data = new Uint16Array(res * res * 4)
    const toHalf = THREE.DataUtils.toHalfFloat
    for (let i = 0; i < res * res; i++) {
      data[i * 4] = toHalf(positions.getY(i))
      data[i * 4 + 1] = toHalf(normals.getX(i))
      data[i * 4 + 2] = toHalf(normals.getY(i))
      data[i * 4 + 3] = toHalf(normals.getZ(i))
    }

    const texture = new THREE.DataTexture(data, res, res, THREE.RGBAFormat, THREE.HalfFloatType)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    return texture
  }

  // R: white = grass, black = bare ground (paths, pension yards). G: clump height noise
  _createMaskTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = MASK_RES
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, MASK_RES, MASK_RES)

    const toPx = (v) => (v + WORLD_SIZE / 2) / WORLD_SIZE * MASK_RES
    const softDisc = (x, z, radius, inner = 0.45) => {
      const px = toPx(x)
      const pz = toPx(z)
      const r = radius / WORLD_SIZE * MASK_RES
      const g = ctx.createRadialGradient(px, pz, r * inner, px, pz, r)
      g.addColorStop(0, 'rgba(0,0,0,1)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(px, pz, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const path = this.terrain.pathPositions || []
    for (let i = 0; i < path.length; i += 2) {
      softDisc(path[i], path[i + 1], 3.2, 0.35)
    }

    for (const key of Object.keys(PENSIONS)) {
      const p = PENSIONS[key].position
      softDisc(p.x, p.z, 19, 0.6)
    }

    // Clump noise lives in G so the shader reads both with a single fetch
    const image = ctx.getImageData(0, 0, MASK_RES, MASK_RES)
    const noise = createNoise2D()
    const freq = (WORLD_SIZE / MASK_RES) * 0.06
    for (let j = 0; j < MASK_RES; j++) {
      for (let i = 0; i < MASK_RES; i++) {
        image.data[(j * MASK_RES + i) * 4 + 1] = Math.round((noise(i * freq, j * freq) * 0.5 + 0.5) * 255)
      }
    }
    ctx.putImageData(image, 0, 0)

    const texture = new THREE.CanvasTexture(canvas)
    texture.flipY = false
    texture.colorSpace = THREE.NoColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.generateMipmaps = false
    return texture
  }

  update(playerPosition) {
    this.uniforms.uPlayerPos.value.copy(playerPosition)

    const tile = GRASS.tileSize
    const rings = GRASS.rings
    const cx = Math.floor(playerPosition.x / tile)
    const cz = Math.floor(playerPosition.z / tile)

    let index = 0
    for (let dz = -rings; dz <= rings; dz++) {
      for (let dx = -rings; dx <= rings; dx++) {
        const mesh = this._tiles[index++]
        const x0 = (cx + dx) * tile
        const z0 = (cz + dz) * tile

        // Distance from the rider to the closest point of the tile
        const nx = THREE.MathUtils.clamp(playerPosition.x, x0, x0 + tile) - playerPosition.x
        const nz = THREE.MathUtils.clamp(playerPosition.z, z0, z0 + tile) - playerPosition.z
        const nearest = Math.sqrt(nx * nx + nz * nz)

        if (nearest > this._radius) {
          mesh.visible = false
          continue
        }

        let lod = this._lods[0]
        for (const l of this._lods) if (nearest >= l.from) lod = l
        mesh.geometry = lod.geometry
        mesh.visible = true

        if (mesh.position.x !== x0 || mesh.position.z !== z0) {
          mesh.position.set(x0, this.terrain.getHeightAt(x0 + tile / 2, z0 + tile / 2), z0)
          mesh.updateMatrix()
          mesh.updateMatrixWorld()
        }
      }
    }
  }
}
