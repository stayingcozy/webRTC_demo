import './style.css';

// import firebase from 'firebase/app';
import { getApps, initializeApp } from 'firebase/app';

// import 'firebase/firestore'
import { getFirestore, collection, doc, onSnapshot, setDoc, getDoc, updateDoc, query } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// webrtc-firebase
const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
  measurementId: process.env.MEASUREMENT_ID
};

// if (!firebase.apps.length) {
//   firebase.initializeApp(firebaseConfig);
// }
if (!getApps.length) {
  initializeApp(firebaseConfig);
} 

// const firestore = firebase.firestore();
export const db = getFirestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

// 1. Setup media sources

webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
};

// 2. Create an offer
callButton.onclick = async () => {
  // Reference Firestore collections for signaling

  // const callDoc = firestore.collection('calls').doc();
  const callDoc = doc(collection(db,'calls'));

  // const offerCandidates = callDoc.collection('offerCandidates');
  // const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = doc(collection(callDoc,'offerCandidates')); 
  // const answerCandidates = doc(collection(callDoc,'answerCandidates'));

  callInput.value = callDoc.id;

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    // event.candidate && offerCandidates.add(event.candidate.toJSON());
    event.candidate && setDoc(offerCandidates, event.candidate.toJSON() );
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  // await callDoc.set({ offer });
  await setDoc(callDoc,{ offer })

  // Listen for remote answer
  // callDoc.onSnapshot((snapshot) => {
  //   const data = snapshot.data();
  //   if (!pc.currentRemoteDescription && data?.answer) {
  //     const answerDescription = new RTCSessionDescription(data.answer);
  //     pc.setRemoteDescription(answerDescription);
  //   }
  // });
  onSnapshot(callDoc, (snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  

  // When answered, add candidate to peer connection
  // answerCandidates.onSnapshot((snapshot) => {
  //   snapshot.docChanges().forEach((change) => {
  //     if (change.type === 'added') {
  //       const candidate = new RTCIceCandidate(change.doc.data());
  //       pc.addIceCandidate(candidate);
  //     }
  //   });
  // });
  const answerQueries = query(collection(callDoc,'answerCandidates'));
  onSnapshot(answerQueries, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
answerButton.onclick = async () => {
  const callId = callInput.value;

  // const callDoc = firestore.collection('calls').doc(callId);
  const callDoc = doc(collection(db,'calls'), callId);

  // const answerCandidates = callDoc.collection('answerCandidates');
  // const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = doc(collection(callDoc,'answerCandidates'));
  // const offerCandidates = doc(collection(callDoc,'offerCandidates'));

  pc.onicecandidate = (event) => {
    // event.candidate && answerCandidates.add(event.candidate.toJSON());
    event.candidate && setDoc(answerCandidates,event.candidate.toJSON());
  };

  // const callData = (await callDoc.get()).data();
  const callSnap = (await getDoc(callDoc));
  const callData = callSnap.data();


  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  // await callDoc.update({ answer });
  await updateDoc(callDoc,{ answer });


  // offerCandidates.onSnapshot((snapshot) => {
  //   snapshot.docChanges().forEach((change) => {
  //     console.log(change);
  //     if (change.type === 'added') {
  //       let data = change.doc.data();
  //       pc.addIceCandidate(new RTCIceCandidate(data));
  //     }
  //   });
  // });
  const offerQueries = query(collection(callDoc,'offerCandidates'));
  onSnapshot(offerQueries,(snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};