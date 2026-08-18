// Register Service Worker for PWA (App Icon installation)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Registered!', reg))
            .catch(err => console.log('Service Worker Registration Failed', err));
    });
}

// ... your existing Firebase Config and other code goes here ...

// YOUR FIREBASE CONFIGURATION (Paste from Firebase Console)
const firebaseConfig = {
    apiKey: "AIzaSyDFLA0gJ7HaA1d_1r4XM6yXvM3qjc4m4eI",
    authDomain: "gd-library-b19a6.firebaseapp.com",
    databaseURL: "https://gd-library-b19a6-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "gd-library-b19a6",
    storageBucket: "gd-library-b19a6.firebasestorage.app",
    messagingSenderId:"445035433405",
    appId: "1:445035433405:web:16cd4d272603d32a9a56d4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const FEE_STRUCTURE = { full: 800, morning: 600, evening: 600 };
const TOTAL_SEATS = 60;

// LOGIN LOGIC (Simulated Admin)
function login() {
    const pass = document.getElementById('admin-pass').value;
    if(pass === "9887706297") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        listenToData(); // Start syncing once logged in
    } else {
        alert("Wrong Password!");
    }
}
  
let allStudentsGlobal = [];

// SYNC DATA FROM FIREBASE
function listenToData() {
    // This "listens" for any change in the database and updates your screen automatically
    db.ref('students').on('value', (snapshot) => {
        const data = snapshot.val();

        // Convert object to array
        let studentsArray = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];

        // AUTO-RESET PAID AMOUNT WHEN PLAN EXPIRES (1 Month = 30 Days, 3 Months = 90 Days)
        studentsArray.forEach(student => {
            const planMonths = parseInt(student.plan) || 1;
            const targetDays = planMonths * 30;
            const daysActive = calculateDaysActive(student.admissionDate);

            // If active days reach/exceed the plan target and paid is greater than 0, reset paid to 0
            if (daysActive >= targetDays && student.paid > 0) {
                student.paid = 0; // Update local reference for instant UI rendering
                db.ref(`students/${student.id}`).update({ paid: 0 }); // Update Firebase database
            }
        });

        // SORTING LOGIC: Sort by seat number in ascending order
        studentsArray.sort((a, b) => {
            return parseInt(a.seat) - parseInt(b.seat);
        });

        allStudentsGlobal = studentsArray;
        renderApp(allStudentsGlobal);
        calculateDashboardMetrics();
    });      
}

// RENDER SEATS
function renderSeats(students) {
    const grid = document.getElementById('seat-grid');
    grid.innerHTML = '';

    for (let i = 1; i <= TOTAL_SEATS; i++) {
        const studentInSeat = students.filter(s => Number(s.seat) == i);
        let status = 'available';

        // Check occupancy rules
        if (studentInSeat.length === 2 || studentInSeat.some(s => s.shift === 'full')) {
            status = 'occupied'; // Red (Fully Booked)
        } else if (studentInSeat.length === 1) {
            status = 'partial'; // Orange (1 shift open)
        }
         
        const seatDiv = document.createElement('div'); 
        seatDiv.className = `seat ${status}`;
        seatDiv.setAttribute('id', `seat-node-${i}`);
        
        // Fee check for alarm icon
        const hasDueStudent = studentInSeat.some(s => {
            if (!s.admissionDate) return false;
            return isFeeDue(s.admissionDate, s.plan || 1);
        });

        if (hasDueStudent) {
            seatDiv.innerHTML = `${i}<span class="badge-siren">🔔</span>`;
        } else {
            seatDiv.innerText = i;
        }
        
        if (studentInSeat.length > 0) {
            const student = studentInSeat[0]; 
            const totalFee = getStudentFee(student.shift, student.plan || 1);
            const dues = totalFee - student.paid;
            const daysUsed = calculateDaysActive(student.admissionDate);
            
            if (daysUsed >= (student.plan || 1) * 30) {
                seatDiv.classList.add('expired-membership');
            }

            seatDiv.onclick = () => { 
                openStudentModal(i, student, dues, daysUsed);
            };
        } else {
            // Seat is completely open (Green)
            seatDiv.onclick = () => {
                document.getElementById('seat-number').value = i;
                toggleDrawer('reg-drawer');
                document.getElementById('name').focus();
            };
        }

        grid.appendChild(seatDiv);
    }
}         
    
