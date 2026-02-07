import * as THREE from 'three'

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
  tree_pine:   { path: '/models/nature/tree_pine.glb',   scale: 2.0, yOffset: 0 },
  tree_oak:    { path: '/models/nature/tree_oak.glb',    scale: 1.5, yOffset: 0 },
  tree_birch:  { path: '/models/nature/tree_birch.glb',  scale: 1.5, yOffset: 0 },
  dead_tree:   { path: '/models/nature/dead_tree.glb',   scale: 1.5, yOffset: 0 },

  bush_1:      { path: '/models/nature/bush_1.glb',      scale: 0.8, yOffset: 0 },
  bush_2:      { path: '/models/nature/bush_2.glb',      scale: 0.8, yOffset: 0 },
  grass_clump: { path: '/models/nature/grass_clump.glb', scale: 0.4, yOffset: 0 },
  flower_1:    { path: '/models/nature/flower_1.glb',    scale: 0.5, yOffset: 0 },
  flower_2:    { path: '/models/nature/flower_2.glb',    scale: 0.5, yOffset: 0 },

  rock_1:      { path: '/models/nature/rock_1.glb',      scale: 1.0, yOffset: 0 },
  rock_2:      { path: '/models/nature/rock_2.glb',      scale: 1.0, yOffset: 0 },
  rock_3:      { path: '/models/nature/rock_3.glb',      scale: 1.0, yOffset: 0 },

  fence_wood:  { path: '/models/buildings/fence_wood.glb', scale: 1.0, yOffset: 0 },
}
