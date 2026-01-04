export function getQiblaDegrees(userLat: number, userLng: number) {
  const kaabaLat = (21.4225 * Math.PI) / 180
  const kaabaLng = (39.8262 * Math.PI) / 180
  const myLat = (userLat * Math.PI) / 180
  const myLng = (userLng * Math.PI) / 180

  const y = Math.sin(kaabaLng - myLng)
  const x = Math.cos(myLat) * Math.sin(kaabaLat) - Math.sin(myLat) * Math.cos(kaabaLat) * Math.cos(kaabaLng - myLng)

  const degree = (Math.atan2(y, x) * 180) / Math.PI
  return (degree + 360) % 360
}

export function getDistanceToKaaba(userLat: number, userLng: number) {
  const R = 6371 // Earth's radius in km
  const kaabaLat = (21.4225 * Math.PI) / 180
  const kaabaLng = (39.8262 * Math.PI) / 180
  const lat = (userLat * Math.PI) / 180
  const lng = (userLng * Math.PI) / 180

  const dLat = kaabaLat - lat
  const dLng = kaabaLng - lng

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat) * Math.cos(kaabaLat) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
