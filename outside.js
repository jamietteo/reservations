const admin = require('firebase-admin');
const db = admin.firestore();

const reserveArrayNames = [];
const cancelArrayNames = [];
const cancelArrayDates = [];
const minutes = 30;

module.exports.checkFirestore = async () => {
  const reservations = this.getReservations();
  return reservations;
};

module.exports.initialize = async (spotsTypes, response) => {
  spotsTypes.forEach(async (spotType) => {
    await db.collection('Porto').doc(spotType).set({
      spots: 0,
      reservations: []
    });
  });
  await db.collection('TimeoutReservations').doc('Garage').set({
    timeoutReservations: []
  });
  response.status(200).send('Values initialized');
};

module.exports.reserveSpot = async (spotType, response, maxSpot, request) => {
  const collectionRef = db.collection('Porto').doc(spotType);
  const doc = await collectionRef.get();
  const reservations = Object.values(doc.data())[0];
  const value = Object.values(doc.data())[1];

  const dateBody = request.body.date;
  const nameBody = request.body.name;
  const end_reservation = new Date(new Date(dateBody).getTime() + minutes * 60000).toISOString();

  if (dateBody < new Date().toISOString()) return response.status(422).send(`Date can't be in the past`);
  if (/\d/.test(nameBody)) return response.status(422).send('Invalid name! (name must have only letters)');
  if (dateBody == '') return response.status(422).send('Date cannot be empty');
  if (nameBody == '') return response.status(422).send('Name cannot be empty');

  reservations.forEach(async (reservation) => {
    (reservation.name == nameBody)
      ? reserveArrayNames.push(reservation.name)
      : 0;
  });

  if (dateBody == undefined || nameBody == undefined || Number.isFinite(dateBody) || Number.isFinite(nameBody)) {
    return response.status(422).send('Invalid request');
  }
  if (!reserveArrayNames.includes(nameBody) && maxSpot > value) {
    await db.collection('Porto').doc(spotType).update({
      spots: admin.firestore.FieldValue.increment(1),
      reservations: admin.firestore.FieldValue.arrayUnion(
        {
          date: dateBody,
          name: nameBody
        }
      )
    })
    db.collection('TimeoutReservations').doc('Garage').update({
      timeoutReservations: admin.firestore.FieldValue.arrayUnion(
        {
          start_reservation: dateBody,
          end_reservation: end_reservation,
          name: nameBody,
        }
      )
    });
  }
  else {
    return response.status(200).send('Max spots reached');
  }
  return response.status(200).send('Reservation successful');
};

module.exports.cancelSpot = async (spotType, date, name, response, request) => {
  const collectionRef = db.collection('Porto').doc(spotType);
  const doc = await collectionRef.get();
  const reservations = Object.values(doc.data())[0];
  const value = Object.values(doc.data())[1];

  const dateBody = date || request.body.date;
  const nameBody = name || request.body.name;
  const end_reservation = new Date(new Date(dateBody).getTime() + minutes * 60000).toISOString();

  if (/\d/.test(nameBody)) return response.status(422).send('Invalid name! (name must have only letters)');
  if (dateBody == '') return response.status(422).send('Date cannot be empty');
  if (nameBody == '') return response.status(422).send('Name cannot be empty');

  reservations.forEach(async (reservation) => {
    (reservation.name == nameBody)
      ? cancelArrayNames.push(reservation.name) && cancelArrayDates.push(reservation.date)
      : 0;
  });

  if (!cancelArrayDates.includes(dateBody) || !cancelArrayNames.includes(nameBody)) {
    return response.status(404).send('Not found');
  }
  else {
    if (dateBody == undefined || nameBody == undefined || Number.isFinite(dateBody) || Number.isFinite(nameBody)) {
      return response.status(422).send('Invalid request');
    }
    else {
      if (value != 0) {
        await db.collection('Porto').doc(spotType).update({
          spots: admin.firestore.FieldValue.increment(-1),
          reservations: admin.firestore.FieldValue.arrayRemove(
            {
              date: dateBody,
              name: nameBody
            }
          )
        })
        db.collection('TimeoutReservations').doc('Garage').update({
          timeoutReservations: admin.firestore.FieldValue.arrayRemove(
            {
              start_reservation: dateBody,
              end_reservation: end_reservation,
              name: nameBody,
            }
          )
        });
      }
      else {
        return response.status(200).send('No reservations to cancel');
      }
    }
  }
  return response.status(200).send('Reservation canceled');
};

module.exports.renewReservation = async (response, request, spotType) => {
  const nameBody = request.body.name;
  const userRef = db.collection("Porto").doc(spotType);
  const userDoc = await userRef.get()
  const names = Object.values(userDoc.data())[0].map(reservation => reservation.name);

  if (!names.includes(nameBody)) {
    return response.status(404).send('Name not found');
  }

  const date = userDoc.data().reservations.find(reservation => reservation.name == nameBody).date;
  if (nameBody == '') return response.status(422).send('Name cannot be empty');
  if (/\d/.test(nameBody)) return response.status(422).send('Invalid name! (name must have only letters)');

  else {
    db.collection('TimeoutReservations').doc('Garage').update({
      timeoutReservations: admin.firestore.FieldValue.arrayRemove(
        {
          start_reservation: date,
          end_reservation: new Date(new Date(date).getTime() + minutes * 60000).toISOString(),
          name: nameBody,
        }
      )
    })
    db.collection('TimeoutReservations').doc('Garage').update({
      timeoutReservations: admin.firestore.FieldValue.arrayUnion(
        {
          start_reservation: new Date(new Date(date).getTime() + minutes * 60000).toISOString(),
          end_reservation: new Date(new Date(date).getTime() + minutes * 2 * 60000).toISOString(),
          name: nameBody,
        }
      )
    });
    return response.status(200).send('Reservation renewed');
  }
};

module.exports.getReservations = async () => {
  const collectionRef = await db.collection('Porto').get();
  return collectionRef.docs.reduce((acc, doc) => {
    acc[doc.id] = doc.data();
    return acc;
  }, {});
};

const removeTimeoutReservations = async () => {
  const timeoutRef = db.collection('TimeoutReservations').doc('Garage');
  const docTimeout = await timeoutRef.get();
  const data = Object.values(docTimeout.data())[0];

  // TODO: Need to remove data from collection Porto.doc(spotType) as well
  // this only removes the data from the TimeoutReservation collection
  data.forEach(async (reservation) => {
    while (new Date(reservation.end_reservation).toISOString() < new Date(Date.now()).toISOString()) {
      await db.collection('TimeoutReservations').doc('Garage').update({
        timeoutReservations: admin.firestore.FieldValue.arrayRemove(
          {
            start_reservation: reservation.start_reservation,
            end_reservation: reservation.end_reservation,
            name: reservation.name,
          }
        )
      });
    };
  });
};

// TODO: find a better way to do this
setInterval(async () => {
  await removeTimeoutReservations();
}, 1000);