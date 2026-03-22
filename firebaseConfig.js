const admin = require('firebase-admin');
const serviceAccount = require('./firebase-adminsdk.json'); // the file the user just added

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = admin;
