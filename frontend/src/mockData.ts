export type LatLng = [number, number]

export interface RouteOption {
  id: string
  type: 'quiet' | 'fast'
  label: string
  duration: string
  meta: string
  description: string
  color: string
  path: LatLng[]
}

export interface Place {
  id: string
  name: string
  image: string
  sensoryScore: number
  descriptor: string
  descriptorIcon: 'volume' | 'people' | 'light'
  position: LatLng
}

export interface Sanctuary {
  id: string
  name: string
  distanceKm: number
  status: string
  noise: { level: string; description: string }
  capacity: { level: string; description: string }
  position: LatLng
}

export const MELBOURNE_CBD: LatLng = [-37.8136, 144.9631]

export const routes: RouteOption[] = [
  {
    id: 'quiet-1',
    type: 'quiet',
    label: 'Quiet Route',
    duration: '2 hour',
    meta: '18dB avg',
    description: 'Residential & Parks · Minimal traffic noise',
    color: '#5EE39C',
    path: [
      [-37.8098, 144.9652],
      [-37.8140, 144.9660],
      [-37.8180, 144.9680],
      [-37.8235, 144.9700],
      [-37.8290, 144.9740],
      [-37.8330, 144.9790],
      [-37.8380, 144.9835],
    ],
  },
  {
    id: 'fast-1',
    type: 'fast',
    label: 'Fastest Route',
    duration: '1 hour',
    meta: 'High activity',
    description: 'Direct main roads · Efficient but busy',
    color: '#C22A2A',
    path: [
      [-37.8098, 144.9652],
      [-37.8112, 144.9720],
      [-37.8135, 144.9810],
      [-37.8175, 144.9920],
      [-37.8210, 145.0000],
    ],
  },
]

export const places: Place[] = [
  {
    id: 'state-library',
    name: 'State Library Victoria',
    image:
      'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=600&q=80',
    sensoryScore: 4.8,
    descriptor: '12dB · Very Quiet',
    descriptorIcon: 'volume',
    position: [-37.8098, 144.9652],
  },
  {
    id: 'fitzroy-gardens',
    name: 'Fitzroy Gardens',
    image:
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80',
    sensoryScore: 4.9,
    descriptor: 'Low Crowds',
    descriptorIcon: 'people',
    position: [-37.8135, 144.9797],
  },
  {
    id: 'calm-corner',
    name: 'The Calm Corner Cafe',
    image:
      'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=600&q=80',
    sensoryScore: 4.6,
    descriptor: 'Soft Lighting',
    descriptorIcon: 'light',
    position: [-37.8156, 144.9720],
  },
]

export const sanctuary: Sanctuary = {
  id: 'state-library',
  name: 'State Library Victoria',
  distanceKm: 21,
  status: 'Closed · Opens 10 AM',
  noise: {
    level: 'Low',
    description: 'Minimal noise and soft lighting recorded today.',
  },
  capacity: {
    level: 'Quiet',
    description: '20% capacity in the dome reading room.',
  },
  position: [-37.8098, 144.9652],
}

export const warning = {
  title: 'Warning',
  message: 'Heavy crowd predicted ahead. Try a calmer route?',
}

export const weather = {
  temperatureC: 15,
  icon: 'partly-cloudy',
}
