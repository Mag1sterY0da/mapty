import { Workout } from './Workout.js';

export class Cycling extends Workout {
  type = 'cycling';

  constructor(
    coords,
    distance,
    duration,
    elevationGain,
    county,
    country,
    weather,
    icon
  ) {
    super(coords, distance, duration, county, country, weather, icon);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.duration / this.distance;
    return this.speed;
  }
}
