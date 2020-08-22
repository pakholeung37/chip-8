import disassembler from "./disassembler"
import { Instruction } from "./data/instruction-set"
import DisplayInterface from "./DisplayInterface"
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from "./constants"

export default class CPU {
  /**
   * program counter start from 0x200
   *
   * Memory Map:
   * +---------------+= 0xFFF (4095) End of Chip-8 RAM
   * |               |
   * |               |
   * |               |
   * |               |
   * |               |
   * | 0x200 to 0xFFF|
   * |     Chip-8    |
   * | Program / Data|
   * |     Space     |
   * |               |
   * |               |
   * |               |
   * +- - - - - - - -+= 0x600 (1536) Start of ETI 660 Chip-8 programs
   * |               |
   * |               |
   * |               |
   * +---------------+= 0x200 (512) Start of most Chip-8 programs
   * | 0x000 to 0x1FF|
   * | Reserved for  |
   * |  interpreter  |
   * +---------------+= 0x000 (0) Start of Chip-8 RAM
   *
   */
  private memory = new Uint8Array(4096)
  // register V0 to VE
  private V = new Uint8Array(16)
  private stack = new Uint16Array(16)
  // sound timer
  private ST = 0
  // delay timer
  private DT = 0
  // index register;
  private I = 0
  // stack pointer
  private SP = -1
  // program counter
  private PC = 0x200
  // config
  private halted = true
  private soundEnabled = false
  private interface: DisplayInterface
  public constructor(display: DisplayInterface) {
    this.interface = display
    this.init()
  }
  private init() {
    this.memory.fill(0)
    this.V.fill(0)
    this.stack.fill(0)
    this.ST = 0
    this.DT = 0
    this.I = 0
    this.SP = -1
    this.halted = true
    this.soundEnabled = false
  }

  private halt() {
    this.halted = true
  }

  private loop() {
    const opcode = this.fetch()
    const insTuble = this.decode(opcode)
    this.execute(insTuble)
    //update timers
  }

  private fetch() {
    if (this.PC > 4094) {
      this.halt()
      throw new Error("memory out of bounds")
    }
    return (this.memory[this.PC] << 8) | this.memory[this.PC + 1]
  }

  private decode(opcoode: number) {
    return disassembler.disassemble(opcoode)
  }

