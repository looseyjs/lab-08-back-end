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


// =============================================================
// Functions and Object constructors

// searches DB for location information returns a new object
function searchToLatLng(request, response) {
  const locationName = request.query.data;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`;

  //start db query to see if location exists
  dbQuery('search_query', locationName, 'locations', url, noLocation)
    .then(locationData => {
      response.send(locationData);
    })
    .catch(e => {
      responseError(e);
    });
}

//handles db queries to see info request exists
function dbQuery(searchKey, searchFor, queryType, url, noInfo) {

  //TODO: refactor to handle other reqs from weather, events, etc
  // TODO: locationname might not be what we expect
  return client.query(
    `SELECT * FROM ${queryType}
    WHERE ${searchKey} = $1`,
    [searchFor]
  ).then(sqlResult => {
    if (sqlResult.rowCount === 0){
      // not in database
      return noInfo(url, searchFor);
    } else {
      // in database
      return infoExists(sqlResult);
    }
  });
}

//send back all sql info for that row
//psql command is: SELECT * FROM locations WHERE search_query='INSERTLOCATIONNAME'
function infoExists(sqlResult) {
  if (sqlResult.rows.length === 1){
    return sqlResult.rows[0];
  } else {
    return sqlResult.rows;
  }
}

//TODO add similar functions for events, yelp, etc
function noLocation(url, locationName) {

  return superagent.get(url)
    .then (result =>{
      let location = new UserLocation(locationName, result.body.results[0].formatted_address, result.body.results[0].geometry.location.lat, result.body.results[0].geometry.location.lng);

      client.query(
        `
        INSERT INTO locations (
          search_query,
          formatted_query,
          latitude,
          longitude
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [location.search_query, location.formatted_query, location.latitude, location.longitude]
      )
    })
    .then(sqlResult => {
      return sqlResult.rows[0];
    })
}

// Location Object constructor
function UserLocation(locationName, query, lat, lng) {
  this.search_query = locationName;
  this.formatted_query = query;
  this.latitude = lat;
  this.longitude = lng;
}

// searches DB for weather information returns a new object
// pass in data to use for look up
function searchWeather(request, response) {
  const lat = request.query.data.latitude;
  const long = request.query.data.longitude;
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${lat},${long}`;

  const locationID = request.query.data.id;
  // database of information
  dbQuery('location_id', locationID, 'weathers', url, noWeather)
    .then(weatherData => {
      response.send(weatherData);
    })
    .catch(e => {
      responseError(e);
    });
}

function noWeather(url, searchFor) {

  return superagent.get(url)
    .then (result =>{
      let dailyForecast = result.body.daily.data.map(day => {
        let daysWeather = new Weather(day);

        client.query(
          `INSERT INTO weathers (
            forecast,
            time,
            location_id) 
            VALUES ($1, $2, $3)`,
          [daysWeather.forecast, daysWeather.time, searchFor]
        );

        return daysWeather;
      });
      return dailyForecast;
    });
}

// Weather Object constructor
function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toDateString();
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
  console.error(error);
  return error;
}

