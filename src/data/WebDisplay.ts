import DisplayInterface from "../DisplayInterface"
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, COLOR } from "../constants"
import keyMap from "../keyMap"

export default class WebDisplay implements DisplayInterface {
  private frameBuffer = this.createFrameBuffer()
  private screen: HTMLCanvasElement
  private context: CanvasRenderingContext2D | null
  private audioContext: AudioContext
  private masterGain: GainNode
  private multiplier = 10
  private keys = 0
  private keyPressed: number | undefined
  private _soundEnabled = false
  private oscillator: OscillatorNode | undefined
  constructor() {
    this.screen = document.createElement("canvas")
    this.screen.width = DISPLAY_WIDTH * this.multiplier
    this.screen.height = DISPLAY_HEIGHT * this.multiplier
    // TODO insert into DOM
    this.context = this.screen.getContext("2d")
    if (this.context) {
      this.context.fillStyle = "black"
      this.context.fillRect(0, 0, this.screen.width, this.screen.height)
    } else {
      throw Error("context must be a Context2D")
    }

    this.audioContext = new AudioContext()
    this.masterGain = new GainNode(this.audioContext)
    this.masterGain.gain.value = 0.3
    this.masterGain.connect(this.audioContext.destination)

    // Interface for muting sound
    const muteInstructions = document.createElement("pre")
    muteInstructions.classList.add("instructions")
    muteInstructions.innerText = "M = toggle sound "
    const muteIcon = document.createElement("span")
    muteIcon.innerText = "🔊"
    muteInstructions.append(muteIcon)
    // TODO insert into DOM
    let muted = false
    document.addEventListener("keydown", event => {
      if (event.key.toLowerCase() === "m") {
        muted = !muted
        muteIcon.innerText = muted ? "🔇" : "🔊"
        this.masterGain.gain.value = muted ? 0 : 0.3
      }
    })

    document.addEventListener("keydown", event => {
      const keyIndex = keyMap.indexOf(event.key)

      if (keyIndex > -1) this.setKeys(keyIndex)
    })

    document.addEventListener("keyup", event => {
      this.resetKeys()
    })
  }

  get soundEnabled() {
    return this._soundEnabled
  }
  set soundEnabled(value) {
    value = !!value
    this._soundEnabled = value
    if (this.soundEnabled) {
      this.oscillator = new OscillatorNode(this.audioContext, {
        type: "square",
      })
      this.oscillator.connect(this.masterGain)
      this.oscillator.start()
    } else {
      this.oscillator?.stop()
    }
  }
  clear() {
    this.frameBuffer = this.createFrameBuffer()
    this.context && (this.context.fillStyle = "black")
    this.context?.fillRect(0, 0, this.screen.width, this.screen.height)
  }
  draw(x: number, y: number, value: number) {
    const collision = this.frameBuffer[y][x] & value
    this.frameBuffer[y][x] ^= value
    if (this.frameBuffer[y][x]) {
      this.context && (this.context.fillStyle = COLOR)
      this.context?.fillRect(
        x * this.multiplier,
        y * this.multiplier,
        this.multiplier,
        this.multiplier,
      )
    } else {
      this.context && (this.context.fillStyle = "black")
      this.context?.fillRect(
        x * this.multiplier,
        y * this.multiplier,
        this.multiplier,
        this.multiplier,
      )
    }

    return collision
  }
  getKeys() {
    return this.keys
  }
  waitKey() {
    const keyPressed = this.keyPressed
    this.keyPressed = undefined
    return keyPressed
  }
  enableSound() {
    this.soundEnabled = true
  }
  disableSound() {
    this.soundEnabled = false
  }
  setKeys(keyIndex: number) {
    let keyMask = 1 << keyIndex
    this.keys = this.keys | keyMask
    this.keyPressed = keyIndex
  }
  resetKeys() {
    this.keys = 0
    this.keyPressed = undefined
  }
  private createFrameBuffer() {
    let frameBuffer: number[][] = []
    for (let i = 0; i < DISPLAY_WIDTH; i++) {
      frameBuffer.push([])
      for (let j = 0; j < DISPLAY_HEIGHT; j++) {
        frameBuffer[i].push(0)
      }
    }

    return frameBuffer
  }
}
