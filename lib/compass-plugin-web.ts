import { WebPlugin } from "@capacitor/core"
import type { CompassPlugin } from "./compass-plugin"

export class CompassWeb extends WebPlugin implements CompassPlugin {
  private listener: ((event: DeviceOrientationEvent) => void) | null = null

  async startWatching(): Promise<void> {
    // Check for iOS 13+ permission
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      const permission = await (DeviceOrientationEvent as any).requestPermission()
      if (permission !== "granted") {
        throw new Error("Permission denied")
      }
    }

    this.listener = (event: DeviceOrientationEvent) => {
      let heading = 0
      let accuracy = 0

      if ((event as any).webkitCompassHeading !== undefined) {
        heading = (event as any).webkitCompassHeading
        accuracy = (event as any).webkitCompassAccuracy || 0
      } else if (event.alpha !== null) {
        heading = 360 - (event.alpha || 0)
        accuracy = -1 // Unknown accuracy for Android web
      }

      this.notifyListeners("headingChanged", {
        heading: (heading + 360) % 360,
        accuracy,
      })
    }

    window.addEventListener("deviceorientationabsolute", this.listener as any, true)
    window.addEventListener("deviceorientation", this.listener as any, true)
  }

  async stopWatching(): Promise<void> {
    if (this.listener) {
      window.removeEventListener("deviceorientationabsolute", this.listener as any, true)
      window.removeEventListener("deviceorientation", this.listener as any, true)
      this.listener = null
    }
  }
}
