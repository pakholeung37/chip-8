export default interface DisplayInterface {
  clear: () => void
  draw: (x: number, y: number, value: number) => number
  getKeys: () => number
  waitKey: () => number | undefined
  enableSound: () => void
  disableSound: () => void
  setKeys: (arg: number) => void
  resetKeys: () => void
}