function isFeeDue(admissionDate, planMonths = 1) {
    if (!admissionDate) return false;
    
    const parts = admissionDate.split("-"); 
    if (parts.length !== 3) return false;

    const admission = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const today = new Date();
    
    admission.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - admission.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    
    const targetDays = (parseInt(planMonths) || 1) * 30; // 30 days for 1 month, 90 days for 3 months
    return diffDays >= targetDays;
}

 // Directs to the student info in the ledger
function navigateToStudent(matchingStudents) {
    if (!matchingStudents || matchingStudents.length === 0) return;

    let targetStudentId = matchingStudents[0].id;

    if (matchingStudents.length > 1) {
        let choices = matchingStudents.map((s, index) => `${index + 1}. ${s.name} (${s.shift} shift)`).join("\n");
        let choice = prompt(`This seat is shared by two students:\n\n${choices}\n\nEnter number 1 or 2 to view:`, "1");
        
        if (choice === "2" && matchingStudents[1]) {
            targetStudentId = matchingStudents[1].id;
        } else if (choice !== "1") {
            return; 
        }
    }

    const studentRow = document.getElementById(`row-${targetStudentId}`);
    
    if (studentRow) {
        studentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        studentRow.classList.remove('flash-row'); 
        void studentRow.offsetWidth; // Force reflow
        studentRow.classList.add('flash-row');
    } else {
        alert("Student record found, but could not locate row in ledger.");
    }
}   

// Availability Logic
function checkSeatAvailability(seatNum, newShift, existingStudents) {
    const studentsInSeat = existingStudents.filter(s => s.seat == seatNum);

    if (studentsInSeat.length === 0) return { allowed: true };

    if (studentsInSeat.some(s => s.shift === 'full')) {
        return { allowed: false, message: "This seat is booked for full day." };
    }

    if (newShift === 'full' && studentsInSeat.length > 0) {
        return { allowed: false, message: "Seat partially occupied. Cannot book full day." };
    }
    
    const hasMorning = studentsInSeat.some(s => s.shift === 'morning');
    const hasEvening = studentsInSeat.some(s => s.shift === 'evening');

    if(newShift === 'morning' && hasMorning) {
        return { allowed: false, message: "Morning shift is already taken for this seat." };
    }

    if (newShift === 'evening' && hasEvening) {
        return { allowed: false, message: "Evening shift is already taken for this seat." };
    }

    return { allowed: true };
}

// Function to convert YYYY-MM-DD to DD-MM-YYYY
function formatDateDisplay(rawDate) {
    if (!rawDate) return "N/A";
    const parts = rawDate.split("-"); 
    return `${parts[2]}-${parts[1]}-${parts[0]}`; 
}

