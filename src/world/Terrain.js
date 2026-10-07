import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'
import { WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_HEIGHT_SCALE, TERRAIN_DETAIL_SCALE, PENSIONS, COURSE } from '../utils/Constants.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const PATH_MAP_RES = 1024
const PATH_RADIUS = 1.2
const PATH_BLEND = 0.6

export default class Terrain {
  constructor(scene, terrainTextures) {
    this.noise2D = createNoise2D()
    this._segmentSize = WORLD_SIZE / TERRAIN_SEGMENTS

    this._pensionData = []
    for (const key of Object.keys(PENSIONS)) {
      const pos = PENSIONS[key].position
      this._pensionData.push({
        x: pos.x,
        z: pos.z,
        centerY: this._naturalHeight(pos.x, pos.z),
        flat: 14,
        transition: 30,
      })
    }
    // The jumping course needs a wide, level arena
    this._pensionData.push({
      x: COURSE.center.x,
      z: COURSE.center.z,
      centerY: this._naturalHeight(COURSE.center.x, COURSE.center.z),
      flat: COURSE.flatRadius,
      transition: COURSE.flatRadius + COURSE.flatBlend,
    })

    this.geometry = new THREE.PlaneGeometry(
      WORLD_SIZE, WORLD_SIZE,
      TERRAIN_SEGMENTS, TERRAIN_SEGMENTS
    )
    this.geometry.rotateX(-Math.PI / 2)

    this._displace()
    this.geometry.computeVertexNormals()

    // Prepare pension data for uniforms
    const pensionPositions = []
    const pensionColors = []
    for (const key of Object.keys(PENSIONS)) {
      const p = PENSIONS[key]
      pensionPositions.push(p.position.x, p.position.z)
      pensionColors.push(new THREE.Color(p.color))
    }

    // Create MeshStandardMaterial and modify with onBeforeCompile for proper PBR lighting
    this.material = new THREE.MeshStandardMaterial({
      roughness: 1.0,
      metalness: 0.0,
    })

    // Store textures and parameters for onBeforeCompile
    this.terrainTextures = terrainTextures
    this.pensionPositions = pensionPositions
    this.pensionColors = pensionColors
    this.pathPositions = []
    this.pathCount = 0
    this.pathMap = this._createPathMap()

    this.material.onBeforeCompile = (shader) => {
      // Add custom uniforms
      shader.uniforms.uGrassAlbedo = { value: terrainTextures?.grass?.albedo || null }
      shader.uniforms.uRockAlbedo = { value: terrainTextures?.rock?.albedo || null }
      shader.uniforms.uDirtAlbedo = { value: terrainTextures?.dirt?.albedo || null }
      // A missing texture would sample black: fall back to a flat colour instead
      shader.defines = shader.defines || {}
      if (!terrainTextures?.grass?.albedo) shader.defines.NO_GRASS_MAP = ''
      if (!terrainTextures?.rock?.albedo) shader.defines.NO_ROCK_MAP = ''
      if (!terrainTextures?.dirt?.albedo) shader.defines.NO_DIRT_MAP = ''

      shader.uniforms.uHeightScale = { value: TERRAIN_HEIGHT_SCALE }
      shader.uniforms.uTextureScale = { value: isMobile ? 0.06 : 0.04 }
      shader.uniforms.uGrassRockTransition = { value: 0.55 }
      shader.uniforms.uGrassRockBlend = { value: 0.15 }
      shader.uniforms.uSlopeThreshold = { value: 0.7 }
      shader.uniforms.uSlopeBlend = { value: 0.15 }

      shader.uniforms.uPathMap = { value: this.pathMap }
      shader.uniforms.uWorldSize = { value: WORLD_SIZE }

      shader.uniforms.uPensionPos = { value: pensionPositions }
      shader.uniforms.uPensionCol = { value: pensionColors }
      shader.uniforms.uPensionCount = { value: Object.keys(PENSIONS).length }
      shader.uniforms.uPensionInfluence = { value: 0.0 }

      // Modify vertex shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying float vHeight;`
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vHeight = position.y;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);`
      )

      // Modify fragment shader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        this._getFragmentShaderUniforms()
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        this._getFragmentShaderMain()
      )
    }

    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.receiveShadow = true
    scene.add(this.mesh)

    this._buildHeightMap()
  }

  _getFragmentShaderUniforms() {
    return `#include <common>
      uniform sampler2D uGrassAlbedo;
      uniform sampler2D uRockAlbedo;
      uniform sampler2D uDirtAlbedo;

      uniform float uHeightScale;
      uniform float uTextureScale;
      uniform float uGrassRockTransition;
      uniform float uGrassRockBlend;
      uniform float uSlopeThreshold;
      uniform float uSlopeBlend;

      uniform sampler2D uPathMap;
      uniform float uWorldSize;

      uniform float uPensionPos[12];
      uniform vec3 uPensionCol[6];
      uniform int uPensionCount;
      uniform float uPensionInfluence;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
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
        ${isMobile ? '' : 'v += terrainNoise(p * 0.3) * 0.125;'}
        return v;
      }

