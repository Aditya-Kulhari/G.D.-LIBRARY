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

        // SORTING LOGIC: Sort by seat number in ascending order
        studentsArray.sort((a, b) => {
            return parseInt(a.seat) - parseInt(b.seat);
        });

        allStudentsGlobal = studentsArray;
        renderApp(allStudentsGlobal);
    });     
}

// RENDER SEATS
function renderSeats(students) {
    const grid = document.getElementById('seat-grid');
    grid.innerHTML = '';

    for (let i = 1; i <= TOTAL_SEATS; i++) {
        const studentInSeat = students.filter(s => s.seat == i);
        let status = 'available';

        if (studentInSeat.length === 2 || studentInSeat.some(s => s.shift === 'full')) {
            status = 'occupied';
        }  else if (studentInSeat.length === 1) {
            status = 'partial';
        }

        const div = document.createElement('div');
        div.className = `seat ${status}`;
        div.innerText = i;
        // NEW: Add click event logic
        div.onclick = () => {
            if (status === 'available') {
                // If seat is empty, automatically fill the Seat # input field in the form
                document.getElementById('seat-number').value = i;
                document.getElementById('name').focus(); // Move cursor to Name input
                alert(`Seat #${i} is empty. Selected for Registration form!`);
            } else {
                // If occupied, navigate to student information
                navigateToStudent(studentInSeat);
            }
        };
        grid.appendChild(div);
    }
}

// NEW FUNCTION: Directs to the student info in the ledger
    function navigateToStudent(matchingStudents) {
        if (!matchingStudents || matchingStudents.length === 0) return;

        let targetStudentId = matchingStudents[0].id;

        // If two half-day students share the seat, let the admin choose which one to view
        if (matchingStudents.length > 1) {
            let choices = matchingStudents.map((s, index) => `${index + 1}. ${s.name} (${s.shift} shift)`).join("\n");
            let choice = prompt(`This seat is shared by two students:\n\n${choices}\n\nEnter number 1 or 2 to view:`, "1");
            
            if (choice === "2" && matchingStudents[1]) {
                targetStudentId = matchingStudents[1].id;
            } else if (choice !== "1") {
                return; // User canceled or typed invalid input
            }
        }

        // Find the row element in the ledger table
        const studentRow = document.getElementById(`row-${targetStudentId}`);
        
        if (studentRow) {
            // Smoothly scroll the page down to the specific student row
            studentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Apply visual flash highlight
            studentRow.classList.remove('flash-row'); // Reset animation if clicked repeatedly
            void studentRow.offsetWidth; // Trigger a reflow to restart animation
            studentRow.classList.add('flash-row');
        } else {
            alert("Student record found, but could not locate row in ledger.");
        }
    }

// Avaliability Logic
function checkSeatAvailability(seatNum, newShift, existingStudents) {
    const studentsInSeat = existingStudents.filter(s => s.seat == seatNum);

    // if seat is empty , it's available
     if (studentsInSeat.length === 0)
        return {allowed: true };

    // if a fully day student is already there , nobody else can join 
     if (studentsInSeat.some(s => s.shift === 'full')) {
        return {allowed: false, message: "This seat is booked for full day."};
     }

    // if the new student wants Full Day , but someone is alredy there (half day)
     if (newShift === 'full' && studentsInSeat.length > 0) {
        return {allowed: false,
                message: "Seat partially occupied. Cannot book full day."
        };
     }
    
    // Checking half day overlapse
     const hasMorning = studentsInSeat.some(s => s.shift === 'morning');
     const hasEvening = studentsInSeat.some(s => s.shift === 'evening');

     if(newShift === 'morning' && hasMorning) {
        return {allowed: false,
                message: "Morning shift is already taken for this seat."
        };
     }

     if (newShift === 'evening' && hasEvening) {
        return {allowed: false,
                message: "Evening shift is already taken for this seat."
        };
     }

     //if there is a mix 
     return {allowed: true};
    
}

// Function to convert YYYY-MM-DD to DD-MM-YYYY
function formatDateDisplay(rawDate) {
    if (!rawDate) return "N/A";
    const parts = rawDate.split("-"); // Splits "2026-05-08" into ["2026", "05", "08"]
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // Returns "08-05-2026"
}