// Render Table Ledger
function renderTable(students) {
    const tbody = document.getElementById('student-data');
    tbody.innerHTML = ''; // Fixed the typo over-writing string layout here
    
    students.forEach((s) => {
        const planMonths = s.plan || 1;
        const total = getStudentFee(s.shift, planMonths); // Dynamic fee based on 1 vs 3 month plan
        const dues = total - s.paid;
        const dueWarning = isFeeDue(s.admissionDate, planMonths);
           
        
        tbody.innerHTML += `
            <tr id="row-${s.id}">
                <td class="editable" data-field="seat">${s.seat}</td>
                <td class="editable" data-field="admissionDate" style="color: ${dueWarning ? 'red' : 'black'}; font-weight: ${dueWarning ? 'bold' : 'normal'}">
                    ${s.admissionDate} ${dueWarning ? '<br><small>⚠️ MONTH ENDED</small>' : ''}
                </td>
                <td class="editable" data-field="name">${s.name}</td>
                <td class="editable" data-field="course">${s.course}</td>
                <td class="editable" data-field="phone">${s.phone}</td>
                <td class="editable" data-field="shift">${s.shift}</td>
                <td>₹${total}</td>
                <td class="editable" data-field="paid">${s.paid}</td>
                <td style="color: ${dues > 0 ? 'red' : 'green'}">₹${dues}</td>
                <td>
                    <button class="edit-btn" onclick="toggleEdit('${s.id}')">Edit</button>

                    <select onchange="handleMessageSelection(this, 'sms', '${s.phone}', '${s.name}', '${s.seat}', ${s.paid}, ${dues})" 
                        style="background:#007bff; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; text-align-last: center;">
                        <option value="" disabled selected hidden>Send SMS</option>
                        <option value="admission" style="background: white; color: black;">🎉 Admission</option>
                        <option value="paid" style="background: white; color: black;">✅ Paid</option>
                        <option value="due" style="background: white; color: black;">⚠️ Due Notice</option>
                    </select>

                    <select onchange="handleMessageSelection(this, 'whatsapp', '${s.phone}', '${s.name}', '${s.seat}', ${s.paid}, ${dues})" 
                        style="background:#25D366; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; text-align-last: center;">
                        <option value="" disabled selected hidden>WhatsApp</option>
                        <option value="admission" style="background: white; color: black;">🎉 Admission</option>
                        <option value="paid" style="background: white; color: black;">✅ Paid</option>
                        <option value="due" style="background: white; color: black;">⚠️ Due Notice</option>
                    </select>

                    <button onclick="deleteStudent('${s.id}')" style="background:red">Exit</button>   
                </td>
            </tr>
        `;
    });
}

// Global Message Handler
function handleMessageSelection(dropdown, platform, phone, name, seat, paid, dues) {
    const action = dropdown.value;
    if (!action) return;

    let message = "";
    if (action === 'admission') {
        message = `Welcome to G.D. Library, ${name}!\n\nYour admission is confirmed on Seat #${seat}.\nPayment received: ₹${paid}.\n\nThank you for joining us! 📚\n- G.D. Library`;
    } else if (action === 'paid') {
        message = `Hello ${name},\n\nYour library fee of ₹${paid} for Seat #${seat} has been successfully received. Thank you!\n- G.D. Library`;
    } else if (action === 'due') {
        if (dues <= 0) {
            alert("This student has no outstanding dues!");
            dropdown.value = "";
            return;
        }
        message = `Dear ${name},\n\nThis is a reminder that your monthly fee for Seat #${seat} is due. Pending Amount: ₹${dues}.\n\nPlease clear it soon.\nThank you,\nG.D. Library`;
    }

    const encodedMessage = encodeURIComponent(message);

    if (platform === 'whatsapp') {
        let cleanPhone = phone.replace(/\D/g, ''); 
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
    } else if (platform === 'sms') {
        window.location.href = `sms:${phone}?body=${encodedMessage}`;
    }

    dropdown.value = ""; 
}

// ADD STUDENT TO FIREBASE
document.getElementById('student-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const seatNum = document.getElementById('seat-number').value;
    const shift = document.getElementById('shift').value;
    
    const check = checkSeatAvailability(seatNum, shift, allStudentsGlobal);

    if (!check.allowed) {
        alert(check.message);
        return;
    }

    const admissionDate = document.getElementById('admission-date').value;
    const name = document.getElementById('name').value;
    const course = document.getElementById('course').value;
    const phone = document.getElementById('phone').value;
    const paid = parseInt(document.getElementById('paid').value);
    const plan = parseInt(document.getElementById('plan')?.value || 1); // Get Plan duration (1 or 3)

    db.ref('students').push({
        name,
        admissionDate, 
        phone, 
        course, 
        shift, 
        plan, // Saved plan months (1 or 3)
        paid, 
        seat: parseInt(seatNum) 
    }).then(() => {
        alert("Student added successfully!");
        e.target.reset();
        toggleDrawer('reg-drawer');
    }).catch((error) => {
        console.error("Firebase Error:", error);
    });
});

