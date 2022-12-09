export class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration, county, country, weather, icon) {
    this.coords = coords; // [[lat, lng], [lat, lng]]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.county = county;
    this.country = country;
    this.weather = weather;
    this.icon = icon;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()} ${this.county}, ${this.country}`;
  }
}
