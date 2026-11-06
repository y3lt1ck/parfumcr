// firebase-config.js

// configuracion de firebase
const firebaseConfig = {
    apiKey: "AIzaSyC8QV6QxAOqrr7eZm2FJqs2M22rBUi7A7k",
    authDomain: "parfumcr-a89e3.firebaseapp.com",
    projectId: "parfumcr-a89e3",
    storageBucket: "parfumcr-a89e3.firebasestorage.app",
    messagingSenderId: "758665062420",
    appId: "1:758665062420:web:3e132d3132c2c1756e9f01"
};

// 2. Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();