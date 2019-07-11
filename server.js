'use strict';

//  App dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

// Global vars
const PORT = process.env.PORT || 3001;
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error',
  error => {
    console.log(error);
  }
)

// Make our server middleware
const app = express();
app.use(cors());

// =============================================================
// Functions and Object constructors

// searches DB for location information returns a new object
function searchToLatLng(req, res) {
  const locationName = req.query.data;
  const response = res;
  //start db query to see if location exists
  dbQuery('locations', locationName, response, infoExists, noLocation);
}

//handles db queries to see info request exists
function dbQuery(queryType, locationName, response, handleTrue, handleFalse) {

  //TODO: refactor to handle other reqs from weather, events, etc
  // TODO: locationname might not be what we expect

  if(queryType === 'locations') {
    client.query(
      `SELECT * FROM locations 
      WHERE search_query = $1`,
      [locationName])
      .then(sqlResult => {
        if(sqlResult.rowCount) {
          //this was passed infoExists in the func searchToLatLng: handleTrue === infoExists
          handleTrue(sqlResult, response);
        } else {
          //this was passed noInfo in the func searchToLatLng: handleFalse === noInfo
          handleFalse(locationName, response);
        }
      })
      .catch(e => {
        responseError(e);
      });
  } else {
    client.query(
      `SELECT * FROM $1 
      WHERE location_id = $2`, [queryType, getId(locationName)])
      .then(sqlResult => {
        if(sqlResult.rowCount) {
        //this was passed infoExists in the func searchToLatLng: handleTrue === infoExists
          handleTrue(sqlResult, response);
        } else {
        //this was passed noInfo in the func searchToLatLng: handleFalse === noInfo
          handleFalse(locationName, response);
        }
      })
      .catch(e => {
        responseError(e);
      });
  }
}

function getId (locationName){
  client.query(
    `SELECT id FROM locations
    WHERE search_query = $1`,
    [locationName]
  )
    .then(sqlResult => {
      return(sqlResult.rows[0])
    })
    .catch(e => {
      responseError(e);
    });
}

//send back all sql info for that row
//psql command is: SELECT * FROM locations WHERE search_query='INSERTLOCATIONNAME'
function infoExists(sqlResult, res) {
  res.send(sqlResult.rows[0]);
}

//TODO add similar functions for events, yelp, etc
function noLocation(locationName, res) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`;

  superagent.get(url)
    .then (result =>{
      let location = new Location(locationName, result.body.results[0].formatted_address, result.body.results[0].geometry.location.lat, result.body.results[0].geometry.location.lng);
      res.send(location);
      client.query(
        `
        INSERT INTO locations (
          search_query,
          formatted_query,
          latitude,
          longitude
        )
        VALUES ($1, $2, $3, $4)`,
        [location.search_query, location.formatted_query, location.latitude, location.longitude]
      )
    })
    .catch(e => {
      responseError(e);
    });
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
  dbQuery('weathers', req, res, infoExists, noWeather);
}

function noWeather(locationName, res) {
  const lat = locationName.latitude;
  const long = locationName.longitude;
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${lat},${long}`;
  superagent.get(url)
    .then (result =>{
      let dailyForecast = result.body.daily.data.map(day => {
        return new Weather(day.dailyForecast, day.summary)
      });
      res.send(dailyForecast);
      client.query(
        `INSERT INTO weathers (
          forecast,
          time,
          location_id
        ) 
        VALUES ($1, $2, $3)`,
        [dailyForecast.forecast, dailyForecast.time, getId(locationName)]
      )
    })
    .catch(e => {
      responseError(e);
    })
}

// Weather Object constructor
function Weather(dailyForecast, forecast) {
  this.forecast = forecast;
  this.time = new Date(dailyForecast * 1000).toDateString();
}


// searches for Events
function searchEvents(req, res) {
  // url
  const lat = req.query.data.latitude;
  const long = req.query.data.longitude;
  // this is very filtered, sometimes no events apply
  const url = `https://www.eventbriteapi.com/v3/events/search/?sort_by=best&location.within=10mi&location.latitude=${lat}&location.longitude=${long}&categories=109%2C119&price=free&start_date.keyword=this_week&token=${process.env.EVENTBRITE_API_KEY}`

  superagent.get(url)
    .then (result => {

      let temp = result.body.events.map(event => {
        return new Event(event.url, event.name.text, event.start.local, event.summary);
      });

      res.send(temp);
    })
    .catch(e => {
      responseError(e);
    })
}

function Event(link, name, event_date, summary){
  this.link = link;
  this.name = name;
  this.event_date = new Date(event_date).toDateString();
  this.summary = summary;
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

// Set up route to weather page
app.get('/events', searchEvents);

// Default selector and notifier
app.use('*', (req, res) => {
  res.status(500).send('Sorry, something went wrong.');
});

// start the server
app.listen(PORT, () => {
  console.log(`app is up on port ${PORT}`);
});
