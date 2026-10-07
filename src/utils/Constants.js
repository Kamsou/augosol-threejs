import * as THREE from 'three'

export const BASE = import.meta.env.BASE_URL

export const WORLD_SIZE = 500
export const TERRAIN_SEGMENTS = 128
export const TERRAIN_HEIGHT_SCALE = 15
export const TERRAIN_DETAIL_SCALE = 3

export const FOG_COLOR = 0xe5d0b5
export const FOG_DENSITY = 0.0018

export const COLORS = {
  sky: {
    top: new THREE.Color(0x5a7a9e),
    bottom: new THREE.Color(0xf5dcc0),
  },
  terrain: {
    low: new THREE.Color(0x7a9c5a),
    mid: new THREE.Color(0xa0b078),
    high: new THREE.Color(0xc4a87a),
  },
  ambient: 0xd4a87a,
  sun: 0xffe5c4,
  ground: 0x68350B,
}

// Poly Haven textures (CC0), self-hosted as WebP. Only the albedo maps are sampled by the terrain shader.
export const TERRAIN_TEXTURES = {
  grass: { albedo: BASE + 'textures/terrain/grass_albedo.webp' },
  rock: { albedo: BASE + 'textures/terrain/rock_albedo.webp' },
  dirt: { albedo: BASE + 'textures/terrain/dirt_albedo.webp' },
}

export const PENSIONS = {
  nature: {
    name: 'Le Pré Sauvage',
    description: 'Un vaste espace où les chevaux vivent en troupeau dans des prairies naturelles. Ils broutent, courent et se reposent à leur rythme, dans le respect de leurs instincts.',
    position: new THREE.Vector3(80, 0, -80),
    color: 0x4a7c3a,
    features: ['Vie en troupeau', 'Prairies naturelles', 'Abri ouvert', 'Suivi vétérinaire'],
    ethical: true,
  },
  ethical_sport: {
    name: 'L\'Écurie Bienveillante',
    description: 'Un centre équestre qui place le bien-être au cœur de chaque séance. Entraînement progressif, récupération respectée et cavaliers formés en éthologie.',
    position: new THREE.Vector3(-90, 0, -60),
    color: 0xc77b2e,
    features: ['Entraînement adapté', 'Repos respecté', 'Paddock quotidien', 'Écoute du cheval'],
    ethical: true,
  },
  wellness: {
    name: 'Le Refuge Équilibre',
    description: 'Un lieu dédié au bien-être global du cheval. Ostéopathie, maréchalerie naturelle, alimentation sur-mesure et environnement apaisant.',
    position: new THREE.Vector3(85, 0, 70),
    color: 0x6b8e6b,
    features: ['Ostéopathie', 'Alimentation sur-mesure', 'Parage naturel', 'Cadre apaisant'],
    ethical: true,
  },
  intensive: {
    name: 'Le Centre Performance Élite',
    description: 'Un centre obsédé par les résultats. Les chevaux restent en box 23h/24, s\'entraînent au-delà de leurs limites. Le stress et les blessures sont fréquents.',
    position: new THREE.Vector3(0, 0, 100),
    color: 0x8c2f2f,
    features: ['Box sans sortie', 'Entraînement intensif', 'Chevaux isolés', 'Zéro repos'],
    ethical: false,
  },
  neglect: {
    name: 'La Pension du Bout du Chemin',
    description: 'Une pension à bas prix où les chevaux survivent plus qu\'ils ne vivent. Paddocks boueux, nourriture insuffisante, aucun suivi vétérinaire.',
    position: new THREE.Vector3(-95, 0, 40),
    color: 0x7a7a6a,
    features: ['Paddocks surchargés', 'Sous-alimentation', 'Pas de vétérinaire', 'Infrastructures dégradées'],
    ethical: false,
  },
  showpiece: {
    name: 'Le Domaine de l\'Image',
    description: 'Un domaine magnifique en apparence, mais où les chevaux sont des objets de décoration. Tondus, immobilisés pour les photos, sortis uniquement pour les visiteurs.',
    position: new THREE.Vector3(-60, 0, -90),
    color: 0xb8860b,
    features: ['Tonte esthétique', 'Sorties pour les clients', 'Aucune vie sociale', 'Marketing avant tout'],
    ethical: false,
  },
}

