import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
    const docRef = doc(db, 'appStates/main');
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;
    
    const state = docSnap.data();
    let modified = false;
    
    if (state.schedules) {
        for (const targetKey of Object.keys(state.schedules)) {
            const schedule = state.schedules[targetKey];
            for (const day of Object.values(schedule)) {
                if (day.lessons) {
                    for (const l of day.lessons) {
                        if (l.subgroups && Array.isArray(l.subgroups) && l.subgroups.length === 0) {
                            delete l.subgroups;
                            modified = true;
                        }
                    }
                }
            }
        }
    }
    
    if (modified) {
        await setDoc(docRef, state);
        console.log("DB updated: removed empty subgroups from schedules.");
    } else {
        console.log("No empty subgroups found.");
    }
    process.exit(0);
}
run();
