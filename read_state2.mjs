import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
    const docSnap = await getDoc(doc(db, 'appStates/main'));
    const state = docSnap.data();
    console.log("Global schedule settings:", JSON.stringify(state.scheduleSettings, null, 2));
    const school = state.schools?.find(s => s.id === 'school_1');
    console.log("School schedule settings:", JSON.stringify(school?.scheduleSettings, null, 2));
    
    // Also, we noticed `10_А` (cyrillic А) in schedules.
    // What is in `teacherAssignments`?
    // classId: '10_А' (is it cyrillic or latin?)
    // Let's check char codes
    const c1 = Object.keys(state.schedules).find(k => k.includes("10_"));
    const c2 = state.teacherAssignments.find(ta => ta.classId.includes("10_"))?.classId;
    console.log("Schedule class:", c1, c1.split('').map(c=>c.charCodeAt(0)));
    console.log("Assignment class:", c2, c2.split('').map(c=>c.charCodeAt(0)));
    
    // Check school classes:
    const sc = state.classes?.find(c => c.class === '10');
    console.log("School class definitions:", JSON.stringify(sc));
    
    process.exit(0);
}
run();
