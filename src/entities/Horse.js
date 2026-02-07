import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import HorseController from './HorseController.js'

const ANIM = {
  idle: 'Horse|AA Horse_Idle_01_Horse',
  idle2: 'Horse|AS_Horse_Idle_02_Horse',
  idle3: 'Horse|AS_Horse_Idle_03_Horse',
  idle4: 'Horse|AS_Horse_Idle_04_Horse',
  walk: 'Horse|AS_Horse_G0_Walk_Horse',
  trot: 'Horse|AS_Horse_G1_Trot_Horse',
  canter: 'Horse|AS_Horse_G2_Canter_Horse',
  gallop: 'Horse|AS_Horse_G3_Gallop_Horse',
  sprint: 'Horse|AS_Horse_G4_Sprint_Horse',
  fidget1: 'Horse|AS_Horse_Idle_Fidget_01_Horse',
  fidget2: 'Horse|AS_Horse_Idle_Fidget_02_Horse',
  fidget3: 'Horse|AS_Horse_Idle_Fidget_03_Horse',
  fidget4: 'Horse|AS_Horse_Idle_Fidget_04_Horse',
  fidget5: 'Horse|AS_Horse_Idle_Fidget_05_Horse',
  fidget6: 'Horse|AS_Horse_Idle_Fidget_06_Horse',
  fidget7: 'Horse|AS_Horse_Idle_Fidget_07_Horse',
  fidget8: 'Horse|AS_Horse_Idle_Fidget_08_Horse',
  fidget9: 'Horse|AS_Horse_Idle_Fidget_09_Horse',
  pet: 'Horse|AS_Horse_Idle_Pet_01_Horse',
  rear: 'Horse|AS_Horse_Incline_Pose_01_Horse',
  jump: 'Horse|AS_Horse_Jump_G2_Canter_Horse',
}

const IDLE_POOL = [
  ANIM.idle, ANIM.idle, ANIM.idle2, ANIM.idle3, ANIM.idle4,
  ANIM.fidget1, ANIM.fidget2, ANIM.fidget3, ANIM.fidget4, ANIM.fidget5,
  ANIM.fidget6, ANIM.fidget7, ANIM.fidget8, ANIM.fidget9,
]

const TEXTURE_MAP = {
  'Body': '/models/horse_realistic/textures/Body_diffuse.png',
  'Hair': '/models/horse_realistic/textures/Hair_diffuse.png',
  'Material': '/models/horse_realistic/textures/Material_diffuse.png',
  'material': '/models/horse_realistic/textures/Material_diffuse.png',
}

const EQUIPMENT_MATERIALS = new Set(['Saddle_2', 'Material'])

const COAT_TINT = {
  'Body': new THREE.Color(0xB5652B),
  'Hair': new THREE.Color(0xD4A860),
}

const ROOT_BONE_NAMES = ['root_04', 'pelvis_05']

const TARGET_HEIGHT = 2.0

export default class Horse {
  constructor(scene, inputManager, terrain) {
    this.scene = scene
    this.inputManager = inputManager
    this.terrain = terrain
    this.mesh = new THREE.Group()
    this.mesh.position.set(0, 0, 0)
    scene.add(this.mesh)

    this.mixer = null
    this.controller = null
    this._actions = {}
    this._currentAction = null
    this._currentActionName = null
    this._ready = false

    this._idleTimer = 0
    this._idleInterval = 4 + Math.random() * 3
    this._emoting = false
  }

