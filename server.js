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
const superagent = require('superagent');

// =============================================================
// Functions and Object constructors

// searches DB for location information returns a new object
function searchToLatLng(req, res) {
  //const geoData = require('./data/geo.json');
  const locationName = req.query.data;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`;
  superagent.get(url)
    .then (result =>{
      Location.currentLocation = new Location(locationName, result.body.results[0].formatted_address, result.body.results[0].geometry.location.lat, result.body.results[0].geometry.location.lng);
      res.send(Location.currentLocation);
    })
    .catch(e => {
      responseError(e);
    })
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
function searchWeather(req, res) {
  // database of information
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${Location.currentLocation.latitude},${Location.currentLocation.longitude}`;
  //const weatherData = require('./data/darksky.json');
  superagent.get(url)
    .then (result =>{
      let time = result.body.daily.data.map(day => {
        return new Weather(day.time, day.summary)
      });
      res.send(time);
    })
    .catch(e => {
      responseError(e);
    })
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
app.get('/location', searchToLatLng);

// Set up route to weather page
app.get('/weather', searchWeather);

// Default selector and notifier
app.use('*', (req, res) => {
  res.status(500).send('Sorry, something went wrong.');
});

// start the server
app.listen(PORT, () => {
  console.log(`app is up on port ${PORT}`);
});
