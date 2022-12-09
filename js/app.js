'use strict';

import * as config from './config.js';
import { Running } from './classes/Running.js';
import { Cycling } from './classes/Cycling.js';

const form = document.querySelector('.form');
const formBtnSend = document.querySelector('.form--btn__send');
const formBtnClose = document.querySelector('.form--btn__close');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnSort = document.querySelector('.workout--btn__sort');
const btnDeleteAll = document.querySelector('.workout--btn__del-all');
const modal = document.querySelector('.modal');
const overlay = document.querySelector('.overlay');
const msg = document.querySelector('.modal_msg');
const btnCloseModal = document.querySelector('.btn--close-modal');
const btnConfirmModal = document.querySelector('.btn--confirm-modal');
const btnDeclineModal = document.querySelector('.btn--decline-modal');
const btnOkModal = document.querySelector('.btn--ok-modal');

// Application Architecture
class App {
  #map;
  #mapZoomLevel = 14;
  #mapEvents;
  #workouts = [];
  #sorted = false;
  // Data for working with current workout
  #coords = [];
  #points = [];
  #curDistance = 0;
  #curWorkout;
  #curWorkoutEl;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    form.addEventListener('submit', this._editWorkout.bind(this));
    formBtnSend.addEventListener('click', this._newWorkout.bind(this));
    formBtnSend.addEventListener('click', this._editWorkout.bind(this));
    formBtnClose.addEventListener('click', this._hideForm.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._setFormData.bind(this));
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
    btnSort.addEventListener('click', this._sortWorkouts.bind(this));
    btnDeleteAll.addEventListener('click', this._showDeleteAllWarn.bind(this));
    btnConfirmModal.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this)
    );
    btnCloseModal.addEventListener('click', this._hideModal);
    btnOkModal.addEventListener('click', this._hideModal);
    btnDeclineModal.addEventListener('click', this._hideModal);
    overlay.addEventListener('click', this._hideModal);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        this._hideModal();
      }
    });
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () => {
        this._showOkModalBtn();
        return this._openModal('Could not get your position');
      });
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot//{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    if (Object.keys(this.#workouts).length !== 0) {
      this.#workouts.forEach(work => {
        work.fGroup = new L.featureGroup().addTo(this.#map);
      });
      this._renderAllWorkouts();
      this._renderAllWorkoutsMarkers();
      this._renderAllWorkoutLines();
      const groups = this.#workouts.map(el => el.fGroup);
      const group = new L.featureGroup([...groups]);
      this.#map.fitBounds(group.getBounds());
      this._showWorkoutBtns();
    }
  }

  _getJSON(url, errorMsg = 'Something went wrong') {
    return fetch(url).then(response => {
      if (!response.ok) throw new Error(`${errorMsg} (${response.status})`);
      return response.json();
    });
  }

  async _getRegionAndCountry(lat, lng) {
    const data = await this._getJSON(
      `${config.URL_GEOCODE}reverse-geocode-client?latitude=${lat}&longitude=${lng}`
      // `${config.URL_GEOCODE}reverse?access_key=${config.KEY_GEOCODE}&query=${lat},${lng}`
    );

    console.log(data)

    return data;
  }

  async _getRegionWeather(lat, lng) {
    const data = await this._getJSON(
      `${config.URL_WEATHER}weather?lat=${lat}&lon=${lng}&appid=${config.KEY_WEATHER}`
    );
    return data.weather[0];
  }

  _showForm(mapE) {
    form.classList.remove('hidden--form');
    if (form.dataset.type === 'create') {
      this._addPoint(mapE);
      inputDistance.value = this._countDistance();
      inputDuration.focus();
    } else {
      inputDistance.focus();
    }
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden--form');
    setTimeout(() => (form.style.display = 'grid'), 1000);

    // Clear Points
    this._clearPoints();
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _openModal(msgText) {
    msg.textContent = msgText;
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }

  _hideModal() {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
  }

  _showOkModalBtn() {
    btnConfirmModal.classList.add('hidden');
    btnDeclineModal.classList.add('hidden');
    btnOkModal.classList.remove('hidden');
  }

  _showConfirmDeclineBtns() {
    btnOkModal.classList.add('hidden');
    btnConfirmModal.classList.remove('hidden');
    btnDeclineModal.classList.remove('hidden');
  }

  _showDeleteAllWarn() {
    this._openModal('Are you sure to delete all workouts?');
    this._showConfirmDeclineBtns();
  }

  _showWorkoutBtns() {
    btnSort.classList.remove('hidden');
    btnDeleteAll.classList.remove('hidden');
  }

  _hideWorkoutBtns() {
    btnSort.classList.add('hidden');
    btnDeleteAll.classList.add('hidden');
  }

  async _newWorkout(e) {
    if (form.dataset.type !== 'create') return;

    try {
      const validInputs = (...inputs) => inputs.every(inp => isFinite(inp));
      const allPositive = (...inputs) => inputs.every(inp => inp > 0);
      e.preventDefault();

      // Get data from form
      const type = inputType.value;
      const distance = +inputDistance.value;
      const duration = +inputDuration.value;

      const coords = this.#coords;
      const { lat, lng } = this.#coords[this.#coords.length - 1];
      const dataRegion = await this._getRegionAndCountry(lat, lng);
      const dataWeather = await this._getRegionWeather(lat, lng);

      const county = dataRegion.locality;
      const country = dataRegion.countryName;
      const weather = dataWeather.main;
      const icon = this._getWeatherIcon(dataWeather.id);
      let workout;

      // If workout running, create running object
      if (type === 'running') {
        // Check if data is valid
        const cadence = +inputCadence.value;
        if (
          !validInputs(distance, duration, cadence) ||
          !allPositive(distance, duration)
        ) {
          this._showOkModalBtn();
          return this._openModal('Inputs have to be positive numbers!');
        }
        workout = new Running(
          coords,
          distance,
          duration,
          cadence,
          county,
          country,
          weather,
          icon
        );
      }

      // If workout cycling, create cycling object
      if (type === 'cycling') {
        const elevation = +inputElevation.value;
        if (
          !validInputs(distance, duration, elevation) ||
          !allPositive(distance, duration)
        ) {
          this._showOkModalBtn();
          return this._openModal('Inputs have to be positive numbers!');
        }
        workout = new Cycling(
          coords,
          distance,
          duration,
          elevation,
          county,
          country,
          weather,
          icon
        );
      }

      workout.fGroup = L.featureGroup().addTo(this.#map);

      this.#points.forEach(point => workout.fGroup.addLayer(point));

      this.#points = [];

      this.#coords = [];

      this.#workouts.push(workout);

      this._showWorkoutBtns();

      // Render workout on map as marker
      this._renderWorkoutMarker(workout);

      // Fit screen on marker
      this._jumpToWorkout(workout);

      // Render line on map
      this._renderWorkoutLine(workout);

      // Render workout on list
      this._renderWorkout(workout);

      // Hide forms + clear input fields
      this._hideForm();

      // Set local storage to all workouts
      this._setLocalStorage();
    } catch (e) {
      this._openModal(e.message);
    }
  }

  _editWorkout(e) {
    if (form.dataset.type !== 'edit') return;

    const validInputs = (...inputs) => inputs.every(inp => isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    const index = this.#workouts.indexOf(this.#curWorkout);

    // If workout running, edit running object
    if (type === 'running') {
      // Check if data is valid
      const cadence = +inputCadence.value;
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration)
      ) {
        this._showOkModalBtn();
        return this._openModal('Inputs have to be positive numbers!');
      }
      this.#curWorkout.cadence = cadence;
    }

    // If workout cycling, edit cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        this._showOkModalBtn();
        return this._openModal('Inputs have to be positive numbers!');
      }
      this.#curWorkout.elevation = elevation;
    }

    this.#curWorkout.distance = distance;
    this.#curWorkout.duration = duration;

    this.#curWorkoutEl.classList.add('hidden');

    this.#workouts.splice(index, 1, this.#curWorkout);

    form.dataset.type = 'create';

    // Render workout on list
    this._renderWorkout(this.#curWorkout);

    // Fit screen on marker
    this._jumpToWorkout(this.#curWorkout);

    // Hide forms + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _setFormData(e) {
    if (
      e.target.tagName === 'form' ||
      !e.target.closest('.btn')?.classList.contains('btn--workout__edit')
    ) {
      return;
    }

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    form.dataset.type = 'edit';

    if (workout.type === 'running') {
      inputType.getElementsByTagName('option')[0].selected = true;
      if (
        inputCadence
          .closest('.form__row')
          .classList.contains('form__row--hidden')
      ) {
        this._toggleElevationField();
      }
      inputDistance.value = workout.distance;
      inputDuration.value = workout.duration;
      inputCadence.value = workout.cadence;
    } else if (workout.type === 'cycling') {
      inputType.getElementsByTagName('option')[1].selected = true;
      if (
        inputElevation
          .closest('.form__row')
          .classList.contains('form__row--hidden')
      ) {
        this._toggleElevationField();
      }
      inputDistance.value = workout.distance;
      inputDuration.value = workout.duration;
      inputElevation.value = workout.elevationGain;
    }

    this._showForm();

    this.#curWorkout = workout;
    this.#curWorkoutEl = workoutEl;
  }

  _deleteWorkout(e) {
    if (!e.target.closest('.btn')?.classList.contains('btn--workout__del')) {
      return;
    }
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    const index = this.#workouts.indexOf(workout);

    this.#workouts.splice(index, 1);

    workout.fGroup.remove();

    workoutEl.classList.add('hidden--workout');

    workoutEl.ontransitionend = function () {
      workoutEl.remove();
    };

    this._setLocalStorage();
  }

  _deleteAllWorkouts(e) {
    e.preventDefault();

    // Hide Modal
    this._hideModal();

    //Clean up Map from lines and markers
    this.#workouts.forEach(work => work.fGroup.remove());

    this._showConfirmDeclineBtns();

    this.#workouts = [];

    this._clearWorkoutsContainer();

    this.reset();
  }

  _sortWorkouts(e) {
    e.preventDefault();

    this.#sorted = !this.#sorted;

    this._clearWorkoutsContainer();

    this._showWorkoutBtns();

    this._renderAllWorkouts();
  }

  _addPoint(mapE) {
    this.#mapEvents = mapE;
    this.#coords.push(this.#mapEvents?.latlng);
    this._renderWorkoutPoint();
  }

  _jumpToWorkout(workout) {
    this.#map.setView(
      workout.coords[workout.coords.length - 1],
      this.#mapZoomLevel,
      {
        animate: true,
        pan: {
          duration: 1,
        },
      }
    );
  }

  _renderWorkoutMarker(workout) {
    workout.fGroup.addLayer(
      L.marker(workout.coords[workout.coords.length - 1])
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 200,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `${workout.type}-popup popup`,
          })
        )
        .setPopupContent(
          `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
        )
        .openPopup()
    );
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">FPM</span>
        </div>
      `;

    html += `
        <div class="workout__details">
          <span class="workout__icon">${workout.icon}</span>
          <span class="workout__value">${workout.weather}</span>
        </div>
        <div class="workout__btns--box">
            <button class="btn btn--workout btn--workout__edit">
              <i class="ri-pencil-line ri-2x"></i>
            </button>
            <button class="btn btn--workout btn--workout__del">
              <i class="ri-delete-bin-fill ri-2x"></i>
            </button>
          </div>
         </li>`;

    form.insertAdjacentHTML('afterend', html);
  }

  _renderAllWorkouts() {
    const workouts = this.#sorted
      ? [...this.#workouts].sort((a, b) => a.distance - b.distance)
      : this.#workouts;
    workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _renderAllWorkoutsMarkers() {
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _renderWorkoutLine(workout) {
    workout.fGroup.addLayer(
      L.polyline(workout.coords, {
        color: workout.type === 'running' ? '#00c46a' : '#ffb545',
        weight: 5,
        opacity: 0.5,
        smoothFactor: 1,
      }).addTo(this.#map)
    );
  }

  _renderAllWorkoutLines() {
    this.#workouts.forEach(work => {
      this._renderWorkoutLine(work);
    });
  }

  _renderWorkoutPoint() {
    this.#points.push(
      L.circle(this.#mapEvents?.latlng, { radius: 1, color: '#3388cc' }).addTo(
        this.#map
      )
    );
  }

  _clearPoints() {
    this.#points.forEach(point => point.remove());
  }

  _clearWorkoutsContainer() {
    containerWorkouts.querySelectorAll('.workout').forEach(work => {
      work.remove();
    });

    this._hideWorkoutBtns();
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this._jumpToWorkout(workout);
  }

  _countDistance() {
    if (this.#coords.length <= 1) return 0;
    this.#curDistance += this.#coords[this.#coords.length - 2].distanceTo(
      this.#coords[this.#coords.length - 1]
    );
    return (this.#curDistance / 1000).toFixed(2);
  }

  _getWeatherIcon(id) {
    switch (true) {
      case id >= 200 && id < 300:
        return '⛈';
      case id >= 300 && id < 400:
        return '⛅';
      case id >= 500 && id < 600:
        return '🌧';
      case id >= 600 && id < 700:
        return '🌨';
      case id >= 700 && id < 800:
        return '🌫';
      case id === 800:
        return '☀';
      case id > 800:
        return '☁';
      default:
        return 'error';
    }
  }

  _setLocalStorage() {
    const replacer = (key, value) => {
      if (key === 'fGroup') return undefined;
      else return value;
    };
    localStorage.setItem('workouts', JSON.stringify(this.#workouts, replacer));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts = data.map(work => {
      let obj;
      if (work.type === 'running') {
        obj = new Running(
          work.coords,
          work.distance,
          work.duration,
          work.cadence
        );
      } else if (work.type === 'cycling') {
        obj = new Cycling(
          work.coords,
          work.distance,
          work.duration,
          work.elevationGain
        );
      }
      obj.date = work.date;
      obj.description = work.description;
      obj.county = work.county;
      obj.country = work.country;
      obj.id = work.id;
      obj.weather = work.weather;
      obj.icon = work.icon;

      return obj;
    });
  }

  reset() {
    localStorage.removeItem('workouts');
  }
}

const app = new App();