// DELETE FROM FIREBASE
function deleteStudent(studentId) {
    if(confirm("Confirm Student Exit?")) {
        db.ref(`students/${studentId}`).remove();
    }
}

// VACANT SEAT ON MOBILE POPUP MODAL
function removeStudent(seatNum) {
    const targetStudents = allStudentsGlobal.filter(s => s.seat == seatNum);
    if(targetStudents.length > 0) {
        if(confirm(`Vacant all student assignments on seat #${seatNum}?`)) {
            targetStudents.forEach(st => {
                db.ref(`students/${st.id}`).remove();
            });
        }
    }
}

function renderApp(students) {
    renderSeats(students);
    renderTable(students);
}

function toggleEdit(studentId) {
    const row = document.getElementById(`row-${studentId}`);
    const editBtn = row.querySelector('.edit-btn');
    const isEditing = editBtn.innerText === "Save";

    if (!isEditing) {
        row.querySelectorAll('.editable').forEach(cell => {
            const field = cell.getAttribute('data-field');
            const val = cell.innerText;

            if (field === 'shift') {
                cell.innerHTML = `
                    <select>
                        <option value="full" ${val === 'full' ? 'selected' : ''}>Full</option>
                        <option value="morning" ${val === 'morning' ? 'selected' : ''}>Morning</option>
                        <option value="evening" ${val === 'evening' ? 'selected' : ''}>Evening</option>
                    </select>`;
            } else if (field === 'admissionDate') {
                cell.innerHTML = `<input type="date" value="${val}">`;
            } else {
                const type = (field === 'seat' || field === 'paid') ? 'number' : 'text';
                cell.innerHTML = `<input type="${type}" value="${val}" style="width:90%">`;
            }
        });
        editBtn.innerText = "Save";
        editBtn.style.background = "#28a745";
    } else {
        saveFullEdit(studentId, row);
    }
}

function saveFullEdit(studentId, row) {
    const updatedData = {};
    row.querySelectorAll('.editable').forEach(cell => {
        const field = cell.getAttribute('data-field');
        const input = cell.querySelector('input, select');
        updatedData[field] = (field === 'seat' || field === 'paid') ? parseInt(input.value) : input.value;
    });

    const otherStudents = allStudentsGlobal.filter(s => s.id !== studentId);
    const check = checkSeatAvailability(updatedData.seat, updatedData.shift, otherStudents);

    if (!check.allowed) {
        alert("Error: " + check.message);
        return; 
    }

    db.ref(`students/${studentId}`).update(updatedData)
        .then(() => alert("Record Updated"))
        .catch(err => alert("Update Failed: " + err.message));
}

function toggleDrawer(drawerId) {
    document.getElementById(drawerId).classList.toggle('open-drawer');
}

function filterExpiredMemberships() {
    let expiredSeatsList = [];
    
    allStudentsGlobal.forEach(student => {
        const days = calculateDaysActive(student.admissionDate);
        if (days >= 30) {
            expiredSeatsList.push(student.seat);
        }
    });

    if (expiredSeatsList.length === 0) {
        alert("Excellent! No students have crossed their 30-day membership cycle.");
        return;
    }

    alert(`Found ${expiredSeatsList.length} expired seats: ${expiredSeatsList.join(', ')}. Red seats will blink.`);
    
    expiredSeatsList.forEach(seatNum => {
        const element = document.getElementById(`seat-node-${seatNum}`);
        if(element) {
            element.style.transform = "scale(1.25)";
            setTimeout(() => { element.style.transform = "scale(1)"; }, 1500);
        }
    });
}

function calculateDaysActive(admissionDateString) {
    if(!admissionDateString) return 0;
    const admission = new Date(admissionDateString);
    const today = new Date();
    const timeDiff = today.getTime() - admission.getTime();
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24)); 
}


