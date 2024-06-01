import './style.css';

// import { getAuth } from "firebase/auth"
import { getApps, initializeApp } from 'firebase/app';
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


if (!getApps.length) {
  initializeApp(firebaseConfig);
} 

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

// get user firebase id
// const auth = getAuth();
// const uid = auth.currentUser.uid;
const uid = "RJ0pPZEpmqPdiwMNBsuErIKU8zI3"; // hardcode my uid

// HTML elements
// const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
// const callButton = document.getElementById('callButton');
// const callInput = document.getElementById('callInput');
// const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
// const hangupButton = document.getElementById('hangupButton');

// 1. Setup media sources

// webcamButton.onclick = async () => {
localStream = await navigator.mediaDevices.getUserMedia({ video: true });
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

// callButton.disabled = false;
// answerButton.disabled = false;
// webcamButton.disabled = true;
// };

// 2. Create an offer
// callButton.onclick = async () => {
//   // Reference Firestore collections for signaling
//   // const callDoc = doc(collection(db,'calls'));
//   const callDoc = doc(collection(db,'users',`${uid}`,'calls'));

//   const offerCandidates = doc(collection(callDoc,'offerCandidates')); 

//   callInput.value = callDoc.id;

//   // Get candidates for caller, save to db
//   pc.onicecandidate = (event) => {
//     event.candidate && setDoc(offerCandidates, event.candidate.toJSON() );
//   };

//   // Create offer
//   const offerDescription = await pc.createOffer();
//   await pc.setLocalDescription(offerDescription);

//   const offer = {
//     sdp: offerDescription.sdp,
//     type: offerDescription.type,
//   };

//   await setDoc(callDoc,{ offer })

//   // Listen for remote answer
//   onSnapshot(callDoc, (snapshot) => {
//     const data = snapshot.data();
//     if (!pc.currentRemoteDescription && data?.answer) {
//       const answerDescription = new RTCSessionDescription(data.answer);
//       pc.setRemoteDescription(answerDescription);
//     }
//   });

//   // When answered, add candidate to peer connection
//   const answerQueries = query(collection(callDoc,'answerCandidates'));
//   onSnapshot(answerQueries, (snapshot) => {
//     snapshot.docChanges().forEach((change) => {
//       if (change.type === 'added') {
//         const candidate = new RTCIceCandidate(change.doc.data());
//         pc.addIceCandidate(candidate);
//       }
//     });
//   });

//   // hangupButton.disabled = false;
// };

// 3. Answer the call with the unique ID
// answerButton.onclick = async () => {
//   console.log(callInput.value);
//   const callId = callInput.value;

//   // const callDoc = doc(collection(db,'calls'), callId);
//   const callDoc = doc(collection(db,'users',`${uid}`,'calls'), callId);

//   const answerCandidates = doc(collection(callDoc,'answerCandidates'));

//   pc.onicecandidate = (event) => {
//     event.candidate && setDoc(answerCandidates,event.candidate.toJSON());
//   };

//   const callSnap = (await getDoc(callDoc));
//   const callData = callSnap.data();

//   const offerDescription = callData.offer;
//   await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

//   const answerDescription = await pc.createAnswer();
//   await pc.setLocalDescription(answerDescription);

//   const answer = {
//     type: answerDescription.type,
//     sdp: answerDescription.sdp,
//   };

//   await updateDoc(callDoc,{ answer });

//   const offerQueries = query(collection(callDoc,'offerCandidates'));
//   onSnapshot(offerQueries,(snapshot) => {
//     snapshot.docChanges().forEach((change) => {
//       console.log(change);
//       if (change.type === 'added') {
//         let data = change.doc.data();
//         pc.addIceCandidate(new RTCIceCandidate(data));
//       }
//     });
//   });
// };

////
async function answer(callKey) {
  const callId = callKey;

  // const callDoc = doc(collection(db,'calls'), callId);
  const callDoc = doc(collection(db,'users',`${uid}`,'calls'), callId);

  const answerCandidates = doc(collection(callDoc,'answerCandidates'));

  pc.onicecandidate = (event) => {
    event.candidate && setDoc(answerCandidates,event.candidate.toJSON());
  };

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

  await updateDoc(callDoc,{ answer });

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

const q = query(collection(db,'users',`${uid}`,'calls'));
onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type == "added") {
      console.log("added file: ", change.doc.id);
      setTimeout(function() {
        answer(change.doc.id);
      },1000); 
      // added delay since firebase sends event trigger before doc is actually added causing an error on this side
      // TODO: test delay times 500-1000 ms that still gives a reliable connection
    }
  })
});