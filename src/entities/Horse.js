import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import HorseController from './HorseController.js'
import { BASE, HORSE, JUMP } from '../utils/Constants.js'

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
  pet2: 'Horse|AS_Horse_Idle_Pet_02_Horse',
  pet3: 'Horse|AS_Horse_Idle_Pet_03_Horse',
  pet4: 'Horse|AS_Horse_Idle_Pet_04_Horse',
  brake: 'Horse|AS_Horse_G3_Gallop_Panic_Brake_Horse',
  rear: 'Horse|AS_Horse_Incline_Pose_01_Horse',
  jump: 'Horse|AS_Horse_Jump_G2_Canter_Horse',
  jumpGallop: 'Horse|AS_Horse_Jump_G3_Gallop_Horse',
  jumpSprint: 'Horse|AS_Horse_Jump_G4_Sprint_Horse',
}

const IDLE_POOL = [
  ANIM.idle, ANIM.idle, ANIM.idle2, ANIM.idle3, ANIM.idle4,
  ANIM.fidget1, ANIM.fidget2, ANIM.fidget3, ANIM.fidget4, ANIM.fidget5,
  ANIM.fidget6, ANIM.fidget7, ANIM.fidget8, ANIM.fidget9,
]

const TEXTURE_MAP = {
  'Body': BASE + 'models/horse_realistic/textures/Body_diffuse.png',
  'Hair': BASE + 'models/horse_realistic/textures/Hair_diffuse.png',
  'Material': BASE + 'models/horse_realistic/textures/Material_diffuse.png',
  'material': BASE + 'models/horse_realistic/textures/Material_diffuse.png',
}

const EQUIPMENT_MATERIALS = new Set(['Saddle_2', 'Material'])

const COAT_TINT = {
  'Body': new THREE.Color(0xB5652B),
  'Hair': new THREE.Color(0xD4A860),
}

const ROOT_BONE_NAMES = ['root_04', 'pelvis_05']
const HEAD_BONE = 'head_016'
const EAR_BONES = ['ear_01_l_032', 'ear_01_r_034']
const PET_POOL = [ANIM.pet, ANIM.pet2, ANIM.pet3, ANIM.pet4]
// Take-off and landing moments inside each jump clip, read from the pelvis pitch curve:
// the airborne part of the clip is stretched to match the physics flight exactly
const JUMP_CLIPS = [
  { name: ANIM.jumpGallop, takeoff: 0.18, landing: 1.08 },
]
const PUSH_OFF = 0.07
const CONTENT_POOL = [ANIM.fidget3, ANIM.fidget7, ANIM.fidget8]

