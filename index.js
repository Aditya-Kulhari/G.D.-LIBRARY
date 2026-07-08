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
        const studentInSeat = students.filter(s => Number(s.seat) == i);
        let status = 'available';

        if (studentInSeat.length === 2 || studentInSeat.some(s => s.shift === 'full')) {
            status = 'occupied';
        }  else if (studentInSeat.length === 1) {
            status = 'partial';
        }
         
        const div = document.createElement('div');
        div.className = `seat ${status}`;
        
        // FIX: Force a fresh evaluation of the date string safely
        const hasDueStudent = studentInSeat.some(s => {
            if (!s.admissionDate) return false;
            return isFeeDue(s.admissionDate);
        });

        // Inject HTML based on alert status
        if (hasDueStudent) {
            div.innerHTML = `${i}<span class="badge-siren">🔔</span>`;
        } else {
            div.innerText = i;
        }

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
    
    // FIXED: Clean timezone-independent calculation
function isFeeDue(admissionDate) {
    if (!admissionDate) return false;
    
    // Split year, month, day directly to completely bypass standard timezone shifts
    const parts = admissionDate.split("-"); 
    if (parts.length !== 3) return false;

    const admission = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const today = new Date();
    
    // Strip time elements out so we compare pure dates
    admission.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    // Calculate precise millisecond-to-day conversion
    const diffTime = today.getTime() - admission.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    
    return diffDays >= 30; // Triggers if 30 or more days have elapsed
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
    tbody.innerHTML = `...`;
    
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

                        <select onchange="handleMessageSelection(this, 'sms', '${s.phone}', '${s.name}', '${s.seat}', ${s.paid}, ${dues})" 
                            style="background:#007bff; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-button: 2px; text-align-last: center;">
                        <option value="" disabled selected hidden>Send SMS</option>
                        <option value="admission" style="background: white; color: black;">🎉 Admission</option>
                        <option value="paid" style="background: white; color: black;">✅ Paid</option>
                        <option value="due" style="background: white; color: black;">⚠️ Due Notice</option>
                    </select>

                        <select onchange="handleMessageSelection(this, '${s.phone}', '${s.name}', '${s.seat}', ${s.paid}, ${dues})" 
                            style="background:#25D366; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-button: 2px; text-align-last: center;">
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

// Global Message Handler for both platforms
function handleMessageSelection(dropdown, platform, phone, name, seat, paid, dues) {
    const action = dropdown.value;
    if (!action) return;

    // Build template messages
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
        // Triggers the phone's default native SMS messenger application link
        window.location.href = `sms:${phone}?body=${encodedMessage}`;
    }

    dropdown.value = ""; // Reset label
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
