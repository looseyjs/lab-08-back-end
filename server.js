'use strict';

//  App dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Global vars
const PORT = process.env.PORT || 3001;

// Make our server middleware
const app = express();
app.use(cors());

// =============================================================
// Functions and Object constructors

// searches DB for location information returns a new object
function searchToLatLng(locationName) {
  const geoData = require('./data/geo.json');
  const location = new Location(locationName, geoData.results[0].formatted_address, geoData.results[0].geometry.location.lat, geoData.results[0].geometry.location.lng);

  return location;
}

// Location Object constructor
function Location(locationName, query, lat, lng) {
  this.search_query = locationName;
  this.formatted_query = query;
  this.latitude = lat;
  this.longitude = lng;
}

// searches DB for weather information returns a new object
// pass in data to use for look up
function searchWeather() {
  // database of information
  const weatherData = require('./data/darksky.json');
  let time = weatherData.daily.data.map(day => {
    return new Weather(day.time, day.summary)
  });

  // construct object using data
  // for (let i = 0; i < 8; i++) {
  //   time.push(new Weather(weatherData.daily.data[i].time, weatherData.daily.data[i].summary));
  // }

  return time;
}

// Weather Object constructor
function Weather(time, forecast) {
  this.forecast = forecast;
  this.time = new Date(time * 1000).toDateString();
}

// response error code
function responseError() {
  let error = { status: 500, responseText: 'Sorry, something went wrong.' };
  return error;
}

// Set up route to location page
app.get('/location', (req, res) => {
  try {
    const LocationData = searchToLatLng(req.query.data);
    res.send(LocationData);
  } catch (e) {
    res.send(responseError());
  }
});

// Set up route to weather page
app.get('/weather', (req, res) => {
  try {
    const weatherData = searchWeather(req.query.data);
    res.send(weatherData);
  } catch (e) {
    res.send(responseError());
  }
});

// Default selector and notifier
app.use('*', (req, res) => {
  res.status(500).send('Sorry, something went wrong.');
});

// start the server
app.listen(PORT, () => {
  console.log(`app is up on port ${PORT}`);
});
