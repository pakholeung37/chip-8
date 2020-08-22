export default interface DisplayInterface {
  clear: () => void
  draw: (x: number, y: number, value: number) => boolean
  getKeys: () => number
  waitKey: () => number
  enableSound: () => boolean
}