  private execute([instruction, args]: [Instruction, number[]]) {
    const id = instruction.id
    // Execute code based on the ID of the instruction
    switch (id) {
      case "CLS":
        // 00E0 - Clear the display
        this.interface.clear()
        this.next()
        break

      case "RET":
        // 00EE - Return from a subroutine
        if (this.SP === -1) {
          this.halted = true
          throw new Error("Stack underflow.")
        }

        this.PC = this.stack[this.SP]
        this.SP--
        break

      case "JP_ADDR":
        // 1nnn - Jump to location nnn
        this.PC = args[0]
        break

      case "CALL_ADDR":
        // 2nnn - Call subroutine at nnn
        if (this.SP === 15) {
          this.halted = true
          throw new Error("Stack overflow.")
        }

        this.SP++
        this.stack[this.SP] = this.PC + 2
        this.PC = args[0]
        break

      case "SE_VX_NN":
        // 3xnn - Skip next instruction if Vx = nn
        if (this.V[args[0]] === args[1]) {
          this.skip()
        } else {
          this.next()
        }
        break

      case "SNE_VX_NN":
        // 4xnn - Skip next instruction if Vx != nn
        if (this.V[args[0]] !== args[1]) {
          this.skip()
        } else {
          this.next()
        }
        break

      case "SE_VX_VY":
        // 5xy0 - Skip next instruction if Vx = Vy
        if (this.V[args[0]] === this.V[args[1]]) {
          this.skip()
        } else {
          this.next()
        }
        break

      case "LD_VX_NN":
        // 6xnn - Set Vx = nn
        this.V[args[0]] = args[1]
        this.next()
        break

      case "ADD_VX_NN":
        // 7xnn - Set Vx = Vx + nn
        let v = this.V[args[0]] + args[1]
        if (v > 255) {
          v -= 256
        }
        this.V[args[0]] = v
        this.next()
        break

      case "LD_VX_VY":
        // 8xy0 - Set Vx = Vy
        this.V[args[0]] = this.V[args[1]]
        this.next()
        break

      case "OR_VX_VY":
        // 8xy1 - Set Vx = Vx OR Vy
        this.V[args[0]] |= this.V[args[1]]
        this.next()
        break

      case "AND_VX_VY":
        // 8xy2 - Set Vx = Vx AND Vy
        this.V[args[0]] &= this.V[args[1]]
        this.next()
        break

      case "XOR_VX_VY":
        // 8xy3 - Set Vx = Vx XOR Vy
        this.V[args[0]] ^= this.V[args[1]]
        this.next()
        break

      case "ADD_VX_VY":
        // 8xy4 - Set Vx = Vx + Vy, set VF = carry
        this.V[args[0]] += this.V[args[1]]
        this.V[0xf] = this.V[args[0]] + this.V[args[1]] > 0xff ? 1 : 0

        this.next()
        break

      case "SUB_VX_VY":
        // 8xy5 - Set Vx = Vx - Vy, set VF = NOT borrow
        this.V[0xf] = this.V[args[0]] > this.V[args[1]] ? 1 : 0
        this.V[args[0]] -= this.V[args[1]]

        this.next()
        break

      case "SHR_VX_VY":
        // 8xy6 - Set Vx = Vx SHR 1
        this.V[0xf] = this.V[args[0]] & 1
        this.V[args[0]] >>= 1
        this.next()
        break

      case "SUBN_VX_VY":
        // 8xy7 - Set Vx = Vy - Vx, set VF = NOT borrow
        this.V[0xf] = this.V[args[1]] > this.V[args[0]] ? 1 : 0

        this.V[args[0]] = this.V[args[1]] - this.V[args[0]]
        this.next()
        break

      case "SHL_VX_VY":
        // 8xyE - Set Vx = Vx SHL 1
        this.V[0xf] = this.V[args[0]] >> 7

        this.V[args[0]] <<= 1
        this.next()
        break

      case "SNE_VX_VY":
        // 9xy0 - Skip next instruction if Vx != Vy
        if (this.V[args[0]] !== this.V[args[1]]) {
          this.skip()
        } else {
          this.next()
        }
        break

      case "LD_I_ADDR":
        // Annn - Set I = nnn
        this.I = args[1]
        this.next()
        break

      case "JP_V0_ADDR":
        // Bnnn - Jump to location nnn + V0
        this.PC = this.V[0] + args[1]
        break

      case "RND_VX_NN":
        // Cxnn - Set Vx = random byte AND nn
        let random = Math.floor(Math.random() * 0xff)
        this.V[args[0]] = random & args[1]
        this.next()
        break

      case "DRW_VX_VY_N":
        // Dxyn - Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision
        if (this.I > 4095 - args[2]) {
          this.halted = true
          throw new Error("Memory out of bounds.")
        }

        // If no pixels are erased, set VF to 0
        this.V[0xf] = 0

        // The interpreter reads n bytes from memory, starting at the address stored in I
        for (let i = 0; i < args[2]; i++) {
          let line = this.memory[this.I + i]
          // Each byte is a line of eight pixels
          for (let position = 0; position < 8; position++) {
            // Get the byte to set by position
            let value = line & (1 << (7 - position)) ? 1 : 0
            // If this causes any pixels to be erased, VF is set to 1
            let x = (this.V[args[0]] + position) % DISPLAY_WIDTH // wrap around width
            let y = (this.V[args[1]] + i) % DISPLAY_HEIGHT // wrap around height

            if (this.interface.draw(x, y, value)) {
              this.V[0xf] = 1
            }
          }
        }

        this.next()
        break

      case "SKP_VX":
        // Ex9E - Skip next instruction if key with the value of Vx is pressed
        if (this.interface.getKeys() & (1 << this.V[args[0]])) {
          this.skip()
        } else {
          this.next()
        }
        break

      case "SKNP_VX":
        // ExA1 - Skip next instruction if key with the value of Vx is not pressed
        if (!(this.interface.getKeys() & (1 << this.V[args[0]]))) {
          this.skip()
        } else {
          this.next()
        }
        break

      case "LD_VX_DT":
        // Fx07 - Set Vx = delay timer value
        this.V[args[0]] = this.DT
        this.next()
        break

      case "LD_VX_N":
        // Fx0A - Wait for a key press, store the value of the key in Vx
        const keyPress = this.interface.waitKey()

        if (!keyPress) {
          return
        }

        this.V[args[0]] = keyPress
        this.next()
        break

      case "LD_DT_VX":
        // Fx15 - Set delay timer = Vx
        this.DT = this.V[args[1]]
        this.next()
        break

      case "LD_ST_VX":
        // Fx18 - Set sound timer = Vx
        this.ST = this.V[args[1]]
        if (this.ST > 0) {
          this.soundEnabled = true
          this.interface.enableSound()
        }
        this.next()
        break

      case "ADD_I_VX":
        // Fx1E - Set I = I + Vx
        this.I = this.I + this.V[args[1]]
        this.next()
        break

      case "LD_F_VX":
        // Fx29 - Set I = location of sprite for digit Vx
        if (this.V[args[1]] > 0xf) {
          this.halted = true
          throw new Error("Invalid digit.")
        }

        this.I = this.V[args[1]] * 5
        this.next()
        break

      case "LD_B_VX":
        // Fx33 - Store BCD representation of Vx in memory locations I, I+1, and I+2
        // BCD means binary-coded decimal
        // If VX is 0xef, or 239, we want 2, 3, and 9 in I, I+1, and I+2
        if (this.I > 4093) {
          this.halted = true
          throw new Error("Memory out of bounds.")
        }

        let x = this.V[args[1]]
        const a = Math.floor(x / 100) // for 239, a is 2
        x = x - a * 100 // subtract value of a * 100 from x (200)
        const b = Math.floor(x / 10) // x is now 39, b is 3
        x = x - b * 10 // subtract value of b * 10 from x (30)
        const c = Math.floor(x) // x is now 9

        this.memory[this.I] = a
        this.memory[this.I + 1] = b
        this.memory[this.I + 2] = c

        this.next()
        break

      case "LD_I_VX":
        // Fx55 - Store V V0 through Vx in memory starting at location I
        if (this.I > 4095 - args[1]) {
          this.halted = true
          throw new Error("Memory out of bounds.")
        }

        for (let i = 0; i <= args[1]; i++) {
          this.memory[this.I + i] = this.V[i]
        }

        this.next()
        break

      case "LD_VX_I":
        // Fx65 - Read V V0 through Vx from memory starting at location I
        if (this.I > 4095 - args[0]) {
          this.halted = true
          throw new Error("Memory out of bounds.")
        }

        for (let i = 0; i <= args[0]; i++) {
          this.V[i] = this.memory[this.I + i]
        }

        this.next()
        break

      default:
        // Data word
        this.halted = true
        throw new Error("Illegal instruction.")
    }
  }

  private next() {
    this.PC += 2
  }
  private skip() {
    this.PC += 4
  }
}
