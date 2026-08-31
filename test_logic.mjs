import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
    const docSnap = await getDoc(doc(db, 'appStates/main'));
    const state = docSnap.data();
    
    const user = state.users.find(u => u.fio.includes("Петров"));
    const cls = "10_А";
    const subj = "физика";
    const quarter = "Q1";
    
    // Simulate getSchoolClassSchedule
    const schoolId = user.schoolId;
    const scheduleSettings = state.scheduleSettings;
    
    const targetKey = `${schoolId}__${cls}`;
    const schedule = state.schedules[targetKey];
    
    const def = scheduleSettings.quarterDefinitions?.[quarter];
    const qStart = def?.start ? def.start : '0000-00-00';
    const qEnd = def?.end ? def.end : '9999-99-99';
    
    console.log("qStart:", qStart, "qEnd:", qEnd);
    
    const validDates = new Set();
    Object.values(schedule).forEach(d => {
        const inRange = d.date >= qStart && d.date <= qEnd;
        const hasSubject = d.lessons.some(l => {
            if (l.subgroups && l.subgroups.length > 0) {
                // Wait! Does it have subgroups array but empty? Let's check logic:
                // if (l.subgroups) ... Wait! If l.subgroups is true (e.g. empty array), it will return `l.subgroups.some(...)` which is false, 
                // AND IT WILL SKIP `return l.lesson === subj;` !!
                return l.subgroups.some(sg => sg.subject === subj);
            }
            return l.lesson === subj;
        });
        console.log(`Date: ${d.date}, inRange: ${inRange}, hasSubject: ${hasSubject}, lessons: ${JSON.stringify(d.lessons)}`);
        if (inRange && hasSubject) {
            validDates.add(d.date);
        }
    });
    
    console.log("validDates:", Array.from(validDates));
    process.exit(0);
}
run();
