import instructionSet, { Instruction } from "./data/instruction-set"

export default {
  disassemble(opcode: number): [Instruction, number[]] {
    const instruction = instructionSet.find(
      instruction => (opcode & instruction.mask) === instruction.pattern,
    )
    if (!instruction) throw new Error("opcode has no compactive instruction")

    const args = instruction.arguments.map(
      arg => (opcode & arg.mask) >> arg.shift,
    )

    return [instruction, args]
  },

  format(decodedInstruction: [Instruction, number[]]) {
    // Print out formatted instructions from the disassembled instructions
    const types = decodedInstruction[0].arguments.map(arg => arg.type)
    const rawArgs = decodedInstruction[1]
    let formattedInstruction: string

    // Format the display of arguments based on type
    if (rawArgs.length > 0) {
      let args: string[] = []

      rawArgs.forEach((arg, i) => {
        switch (types[i]) {
          case "R":
            args.push("V" + arg.toString(16))
            break
          case "N":
          case "NN":
            args.push("0x" + arg.toString(16).padStart(2, "0"))
            break

          case "K":
          case "V0":
          case "I":
          case "[I]":
          case "DT":
          case "B":
          case "ST":
            args.push(types[i])
            break
          default:
            // DW
            args.push("0x" + arg.toString(16))
        }
      })
      formattedInstruction = decodedInstruction[0].name + " " + args.join(", ")
    } else {
      formattedInstruction = decodedInstruction[0].name
    }

    return formattedInstruction
  },

  // For debugging
  dump(data: string[]) {
    const lines = data.map((code, i) => {
      const address = (i * 2).toString(16).padStart(6, "0")
      const opcode = (+code).toString(16).padStart(4, "0")
      const instruction = this.format(this.disassemble(+code))

      return `${address}  ${opcode}  ${instruction}`
    })

    return lines.join("\n")
  },
}
