import { registerPlugin } from "@capacitor/core"

export interface CompassHeading {
  heading: number
  accuracy: number
  pitch?: number
  roll?: number
  needsLevelWarning?: boolean
  isStabilizing?: boolean
  hasMagneticInterference?: boolean
}

export interface CalibrationWarning {
  needsCalibration: boolean
  sensorAccuracy: number
}

export interface LocationData {
  latitude: number
  longitude: number
  altitude: number
}

export interface CompassPlugin {
  startWatching(): Promise<void>
  stopWatching(): Promise<void>
  setLocation(location: LocationData): Promise<void>
  addListener(eventName: "headingChanged", listenerFunc: (heading: CompassHeading) => void): Promise<any>
  addListener(eventName: "accuracyWarning", listenerFunc: (warning: CalibrationWarning) => void): Promise<any>
  removeAllListeners(): Promise<void>
}

const Compass = registerPlugin<CompassPlugin>("Compass", {
  web: () => import("./compass-plugin-web").then((m) => new m.CompassWeb()),
})

export default Compass
