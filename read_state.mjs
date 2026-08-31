import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
    const docSnap = await getDoc(doc(db, 'appStates/main'));
    if (!docSnap.exists()) {
        console.log("No state found!");
        process.exit(0);
    }
    const state = docSnap.data();
    
    const user = state.users.find(u => u.fio && u.fio.includes("Петров"));
    console.log("User:", user?.fio, user?.id, user?.schoolId);
    
    const schoolId = user?.schoolId;
    console.log("All schedule keys in DB:", Object.keys(state.schedules || {}));
    
    const keysMatching10 = Object.keys(state.schedules || {}).filter(k => k.includes("10"));
    console.log("Found schedule keys matching '10':", keysMatching10);
    
    for (const key of keysMatching10) {
        console.log(`\nSchedule for ${key}:`);
        const sched = state.schedules[key];
        Object.values(sched).forEach(d => {
            console.log(d.date, d.lessons.map(l => l.lesson + (l.subgroups ? ` (sg: ${l.subgroups.map(sg => sg.subject).join(',')})` : '')));
        });
    }
    
    console.log("\nTeacher assignments:", state.teacherAssignments?.filter(ta => ta.teacherId === user?.id));
    console.log("\nQuarter settings for school:", JSON.stringify(state.schoolScheduleSettings?.[schoolId]?.quarterDefinitions, null, 2));
    
    process.exit(0);
}

run();