export const HORSE = {
  walkSpeed: 8,
  trotSpeed: 14,
  gallopSpeed: 32,
  acceleration: 12,
  deceleration: 14,
  turnSpeed: 2.2,
  backwardFactor: 0.6,
}

export const CAMERA = {
  fov: 55,
  near: 0.1,
  far: 800,
  offset: new THREE.Vector3(0, 8, 14),
  lookAtOffset: new THREE.Vector3(0, 2, -4),
  lerpSpeed: 5.0,
  approachOffset: new THREE.Vector3(0, 5, 9),
}

export const INTERACTION_RADIUS = 20
export const APPROACH_RADIUS = 35

export const ASSET_MANIFEST = {
  tree_pine:   { path: BASE + 'models/nature/tree_pine.glb',   scale: 2.0, yOffset: 0 },
  tree_oak:    { path: BASE + 'models/nature/tree_oak.glb',    scale: 1.5, yOffset: 0 },
  tree_birch:  { path: BASE + 'models/nature/tree_birch.glb',  scale: 1.5, yOffset: 0 },
  dead_tree:   { path: BASE + 'models/nature/dead_tree.glb',   scale: 1.5, yOffset: 0 },

  bush_1:      { path: BASE + 'models/nature/bush_1.glb',      scale: 0.8, yOffset: 0 },
  bush_2:      { path: BASE + 'models/nature/bush_2.glb',      scale: 0.8, yOffset: 0 },
  grass_clump: { path: BASE + 'models/nature/grass_clump.glb', scale: 0.4, yOffset: 0 },
  flower_1:    { path: BASE + 'models/nature/flower_1.glb',    scale: 0.5, yOffset: 0 },
  flower_2:    { path: BASE + 'models/nature/flower_2.glb',    scale: 0.5, yOffset: 0 },

  rock_1:      { path: BASE + 'models/nature/rock_1.glb',      scale: 1.0, yOffset: 0 },
  rock_2:      { path: BASE + 'models/nature/rock_2.glb',      scale: 1.0, yOffset: 0 },
  rock_3:      { path: BASE + 'models/nature/rock_3.glb',      scale: 1.0, yOffset: 0 },

  fence_wood:  { path: BASE + 'models/buildings/fence_wood.glb', scale: 1.0, yOffset: 0 },
}

// Low golden-hour sun: long shadows, back-lit grass, visible disc in the sky
export const SUN_DIRECTION = new THREE.Vector3(-0.5, 0.36, -0.79).normalize()

// Grass is drawn as a ring of tiles around the rider; density fades with distance
export const GRASS = isMobileDevice()
  ? {
    tileSize: 12,
    rings: 3,
    density: 10,
    densityRange: [8, 30],
    minDensity: 0.25,
    // [nearest tile distance, blade segments]: each step only sends the blades it can show
    lods: [[0, 3], [8, 3], [14, 2], [20, 2], [26, 2]],
    bladeWidth: 0.15,
    bladeHeight: 1.0,
    pushRadius: 3.2,
  }
  : {
    tileSize: 10,
    rings: 5,
    density: 22,
    densityRange: [10, 40],
    minDensity: 0.15,
    // [nearest tile distance, blade segments]: each step only sends the blades it can show
    lods: [[0, 4], [8, 4], [14, 3], [20, 3], [26, 2], [32, 2], [38, 2]],
    bladeWidth: 0.15,
    bladeHeight: 1.0,
    pushRadius: 3.2,
  }