      vec3 triplanarSample(sampler2D tex, vec3 worldPos, vec3 worldNormal, float scale) {
        vec3 sampleX = texture2D(tex, worldPos.zy * scale).rgb;
        vec3 sampleY = texture2D(tex, worldPos.xz * scale).rgb;
        vec3 sampleZ = texture2D(tex, worldPos.xy * scale).rgb;

        vec3 blendWeights = abs(worldNormal);
        blendWeights = pow(blendWeights, vec3(${isMobile ? '2.0' : '4.0'}));
        blendWeights /= (blendWeights.x + blendWeights.y + blendWeights.z);

        return sampleX * blendWeights.x +
               sampleY * blendWeights.y +
               sampleZ * blendWeights.z;
      }`
  }

  _getFragmentShaderMain() {
    return `
      // Sample all textures with triplanar projection
      #ifdef NO_GRASS_MAP
        vec3 grassAlbedo = vec3(0.07, 0.11, 0.03);
      #else
        vec3 grassAlbedo = triplanarSample(uGrassAlbedo, vWorldPos, vWorldNormal, uTextureScale);
      #endif
      #ifdef NO_ROCK_MAP
        vec3 rockAlbedo = vec3(0.2, 0.17, 0.13);
      #else
        vec3 rockAlbedo = triplanarSample(uRockAlbedo, vWorldPos, vWorldNormal, uTextureScale);
      #endif
      #ifdef NO_DIRT_MAP
        vec3 dirtAlbedo = vec3(0.2, 0.12, 0.06);
      #else
        vec3 dirtAlbedo = triplanarSample(uDirtAlbedo, vWorldPos, vWorldNormal, uTextureScale);
      #endif

      // Apply color tinting for golden-hour aesthetic
      grassAlbedo *= vec3(1.0, 0.95, 0.85);
      rockAlbedo *= vec3(0.77, 0.66, 0.48);
      dirtAlbedo *= vec3(0.6, 0.49, 0.36);

      // Height factor with noise variation
      float heightFactor = clamp((vHeight + uHeightScale) / (uHeightScale * 2.0), 0.0, 1.0);
      float noise = terrainFBM(vWorldPos.xz) * 0.15;
      heightFactor = clamp(heightFactor + noise, 0.0, 1.0);

      // Rock blending based on height and slope
      float rockByHeight = smoothstep(uGrassRockTransition - uGrassRockBlend, uGrassRockTransition + uGrassRockBlend, heightFactor);
      float rockBySlope = 1.0 - smoothstep(uSlopeThreshold - uSlopeBlend, uSlopeThreshold + uSlopeBlend, vWorldNormal.y);
      float rockWeight = max(rockByHeight, rockBySlope);

      // Path proximity, baked once into a texture (see setPathPoints)
      float pathWeight = texture2D(uPathMap, (vWorldPos.xz + uWorldSize * 0.5) / uWorldSize).r;

      // Blend textures: grass → rock → dirt (path)
      vec3 finalAlbedo = mix(grassAlbedo, rockAlbedo, rockWeight);
      finalAlbedo = mix(finalAlbedo, dirtAlbedo, pathWeight);

      // Pension color influence (subtle)
      if (uPensionInfluence > 0.0) {
        for (int i = 0; i < 6; i++) {
          if (i >= uPensionCount) break;
          float px = uPensionPos[i * 2];
          float pz = uPensionPos[i * 2 + 1];
          float dist = length(vWorldPos.xz - vec2(px, pz));
          if (dist < 30.0) {
            float influence = (1.0 - dist / 30.0) * uPensionInfluence;
            finalAlbedo = mix(finalAlbedo, uPensionCol[i].rgb, influence);
          }
        }
      }

      diffuseColor = vec4(finalAlbedo, 1.0);
    `
  }

  _createPathMap() {
    const texture = new THREE.DataTexture(new Uint8Array(PATH_MAP_RES * PATH_MAP_RES), PATH_MAP_RES, PATH_MAP_RES, THREE.RedFormat)
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = true
    texture.needsUpdate = true
    return texture
  }

  // Rasterise the path falloff once instead of looping over every path point per pixel
  setPathPoints(points) {
    this.pathPositions = points
    this.pathCount = points.length / 2

    const data = this.pathMap.image.data
    data.fill(0)
    const texel = WORLD_SIZE / PATH_MAP_RES
    const half = WORLD_SIZE / 2
    const outer = PATH_RADIUS + PATH_BLEND
    const reach = Math.ceil(outer / texel)

    for (let p = 0; p < points.length; p += 2) {
      const px = points[p]
      const pz = points[p + 1]
      const ci = Math.floor((px + half) / texel)
      const cj = Math.floor((pz + half) / texel)
      for (let j = Math.max(0, cj - reach); j <= Math.min(PATH_MAP_RES - 1, cj + reach); j++) {
        const wz = (j + 0.5) * texel - half
        for (let i = Math.max(0, ci - reach); i <= Math.min(PATH_MAP_RES - 1, ci + reach); i++) {
          const wx = (i + 0.5) * texel - half
          const dist = Math.hypot(wx - px, wz - pz)
          // Same falloff as smoothstep(radius + blend, radius, dist)
          const t = Math.min(Math.max((dist - outer) / -PATH_BLEND, 0), 1)
          const value = Math.round(t * t * (3 - 2 * t) * 255)
          const idx = j * PATH_MAP_RES + i
          if (value > data[idx]) data[idx] = value
        }
      }
    }
    this.pathMap.needsUpdate = true
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
      const flatRadius = p.flat
      const transitionRadius = p.transition
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
