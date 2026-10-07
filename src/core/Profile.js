// The rider's horse: its name and coat, remembered between visits
const KEY = 'augosol-horse'

export const PLAYER_COATS = [
  { id: 'alezan', label: 'Alezan', body: 0xb5652b, mane: 0xd4a860, swatch: ['#b0602a', '#d8ae66'] },
  { id: 'bai', label: 'Bai', body: 0x7a3e1c, mane: 0x2a1d15, swatch: ['#73391a', '#2b1e16'] },
  { id: 'gris', label: 'Gris', body: 0xc4bcb0, mane: 0xe2dcd2, swatch: ['#c9c2b8', '#ece7df'] },
  { id: 'noir', label: 'Noir', body: 0x3a2c24, mane: 0x1e1712, swatch: ['#3a2c24', '#16110d'] },
  { id: 'palomino', label: 'Palomino', body: 0xd9a85c, mane: 0xf2e4c4, swatch: ['#d6a65a', '#f4e8cc'] },
]

export default class Profile {
  constructor() {
    this.name = ''
    this.coat = PLAYER_COATS[0].id
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
      if (typeof saved.name === 'string') this.name = Profile.clean(saved.name)
      if (PLAYER_COATS.some(c => c.id === saved.coat)) this.coat = saved.coat
    } catch {
      // Nothing saved or storage blocked: defaults are fine
    }
  }

  static clean(value) {
    return value.replace(/[<>{}\\]/g, '').replace(/\s+/g, ' ').trimStart().slice(0, 18)
  }

  get coatDef() {
    return PLAYER_COATS.find(c => c.id === this.coat) || PLAYER_COATS[0]
  }

  // "Mambo" or "Votre cheval" at the start of a sentence, "votre cheval" inside one
  get Name() {
    return this.name.trim() || 'Votre cheval'
  }

  get nameInSentence() {
    return this.name.trim() || 'votre cheval'
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ name: this.name.trim(), coat: this.coat }))
    } catch {
      // Private mode: the choice lasts for this visit only
    }
  }
}
