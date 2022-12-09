import { Workout } from './Workout.js';

export class Running extends Workout {
  type = 'running';

  constructor(
    coords,
    distance,
    duration,
    cadence,
    county,
    country,
    weather,
    icon
  ) {
    super(coords, distance, duration, county, country, weather, icon);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.distance / (this.duration / 60);
    return this.pace;
  }
}