// Render Table
function renderTable(students) {
    const tbody = document.getElementById('student-data');
    tbody.innerHTML = '';
    
    students.forEach((s) => {
        const total = FEE_STRUCTURE[s.shift];
        const dues = total - s.paid;

        // Check if 1 month has passed
        const dueWarning = isFeeDue(s.admissionDate);
        
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
                                 
                    <button onclick="sendConfirmation('${s.phone}', '${s.name}', '${s.seat}', ${s.paid})" 
                     style="background:#28a745; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">
                        Send SMS
                    </button>

                     <button onclick="sendWhatsApp('${s.phone}', '${s.name}', '${s.seat}', ${s.paid})" 
                            style="background:#25D366; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">
                        WhatsApp
                    </button>
                    
                    <button onclick="deleteStudent('${s.id}')" style="background:red">Exit</button>
                </td>
            </tr>
        `;
    });
}
 // NEW FUNCTION: Directs the user to WhatsApp with a pre-filled message
function sendWhatsApp(phone, name, seat, paid) {
    // 1. Clean the phone number (Remove spaces, dashes, and ensure country code is attached)
    // WhatsApp API strictly requires the country code (e.g., 91 for India) without the '+' sign.
    let cleanPhone = phone.replace(/\D/g, ''); // Removes all non-numerical characters
    
    // If it's a 10-digit number (common in India), automatically prefix '91'
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
    }

    // 2. Create the text message
    const message = `Welcome to G.D. Library, ${name}! Your seat #${seat} is confirmed. Payment received: ₹${paid}. Thank you for joining us!`;

    // 3. Encode the message for URL structures
    const encodedMessage = encodeURIComponent(message);

    // 4. Open WhatsApp web/app in a new browser tab
    const whatsappURL = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappURL, '_blank');
}


// ADD STUDENT TO FIREBASE
document.getElementById('student-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const seatNum = document.getElementById('seat-number').value;
    const shift = document.getElementById('shift').value;
    
    // check if the seat can take this new student
    const check = checkSeatAvailability(seatNum, shift, allStudentsGlobal)

    if (!check.allowed) {
        alert(check.message);
        return;
    }

    const admissionDate = document.getElementById('admission-date').value;
    const name = document.getElementById('name').value;
    const course = document.getElementById('course').value;
    const phone = document.getElementById('phone').value
    const paid = parseInt(document.getElementById('paid').value);


    // Push to Firebase
    db.ref('students').push({
        name,
        admissionDate, 
        phone, 
        course, 
        shift, 
        paid, 
        seat: parseInt(seatNum) // Good practice to store seat as a number
    }).then(() => {
        alert("Student added successfully!");
        e.target.reset();
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

    // Validation: If Seat or Shift changed, check availability
    const otherStudents = allStudentsGlobal.filter(s => s.id !== studentId);
    const check = checkSeatAvailability(updatedData.seat, updatedData.shift, otherStudents);

    if (!check.allowed) {
        alert("Error: " + check.message);
        return; // Stop the save
    }

    db.ref(`students/${studentId}`).update(updatedData)
        .then(() => alert("Record Updated"))
        .catch(err => alert("Update Failed: " + err.message));
}

// Function to send the initial Seat Confirmation
function sendConfirmation(phone, name, seat, paid) {
    // 1. Create the text message
    const message = `Welcome to G.D. Library, ${name}! Your seat #${seat} is confirmed. Payment received: ₹${paid}. Thank you for joining us!`;

    // 2. Prepare the message for the web link (replaces spaces with special codes)
    const encodedMessage = encodeURIComponent(message);

    // 3. Open the phone's SMS app
    // Format: sms:+911234567890?body=YourMessage
    window.location.href = `sms:${phone}?body=${encodedMessage}`;
}
    // Function to check if the fee is due (1 month / 30 days passed)
function isFeeDue(admissionDate) {
    if (!admissionDate) return false;
    
    const admission = new Date(admissionDate);
    const today = new Date();
    
    // Calculate the difference in time
    const diffTime = Math.abs(today - admission);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    return diffDays >= 30; // Returns true if 30 or more days have passed
}
