import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'
import { WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_HEIGHT_SCALE, TERRAIN_DETAIL_SCALE, PENSIONS } from '../utils/Constants.js'

export default class Terrain {
  constructor(scene) {
    this.noise2D = createNoise2D()
    this._segmentSize = WORLD_SIZE / TERRAIN_SEGMENTS

    this._pensionData = []
    for (const key of Object.keys(PENSIONS)) {
      const pos = PENSIONS[key].position
      this._pensionData.push({
        x: pos.x,
        z: pos.z,
        centerY: this._naturalHeight(pos.x, pos.z),
      })
    }

    this.geometry = new THREE.PlaneGeometry(
      WORLD_SIZE, WORLD_SIZE,
      TERRAIN_SEGMENTS, TERRAIN_SEGMENTS
    )
    this.geometry.rotateX(-Math.PI / 2)

    this._displace()
    this.geometry.computeVertexNormals()

    // Procedural terrain material — injects custom coloring into MeshStandardMaterial
    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      metalness: 0.0,
    })

    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uHeightScale = { value: TERRAIN_HEIGHT_SCALE }
      shader.uniforms.uTerrainLow = { value: new THREE.Color(0x5a8a3a) }
      shader.uniforms.uTerrainMid = { value: new THREE.Color(0x7aaa5a) }
      shader.uniforms.uTerrainHigh = { value: new THREE.Color(0xa0b078) }
      shader.uniforms.uTerrainRock = { value: new THREE.Color(0xc4a87a) }

      // Pension tinting data
      const pensionPositions = []
      const pensionColors = []
      for (const key of Object.keys(PENSIONS)) {
        const p = PENSIONS[key]
        pensionPositions.push(p.position.x, p.position.z)
        pensionColors.push(new THREE.Color(p.color))
      }
      shader.uniforms.uPensionPos = { value: pensionPositions }
      shader.uniforms.uPensionCol = { value: pensionColors }
      shader.uniforms.uPensionCount = { value: Object.keys(PENSIONS).length }

      // Vertex shader — pass height and world position
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        varying float vHeight;`
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vHeight = position.y;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
      )

      // Fragment shader — procedural coloring
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        uniform float uHeightScale;
        uniform vec3 uTerrainLow;
        uniform vec3 uTerrainMid;
        uniform vec3 uTerrainHigh;
        uniform vec3 uTerrainRock;
        uniform float uPensionPos[12];
        uniform vec3 uPensionCol[6];
        uniform int uPensionCount;
        varying vec3 vWorldPos;
        varying float vHeight;

        float terrainHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float terrainNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = terrainHash(i);
          float b = terrainHash(i + vec2(1.0, 0.0));
          float c = terrainHash(i + vec2(0.0, 1.0));
          float d = terrainHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float terrainFBM(vec2 p) {
          float v = 0.0;
          v += terrainNoise(p * 0.05) * 0.5;
          v += terrainNoise(p * 0.12) * 0.25;
          v += terrainNoise(p * 0.3) * 0.125;
          return v;
        }`
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `// Procedural terrain coloring
        float h = clamp((vHeight + uHeightScale) / (uHeightScale * 2.0), 0.0, 1.0);

        // Organic noise variation
        float n = terrainFBM(vWorldPos.xz) * 0.2 - 0.1;
        h = clamp(h + n, 0.0, 1.0);

        // 4-band height-based blending
        vec3 terrainColor;
        if (h < 0.3) {
          terrainColor = mix(uTerrainLow, uTerrainMid, h / 0.3);
        } else if (h < 0.55) {
          terrainColor = mix(uTerrainMid, uTerrainHigh, (h - 0.3) / 0.25);
        } else {
          terrainColor = mix(uTerrainHigh, uTerrainRock, clamp((h - 0.55) / 0.45, 0.0, 1.0));
        }

        // Micro detail noise
        float micro = terrainNoise(vWorldPos.xz * 0.5) * 0.08 - 0.04;
        terrainColor += micro;

        // Pension area tinting
        for (int i = 0; i < 6; i++) {
          if (i >= uPensionCount) break;
          float px = uPensionPos[i * 2];
          float pz = uPensionPos[i * 2 + 1];
          float dist = length(vWorldPos.xz - vec2(px, pz));
          if (dist < 30.0) {
            float influence = 1.0 - dist / 30.0;
            terrainColor = mix(terrainColor, uPensionCol[i], influence * 0.25);
          }
        }

        diffuseColor = vec4(terrainColor, 1.0);`
      )
    }

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.receiveShadow = true
    scene.add(this.mesh)

    this._buildHeightMap()
  }

  _displace() {
    const positions = this.geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const z = positions.getZ(i)
      const y = this._computeHeight(x, z)
      positions.setY(i, y)
    }
    positions.needsUpdate = true
  }

  _naturalHeight(x, z) {
    let y = this.noise2D(x * 0.005, z * 0.005) * TERRAIN_HEIGHT_SCALE
    y += this.noise2D(x * 0.015, z * 0.015) * TERRAIN_DETAIL_SCALE
    y += this.noise2D(x * 0.04, z * 0.04) * 1.0
    return y
  }

  _computeHeight(x, z) {
    let y = this._naturalHeight(x, z)

    const distFromCenter = Math.sqrt(x * x + z * z)
    if (distFromCenter < 25) {
      const t = Math.max(0, 1.0 - distFromCenter / 25)
      y *= (1 - t)
    }

    for (const p of this._pensionData) {
      const dx = x - p.x
      const dz = z - p.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      const flatRadius = 14
      const transitionRadius = 30
      if (dist < transitionRadius) {
        const t = dist < flatRadius
          ? 1
          : 1 - (dist - flatRadius) / (transitionRadius - flatRadius)
        const smooth = t * t * (3 - 2 * t)
        y = y * (1 - smooth) + p.centerY * smooth
      }
    }

    return y
  }

  _buildHeightMap() {
    this._positions = this.geometry.attributes.position
    this._gridSize = TERRAIN_SEGMENTS + 1
    this._halfSize = WORLD_SIZE / 2
  }

  getHeightAt(x, z) {
    const gx = ((x + this._halfSize) / WORLD_SIZE) * TERRAIN_SEGMENTS
    const gz = ((z + this._halfSize) / WORLD_SIZE) * TERRAIN_SEGMENTS

    const ix = THREE.MathUtils.clamp(Math.floor(gx), 0, TERRAIN_SEGMENTS - 1)
    const iz = THREE.MathUtils.clamp(Math.floor(gz), 0, TERRAIN_SEGMENTS - 1)

    const fx = gx - ix
    const fz = gz - iz

    const i00 = iz * this._gridSize + ix
    const i10 = iz * this._gridSize + (ix + 1)
    const i01 = (iz + 1) * this._gridSize + ix
    const i11 = (iz + 1) * this._gridSize + (ix + 1)

    const y00 = this._positions.getY(i00)
    const y10 = this._positions.getY(i10)
    const y01 = this._positions.getY(i01)
    const y11 = this._positions.getY(i11)

    const y0 = y00 + (y10 - y00) * fx
    const y1 = y01 + (y11 - y01) * fx
    return y0 + (y1 - y0) * fz
  }
}