  async load() {
    const loader = new GLTFLoader()

    return new Promise((resolve, reject) => {
      loader.load('/models/horse_realistic/scene.gltf', (gltf) => {
        const model = gltf.scene

        const box = new THREE.Box3()
        model.traverse((child) => {
          if (child.isMesh) {
            child.geometry.computeBoundingBox()
            const meshBox = child.geometry.boundingBox.clone()
            meshBox.applyMatrix4(child.matrixWorld)
            box.union(meshBox)
          }
        })
        const height = box.max.y - box.min.y
        if (height > 0) {
          const s = TARGET_HEIGHT / height
          model.scale.setScalar(s)
        }

        model.rotation.y = Math.PI / 2

        const texLoader = new THREE.TextureLoader()
        const textureCache = {}

        model.traverse((child) => {
          if (child.isMesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            const isEquipment = mats.some((m) => EQUIPMENT_MATERIALS.has(m.name))

            if (isEquipment) {
              child.visible = false
              return
            }

            child.castShadow = true
            child.receiveShadow = true

            for (const mat of mats) {
              const texPath = TEXTURE_MAP[mat.name]
              if (texPath) {
                if (!textureCache[texPath]) {
                  const tex = texLoader.load(texPath)
                  tex.flipY = false
                  tex.colorSpace = THREE.SRGBColorSpace
                  textureCache[texPath] = tex
                }
                mat.map = textureCache[texPath]
              }
              const nameLower = mat.name.toLowerCase()
              const isEye = nameLower.includes('eye') || nameLower.includes('iris')
                || nameLower.includes('pupil') || nameLower.includes('cornea')
              if (isEye) {
                mat.roughness = 0.05
                mat.metalness = 0.1
                mat.emissive = new THREE.Color(0x221100)
                mat.emissiveIntensity = 0.3
              } else {
                mat.roughness = mat.name === 'material' ? 0.2 : 0.6
                mat.metalness = 0.0
              }
              if (COAT_TINT[mat.name]) {
                mat.color.copy(COAT_TINT[mat.name])
              }
              mat.needsUpdate = true
            }
          }
        })

        this.mesh.add(model)

        this._stripRootMotion(gltf, model)

        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(model)

          for (const clip of gltf.animations) {
            const action = this.mixer.clipAction(clip)
            this._actions[clip.name] = action
          }

          this._playAction(ANIM.idle)
        }

        this.controller = new HorseController(this, this.inputManager, this.terrain)
        this._ready = true
        resolve()
      }, undefined, (error) => {
        console.error('Failed to load horse model:', error)
        reject(error)
      })
    })
  }

  _stripRootMotion(gltf, model) {
    const rootBoneNodes = new Set()
    model.traverse((node) => {
      if (ROOT_BONE_NAMES.includes(node.name)) {
        rootBoneNodes.add(node.name)
      }
    })

    for (const clip of gltf.animations) {
      for (const track of clip.tracks) {
        const dotIdx = track.name.lastIndexOf('.')
        const propName = track.name.substring(dotIdx + 1)
        const targetName = track.name.substring(0, dotIdx)

        if (propName === 'position' && rootBoneNodes.has(targetName)) {
          const values = track.values
          const bindX = values[0]
          const bindZ = values[2]
          for (let i = 0; i < values.length; i += 3) {
            values[i] = bindX
            values[i + 2] = bindZ
          }
        }
      }
    }
  }

  _setTimeScale(value) {
    if (this._currentAction && Math.abs(this._currentAction.timeScale - value) > 0.01) {
      this._currentAction.timeScale = value
    }
  }

  _playAction(name, fadeDuration = 0.3) {
    if (name === this._currentActionName) return
    const newAction = this._actions[name]
    if (!newAction) return

    newAction.reset().fadeIn(fadeDuration).play()

    if (this._currentAction) {
      this._currentAction.fadeOut(fadeDuration)
    }

    this._currentAction = newAction
    this._currentActionName = name
  }

  playEmote(emoteName) {
    if (!this._ready || this._emoting) return
    const animName = ANIM[emoteName]
    const action = this._actions[animName]
    if (!action) return

    this._emoting = true

    if (this._currentAction) {
      this._currentAction.fadeOut(0.3)
    }

    action.reset()
    action.setLoop(THREE.LoopOnce)
    action.clampWhenFinished = true
    action.fadeIn(0.3).play()

    this._currentAction = action
    this._currentActionName = animName

    const onFinished = (e) => {
      if (e.action === action) {
        this.mixer.removeEventListener('finished', onFinished)
        this._emoting = false
        this._currentActionName = null
        this._playAction(ANIM.idle)
      }
    }
    this.mixer.addEventListener('finished', onFinished)
  }

  get isEmoting() {
    return this._emoting
  }

  update(dt) {
    if (!this._ready) return

    this.controller.update(dt)

    const speed = Math.abs(this.controller.speed)

    if (this._emoting) {
      if (this.mixer) this.mixer.update(dt)
      return
    }

    const isTurning = this.controller.input.isPressed('left')
      || this.controller.input.isPressed('right')
      || Math.abs(this.controller.input.analog?.x || 0) > 0.25

    if (speed > 20) {
      this._playAction(ANIM.sprint)
      this._setTimeScale(THREE.MathUtils.clamp(speed / 22, 0.8, 1.2))
      this._idleTimer = 0
    } else if (speed > 15) {
      this._playAction(ANIM.gallop)
      this._setTimeScale(THREE.MathUtils.clamp(speed / 17, 0.7, 1.2))
      this._idleTimer = 0
    } else if (speed > 10) {
      this._playAction(ANIM.trot)
      this._setTimeScale(THREE.MathUtils.clamp(speed / 12, 0.6, 1.1))
      this._idleTimer = 0
    } else if (speed > 0.3) {
      this._playAction(ANIM.walk)
      this._setTimeScale(THREE.MathUtils.clamp(speed / 8, 0.5, 1.0))
      this._idleTimer = 0
    } else if (isTurning) {
      this._playAction(ANIM.walk)
      this._setTimeScale(0.35)
      this._idleTimer = 0
    } else {
      this._idleTimer += dt
      if (this._idleTimer >= this._idleInterval) {
        this._idleTimer = 0
        this._idleInterval = 4 + Math.random() * 6
        const pick = IDLE_POOL[Math.floor(Math.random() * IDLE_POOL.length)]
        this._playAction(pick, 0.5)
      } else if (!this._currentActionName ||
                 (!this._currentActionName.includes('Idle') && !this._currentActionName.includes('Fidget'))) {
        this._playAction(ANIM.idle)
      }
    }

    if (this.mixer) {
      this.mixer.update(dt)
    }
  }
}