function calculateDashboardMetrics() {
    let fullCount = 0, morningCount = 0, eveningCount = 0, expiredCount = 0;
    
    // 1. Calculate Active Shifts and Expired Memberships
    allStudentsGlobal.forEach(student => {
        if (student.shift === 'full') fullCount++;
        if (student.shift === 'morning') morningCount++;
        if (student.shift === 'evening') eveningCount++;
        
        const targetDays = (student.plan || 1) * 30;
        if (calculateDaysActive(student.admissionDate) >= targetDays) {
            expiredCount++;
        }
    });

    // 2. Calculate Total Active Students
    const totalStudents = allStudentsGlobal.length;

    // 3. Calculate Available Seats Per Shift Category
    let fullAvailable = 0;
    let morningAvailable = 0;
    let eveningAvailable = 0;

    for (let i = 1; i <= TOTAL_SEATS; i++) {
        const studentsInSeat = allStudentsGlobal.filter(s => Number(s.seat) === i);
        
        const hasFull = studentsInSeat.some(s => s.shift === 'full');
        const hasMorning = studentsInSeat.some(s => s.shift === 'morning');
        const hasEvening = studentsInSeat.some(s => s.shift === 'evening');

        // Full day available only if seat is 100% empty
        if (studentsInSeat.length === 0) {
            fullAvailable++;
        }

        // Morning available if seat is empty OR only occupied by evening shift
        if (!hasFull && !hasMorning) {
            morningAvailable++;
        }

        // Evening available if seat is empty OR only occupied by morning shift
        if (!hasFull && !hasEvening) {
            eveningAvailable++;
        }
    }

    // 4. Update Dashboard Stats in UI
    const totalStudentsElem = document.getElementById('stat-total-students');
    if (totalStudentsElem) {
        totalStudentsElem.innerText = totalStudents;
    }

    document.getElementById('count-full').innerText = fullCount;
    document.getElementById('count-morning').innerText = morningCount;
    document.getElementById('count-evening').innerText = eveningCount;
    document.getElementById('stat-expired-count').innerText = `${expiredCount} Seats`;

    if (document.getElementById('stat-available-full')) {
        document.getElementById('stat-available-full').innerText = fullAvailable;
    }
    if (document.getElementById('stat-available-morning')) {
        document.getElementById('stat-available-morning').innerText = morningAvailable;
    }
    if (document.getElementById('stat-available-evening')) {
        document.getElementById('stat-available-evening').innerText = eveningAvailable;
    }
}

function openStudentModal(seatNum, student, dues, daysUsed) {
    document.getElementById('modal-seat-title').innerText = `Seat #${seatNum} Details`;
    document.getElementById('modal-name').innerText = student.name;
    document.getElementById('modal-course').innerText = student.course;
    document.getElementById('modal-phone').innerText = student.phone;
    document.getElementById('modal-shift').innerText = student.shift.toUpperCase();
    document.getElementById('modal-days').innerText = `${daysUsed} Days Active`;
    
    const duesBox = document.getElementById('modal-dues');
    duesBox.innerText = dues > 0 ? `Pending ₹${dues}` : "Fully Paid 👍";
    duesBox.className = dues > 0 ? "text-danger" : "text-success";

    document.getElementById('modal-msg-btn').onclick = () => {
        let txt = `Hello ${student.name}, reminder from G.D. Library regarding Seat #${seatNum}.\n\n`;
        txt += daysUsed >= 30 ? `Your 30-day membership cycle has completed (${daysUsed} days active).\n` : '';
        txt += dues > 0 ? `Outstanding payment due balance: ₹${dues}. Please clear it soon.` : 'Your dues are clear. Thank you.';
        
        window.open(`https://wa.me/${student.phone.replace(/\D/g, '')}?text=${encodeURIComponent(txt)}`, '_blank');
    };

    document.getElementById('modal-vacant-btn').onclick = () => { 
        closeStudentModal(); 
        removeStudent(seatNum); 
    };
    
    document.getElementById('student-modal').style.display = 'flex';
}

function closeStudentModal() { 
    document.getElementById('student-modal').style.display = 'none'; 
}

// Calculate fee dynamically based on shift and plan duration
function getStudentFee(shift, planMonths) {
    const months = parseInt(planMonths) || 1;
    if (months === 3) {
        return shift === 'full' ? 2400 : 1500;
    }
    return FEE_STRUCTURE[shift] || 0;
}
