import { registerPlugin } from "@capacitor/core"

export interface CompassHeading {
  heading: number
  accuracy: number
}

export interface CompassPlugin {
  startWatching(): Promise<void>
  stopWatching(): Promise<void>
  addListener(eventName: "headingChanged", listenerFunc: (heading: CompassHeading) => void): Promise<void>
  removeAllListeners(): Promise<void>
}

const Compass = registerPlugin<CompassPlugin>("Compass", {
  web: () => import("./compass-plugin-web").then((m) => new m.CompassWeb()),
})

export default Compass
