# Test Accounts

All accounts share the same password: **`password123`**

---

## Admin Accounts

| Name | Phone | Password | Society |
|------|-------|----------|---------|
| Zara Ahmed | +92300000001 | password123 | ParkView City Islamabad |
| Hassan Khan | +92300000002 | password123 | ParkView City Lahore |

Admin login: http://localhost:5173

---

## Resident Accounts

All residents are in **ParkView City Islamabad**.

| Name | Phone | Password |
|------|-------|----------|
| Aisha Malik | +92311111001 | password123 |
| Bilal Qureshi | +92311111002 | password123 |
| Sara Riaz | +92311111003 | password123 |
| Omar Farooq | +92311111004 | password123 |
| Hina Shah | +92311111005 | password123 |
| Kamran Iqbal | +92311111006 | password123 |

---

## Professional Accounts

All professionals are in **ParkView City Islamabad** and **verified**.

| Name | Phone | Password | Skills | Rating |
|------|-------|----------|--------|--------|
| Asif Mehmood | +92322222001 | password123 | Plumbing | 4.8 ⭐ |
| Tariq Hussain | +92322222002 | password123 | Electrical | 4.7 ⭐ |
| Naveed Baig | +92322222003 | password123 | Gardening | 4.5 ⭐ |
| Raza Ali | +92322222004 | password123 | Sanitary/Cleaning | 4.9 ⭐ |
| Imran Sheikh | +92322222005 | password123 | Carpentry | 4.6 ⭐ |
| Khalid Rehman | +92322222006 | password123 | Painting | 4.4 ⭐ |
| Adeel Chaudhry | +92322222007 | password123 | AC Service, Electrical | 4.7 ⭐ |
| Faisal Nawaz | +92322222008 | password123 | Pest Control, Cleaning | 3.8 ⭐ |

---

## Seeded Bookings

The database starts with four bookings to demonstrate the booking lifecycle:

| ID | Resident | Professional | Service | Status |
|----|----------|-------------|---------|--------|
| bkg_1 | Aisha Malik | — | Plumbing | pending_quote |
| bkg_2 | Bilal Qureshi | Tariq Hussain | Electrical | quoted |
| bkg_3 | Sara Riaz | Raza Ali | Cleaning | in_progress |
| bkg_4 | Omar Farooq | Naveed Baig | Gardening | completed ✓ |

Booking `bkg_4` also has a 5-star review from Omar Farooq.