export const COLLECTIBLES = {
  count: 20,
  pickupRadius: 3.4,
  minSpacing: 26,
  hoverHeight: 2.4,
}

export const JUMP = {
  // Take-off speed grows with the gait: a hop at the walk, a real leap at the gallop
  minVelocity: 9.5,
  maxVelocity: 11.5,
  // Snappy arc: about half a second in the air, apex 1.2–1.8 above the ground
  gravity: 36,
  // Pressing jump this long before touching down still triggers a jump on landing
  bufferTime: 0.22,
  // Near an obstacle, an early press is held back this long at most to peak over the pole
  maxAssistDelay: 0.35,
}

function isMobileDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
}

// Coats for the other horses: [body tint, mane tint]
export const COATS = {
  bay: [0x7a3e1c, 0x2a1d15],
  chestnut: [0xa8562a, 0xc98a4a],
  grey: [0xc4bcb0, 0xe2dcd2],
  black: [0x3a2c24, 0x1e1712],
  palomino: [0xd9a85c, 0xf2e4c4],
  dull: [0x6e5a48, 0x4a3e34],
  white: [0xc9c3b9, 0xddd8d0],
}

// Who lives where. Positions are local to the pension; `wander` horses roam a zone,
// `still` ones barely move, the `statue` never does. Zones avoid each pension's props.
export const HERDS = {
  nature: {
    zone: { radius: 9.5, avoid: [{ x: 3, z: -2, r: 6 }, { x: -2.5, z: -4.5, r: 3.5 }] },
    horses: [
      { mode: 'wander', coat: 'bay', at: [-5, 4] },
      { mode: 'wander', coat: 'grey', at: [4, 6] },
      { mode: 'wander', coat: 'palomino', at: [-6, -1] },
    ],
  },
  ethical_sport: {
    zone: { rect: [9.6, -2.6, 13.4, 2.6] },
    horses: [
      { mode: 'wander', coat: 'chestnut', at: [10, -1.5] },
      { mode: 'wander', coat: 'black', at: [13, 1.5] },
    ],
  },
  wellness: {
    zone: { radius: 11, avoid: [{ x: 7, z: -3.5, r: 3.5 }, { x: 0, z: 0, r: 2 }] },
    horses: [
      { mode: 'wander', coat: 'grey', at: [-4, 6] },
      { mode: 'wander', coat: 'bay', at: [3, 7] },
    ],
  },
  intensive: {
    horses: [
      // Heads over the box doors, bodies stuck inside
      { mode: 'still', coat: 'bay', at: [-2.7, 4.1], facing: 0, earsBack: true },
      { mode: 'still', coat: 'black', at: [2.9, 4.1], facing: 0, earsBack: true },
    ],
  },
  neglect: {
    horses: [
      { mode: 'still', coat: 'dull', at: [-5, 6.6], facing: 0, earsBack: true },
      { mode: 'still', coat: 'dull', at: [6, -1], facing: Math.PI * 0.7, earsBack: true },
    ],
  },
  showpiece: {
    horses: [
      // On display under the arch, perfectly still
      { mode: 'statue', coat: 'white', at: [0, -3.5], facing: Math.PI },
    ],
  },
}

// Timed jumping course on the open ground east of the spawn
export const COURSE = {
  center: new THREE.Vector3(66, 0, -6),
  radii: [26, 17],
  jumps: 6,
  poleHeight: 0.95,
  width: 5.2,
  penalty: 3,
  abortDistance: 75,
  // Terrain is flattened and kept clear of trees and horseshoes around it
  flatRadius: 33,
  flatBlend: 20,
  clearRadius: 38,
}

// Point on the course ellipse; theta = PI is the start/finish gate
export function coursePoint(theta, out = new THREE.Vector3()) {
  return out.set(
    COURSE.center.x + Math.cos(theta) * COURSE.radii[0],
    0,
    COURSE.center.z + Math.sin(theta) * COURSE.radii[1]
  )
}
