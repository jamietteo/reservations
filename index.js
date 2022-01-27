const functions = require("firebase-functions");
const admin = require('firebase-admin');
const key = require("/home/rastrinak/Downloads/newoffice-a6c87-firebase-adminsdk-j8rbu-2af03d5e5b.json");
const config = require('./config.json');
require('dotenv').config();

admin.initializeApp({
  credential: admin.credential.cert(key)
});

const outside = require('./outside')
const spotsTypes = [
  config.spotTypes.Eletric, // Eletric
  config.spotTypes.Moto, // Moto
  config.spotTypes.Normal // Normal
];

const maxSpots = {
  Eletric: config.maxSpots.Eletric,
  Moto: config.maxSpots.Moto,
  Normal: config.maxSpots.Normal
}

// TODO: add verification of authorised users
// only authorised users can use this functions
// external users can't use this api
exports.initializeValues = functions.https.onRequest(async (request, response) => {
  const docExists = await outside.checkFirestore();

  (request.get('token') === process.env.TOKEN)
    ? (Object.keys(docExists).length != 0)
      ? response.status(200).send('Values already initialized')
      : outside.initialize(spotsTypes, response)
    : response.status(403).send('Forbidden');
});

exports.addReservation = functions.https.onRequest(async (request, response) => {
  const docExists = outside.checkFirestore();
  const spotType = request.get('spotType');

  (Object.keys(docExists).length == 0)
    ? (spotsTypes.includes(spotType))
      ? outside.reserveSpot(spotType, response, maxSpots[spotType], request)
      : response.status(400).send('Invalid spot type')
    : response.status(400).send('Firestore not initialized');
});

exports.cancelReservation = functions.https.onRequest(async (request, response) => {
  const docExists = outside.checkFirestore();
  const spotType = request.get('spotType');

  (Object.keys(docExists).length == 0)
    ? (spotsTypes.includes(spotType))
      ? outside.cancelSpot(spotType, null, null, response, request)
      : response.status(400).send('Invalid spot type')
    : response.status(400).send('Firestore not initialized')
});

exports.renewReservation = functions.https.onRequest(async (request, response) => {
  const docExists = outside.checkFirestore();
  const spotType = request.get('spotType');

  (Object.keys(docExists).length == 0)
    ? (spotsTypes.includes(spotType))
      ? outside.renewReservation(response, request, spotType)
      : response.status(400).send('Invalid spot type')
    : response.status(400).send('Firestore not initialized')
});

exports.getReservations = functions.https.onRequest(async (request, response) => {
  const docExists = outside.checkFirestore();

  (Object.keys(docExists).length == 0)
    ? response.status(200).send(await outside.getReservations())
    : response.status(400).send('Firestore not initialized');
});

exports.getConfig = functions.https.onRequest(async (request, response) => {
  const docExists = outside.checkFirestore();

  (Object.keys(docExists).length == 0)
    ? response.status(200).send(config)
    : response.status(400).send('Firestore not initialized');
});