const TARGET_HEIGHT = 5.0
const EAR_AXIS = new THREE.Vector3(0, 0, -1)
const EAR_PIN_ANGLE = 1.75
const _earOffset = new THREE.Quaternion()

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
    this._oneShot = null
    this._jumpDelay = 0
    this._jumpBuffer = 0
    this.onTakeoff = null
    this._coatMaterials = {}
    this._coatTarget = null

    this._head = null
    this._ears = []
    this._earPin = 0
    this.earPinTarget = 0
  }

  async load() {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)

    return new Promise((resolve, reject) => {
      loader.load(BASE + 'models/horse_realistic/horse_compressed.glb', (gltf) => {
        const model = gltf.scene

        model.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(model)
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
              if (mat.name === 'Body' || mat.name === 'Hair') this._coatMaterials[mat.name] = mat
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
        // Kept so other horses (the herds) can be cloned from the same asset
        this.model = model
        this.clips = gltf.animations

        this._head = model.getObjectByName(HEAD_BONE) || null
        this._ears = EAR_BONES.map(name => model.getObjectByName(name)).filter(Boolean)
          .map(bone => ({ bone, base: bone.quaternion.clone() }))

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

  // Play a clip once over the gait loops. `interruptible` lets the rider cancel it by moving.
  _playOneShot(name, { fade = 0.3, startAt = 0, duration = null, timeScale = 1, interruptible = false } = {}) {
    const action = this._actions[name]
    if (!action) return false

    if (this._oneShot) this._oneShot.action.fadeOut(fade)
    else this._currentAction?.fadeOut(fade)

    const clipDuration = action.getClip().duration
    action.reset()
    action.setLoop(THREE.LoopOnce)
    action.clampWhenFinished = true
    action.timeScale = timeScale
    action.time = startAt
    action.fadeIn(fade).play()

    this._emoting = true
    this._currentAction = action
    this._currentActionName = name
    this._oneShot = {
      action,
      elapsed: 0,
      // Seconds of real time before handing back to the gait logic
      duration: duration ?? (clipDuration - startAt) / timeScale,
      interruptible,
    }
    return true
  }

  _endOneShot(fade = 0.35) {
    if (!this._oneShot) return
    this._oneShot.action.fadeOut(fade)
    this._oneShot = null
    this._emoting = false
    // Let the gait logic pick the right loop on the next frame
    this._currentAction = null
    this._currentActionName = null
  }

  // Ask for a jump: now, after `delay` seconds (obstacle assist), or on landing if still in the air
  requestJump(delay = 0) {
    if (!this._ready || this.controller.frozen) return
    if (this.controller.airborne) {
      this._jumpBuffer = JUMP.bufferTime
      return
    }
    if (delay > 0) this._jumpDelay = delay
    else this.jump()
  }

  // Leap forward; a standing horse takes a short run-up so the jump always works
  jump() {
    this._jumpDelay = 0
    this._jumpBuffer = 0
    if (!this._ready || this.controller.frozen || this.controller.airborne) return false
    // Once landed, a new leap may cut the end of the previous one (jumps in a row)
    if (this._oneShot && !this._oneShot.interruptible && this._oneShot.kind !== 'jump') return false

    // A slow horse needs a little momentum to leave the ground, not a full trot
    const minTakeoff = HORSE.trotSpeed * 0.75
    if (this.controller.speed < minTakeoff) this.controller.speed = minTakeoff
    const speed = this.controller.speed
    // One clip for every gait: the sprint variant stretches the body too much for a capped flight
    const def = JUMP_CLIPS[0]

    this.controller.jump()
    const action = this._actions[def.name]
    if (action) {
      const timeScale = (def.landing - def.takeoff) / this.controller.airTime
      const startAt = Math.max(0, def.takeoff - PUSH_OFF * timeScale)
      this._playOneShot(def.name, { fade: 0.12, startAt, timeScale })
      this._oneShot.kind = 'jump'
    }
    this.onTakeoff?.(speed)
    return true
  }

  _updateJumpRequests(dt) {
    if (this._jumpDelay > 0) {
      this._jumpDelay -= dt
      if (this._jumpDelay <= 0) this.jump()
    }
    if (this._jumpBuffer > 0) {
      this._jumpBuffer -= dt
      if (!this.controller.airborne && this._jumpBuffer > 0) this.jump()
    }
  }

  // Change coat colours; blends over a few frames so the change reads as a transformation
  setCoat(body, mane, instant = false) {
    this._coatTarget = { Body: new THREE.Color(body), Hair: new THREE.Color(mane) }
    if (instant) this._blendCoat(1)
  }

  _blendCoat(k) {
    if (!this._coatTarget) return
    let done = true
    for (const [name, color] of Object.entries(this._coatTarget)) {
      const mat = this._coatMaterials[name]
      if (!mat) continue
      mat.color.lerp(color, k)
      if (Math.abs(mat.color.r - color.r) + Math.abs(mat.color.g - color.g) + Math.abs(mat.color.b - color.b) > 0.003) done = false
    }
    if (done) this._coatTarget = null
  }

  get canBePetted() {
    return this._ready && !this.controller.frozen && !this.controller.airborne
      && Math.abs(this.controller.speed) < 1 && !(this._oneShot && !this._oneShot.interruptible)
  }

  get isPetted() {
    return !!this._oneShot && PET_POOL.includes(this._currentActionName)
  }

  // The horse leans into the caress; any movement input ends it
  pet() {
    if (!this.canBePetted) return false
    if (this.isPetted) return true
    const name = PET_POOL[Math.floor(Math.random() * PET_POOL.length)]
    return this._playOneShot(name, { fade: 0.4, duration: 5.5, interruptible: true })
  }

  // Short body-language reaction when arriving somewhere
  react(kind) {
    if (!this._ready || this.controller.airborne || this._oneShot) return false
    if (kind === 'balk') {
      // Slams on the brakes before going any further
      return this._playOneShot(ANIM.brake, { fade: 0.2, duration: 2.4, timeScale: 1.2 })
    }
    if (kind === 'content' && Math.abs(this.controller.speed) < 3) {
      const name = CONTENT_POOL[Math.floor(Math.random() * CONTENT_POOL.length)]
      return this._playOneShot(name, { fade: 0.5, duration: 3.2, interruptible: true })
    }
    return false
  }

  getHeadPosition(target) {
    if (this._head) return this._head.getWorldPosition(target)
    return target.copy(this.mesh.position).add(new THREE.Vector3(0, 4.2, 0))
  }

  _updateEars(dt) {
    if (!this._ears.length) return
    this._earPin += (this.earPinTarget - this._earPin) * Math.min(dt * 5, 1)
    for (const ear of this._ears) {
      // Animations may or may not key the ears: start from what the mixer left, then pin back
      ear.base.copy(ear.bone.quaternion)
      if (this._earPin > 0.001) {
        _earOffset.setFromAxisAngle(EAR_AXIS, -EAR_PIN_ANGLE * this._earPin)
        ear.bone.quaternion.multiply(_earOffset)
      }
    }
  }

  _restoreEars() {
    for (const ear of this._ears) ear.bone.quaternion.copy(ear.base)
  }

  get isEmoting() {
    return this._emoting
  }

  update(dt) {
    if (!this._ready) return

    this.controller.update(dt)
    this._updateJumpRequests(dt)
    this._blendCoat(Math.min(dt * 6, 1))

    const speed = Math.abs(this.controller.speed)

    // Undo last frame's ear offset so it never accumulates on un-keyed bones
    this._restoreEars()

    if (this._oneShot) {
      const shot = this._oneShot
      shot.elapsed += dt
      // The clip's landing strides would keep galloping after touchdown: hand back to the gait soon
      if (shot.kind === 'jump' && !this.controller.airborne && shot.elapsed > 0.2) {
        shot.landed = (shot.landed || 0) + dt
        if (shot.landed > 0.18) shot.duration = 0
      }
      const wantsToMove = this.controller.input.isPressed('forward') || this.controller.input.isPressed('backward')
      if (shot.elapsed >= shot.duration || (shot.interruptible && (wantsToMove || speed > 1))) {
        this._endOneShot()
      } else {
        this.mixer?.update(dt)
        this._updateEars(dt)
        return
      }
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
    this._updateEars(dt)
  }
}
