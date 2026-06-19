#!/usr/bin/env bash
# Full API smoke test for Parkview Home Services
BASE="http://localhost:3001/api"
pass=0; fail=0

c() {
  local label="$1" expected="$2" actual="$3"
  if echo "$actual" | grep -qF "$expected"; then
    echo "  PASS  $label"
    ((pass++))
  else
    echo "  FAIL  $label"
    echo "        expected : $expected"
    echo "        got      : $(echo "$actual" | cut -c1-250)"
    ((fail++))
  fi
}

tok() {
  # extract data.token from JSON on stdin
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.token)}catch(e){console.log('')}})"
}
fld() {
  local f="$1"
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data.$f)}catch(e){console.log('')}})"
}

echo "━━━ 1. HEALTH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
R=$(curl -sf $BASE/health 2>/dev/null || curl -s $BASE/health)
c "GET /health → success:true"   '"success":true' "$R"
c "GET /health → status ok"      '"status":"ok"'  "$R"

echo ""
echo "━━━ 2. AUTH — register ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Use timestamp suffix so phones are unique across re-runs.
TS=$(date +%s | tail -c 6)
PH1="+923990${TS}1"
PH2="+923990${TS}2"

R=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Test Resident\",\"phone\":\"$PH1\",\"password\":\"pass123\",\"role\":\"resident\",\"society_id\":\"soc_pvc_isl\"}")
c "POST /register (resident) → success" '"success":true' "$R"
c "POST /register (resident) → token"   '"token"'        "$R"
TOKEN_RES=$(echo "$R" | tok)

R=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Test Pro\",\"phone\":\"$PH2\",\"password\":\"pass123\",\"role\":\"professional\",\"society_id\":\"soc_pvc_isl\"}")
c "POST /register (professional) → success" '"success":true' "$R"
TOKEN_PRO=$(echo "$R" | tok)

R=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Bad","phone":"+92399000003","password":"short","role":"resident"}')
c "POST /register (short password) → 400" '"success":false' "$R"

R=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Dup\",\"phone\":\"$PH1\",\"password\":\"pass123\",\"role\":\"resident\",\"society_id\":\"soc_pvc_isl\"}")
c "POST /register (duplicate phone) → 409" '"success":false' "$R"

echo ""
echo "━━━ 3. AUTH — login ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

R=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+92311111001","password":"password123"}')
c "POST /login (seeded resident) → success" '"success":true' "$R"
TOKEN_SRES=$(echo "$R" | tok)

R=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+92322222001","password":"password123"}')
c "POST /login (seeded pro) → success" '"success":true' "$R"
TOKEN_SPRO=$(echo "$R" | tok)

R=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+92311111004","password":"password123"}')
TOKEN_SRES4=$(echo "$R" | tok)

R=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+92300000001","password":"password123"}')
c "POST /login (admin) → success" '"success":true' "$R"
TOKEN_ADMIN=$(echo "$R" | tok)

R=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+92311111001","password":"WRONG"}')
c "POST /login (bad password) → 401 + false" '"success":false' "$R"

echo ""
echo "━━━ 4. AUTH — /me ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

R=$(curl -s $BASE/auth/me -H "Authorization: Bearer $TOKEN_SRES")
c "GET /me (resident) → success"          '"success":true'      "$R"
c "GET /me (resident) → role resident"    '"role":"resident"'    "$R"
c "GET /me (resident) → professional null" '"professional":null' "$R"

R=$(curl -s $BASE/auth/me -H "Authorization: Bearer $TOKEN_SPRO")
c "GET /me (pro) → professional object"    '"professional":{' "$R"
c "GET /me (pro) → categories array"       '"categories":'    "$R"
c "GET /me (pro) → rating field"           '"rating":'        "$R"

R=$(curl -s $BASE/auth/me)
c "GET /me (no token) → 401"  '"success":false' "$R"

R=$(curl -s $BASE/auth/societies)
c "GET /societies → Islamabad"  '"soc_pvc_isl"' "$R"
c "GET /societies → Lahore"     '"soc_pvc_lhr"' "$R"

echo ""
echo "━━━ 5. CATEGORIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

R=$(curl -s $BASE/categories)
c "GET /categories → success"    '"success":true' "$R"
c "GET /categories → Plumbing"   '"Plumbing"'     "$R"
c "GET /categories → 8 items"    '"Pest Control"' "$R"

R=$(curl -s $BASE/categories/cat_ac)
c "GET /categories/cat_ac → name"      '"AC Service"'          "$R"
c "GET /categories/cat_ac → price_min" '"base_price_min":1500' "$R"
c "GET /categories/cat_ac → price_max" '"base_price_max":5000' "$R"

R=$(curl -s $BASE/categories/cat_NOPE)
c "GET /categories/invalid → 404" '"success":false' "$R"

R=$(curl -s -X POST $BASE/categories \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"CCTV Installation","icon_name":"camera","base_price_min":3000,"base_price_max":12000}')
c "POST /categories (admin) → created"      '"success":true'       "$R"
c "POST /categories (admin) → name correct" '"CCTV Installation"'  "$R"
CAT_NEW_ID=$(echo "$R" | fld id)

echo ""
echo "━━━ 6. PROFESSIONALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

R=$(curl -s $BASE/professionals)
c "GET /professionals → success"        '"success":true'    "$R"
c "GET /professionals → is_verified"    '"is_verified":true' "$R"
c "GET /professionals → categories obj" '"icon_name"'        "$R"

R=$(curl -s "$BASE/professionals?category_id=cat_plumbing")
c "GET /professionals?category=plumbing → Asif Mehmood" '"Asif Mehmood"' "$R"

R=$(curl -s "$BASE/professionals?society_id=soc_pvc_isl")
c "GET /professionals?society → success"  '"success":true' "$R"

R=$(curl -s $BASE/professionals/pro_7)
c "GET /professionals/pro_7 → name"           '"Adeel Chaudhry"'  "$R"
c "GET /professionals/pro_7 → 2 cats"         '"cat_ac"'          "$R"
c "GET /professionals/pro_7 → recent_reviews" '"recent_reviews"'  "$R"

R=$(curl -s $BASE/professionals/pro_NOPE)
c "GET /professionals/invalid → 404"  '"success":false' "$R"

R=$(curl -s -X PATCH $BASE/professionals/me/availability \
  -H "Authorization: Bearer $TOKEN_SPRO" \
  -H 'Content-Type: application/json' \
  -d '{"is_available":false}')
c "PATCH /professionals/me/availability → success"  '"success":true'      "$R"
c "PATCH /professionals/me/availability → updated"  '"is_available":false' "$R"

# Restore availability
curl -s -X PATCH $BASE/professionals/me/availability \
  -H "Authorization: Bearer $TOKEN_SPRO" \
  -H 'Content-Type: application/json' \
  -d '{"is_available":true}' > /dev/null

R=$(curl -s -X PATCH $BASE/professionals/me/availability \
  -H "Authorization: Bearer $TOKEN_SRES" \
  -H 'Content-Type: application/json' \
  -d '{"is_available":false}')
c "PATCH /professionals/me/availability (resident) → 403" '"success":false' "$R"

echo ""
echo "━━━ 7. BOOKINGS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

R=$(curl -s -X POST $BASE/bookings \
  -H "Authorization: Bearer $TOKEN_SRES" \
  -H 'Content-Type: application/json' \
  -d '{"category_id":"cat_plumbing","scheduled_at":"2026-07-15T09:00:00Z","address":"House 99 Test St PVC Islamabad","problem_description":"Major pipe burst under bathroom sink"}')
c "POST /bookings → success"        '"success":true'   "$R"
c "POST /bookings → pending_quote"  '"pending_quote"'  "$R"
c "POST /bookings → address saved"  'House 99 Test'  "$R"
BKG_ID=$(echo "$R" | fld id)

R=$(curl -s -X POST $BASE/bookings \
  -H "Authorization: Bearer $TOKEN_SPRO" \
  -H 'Content-Type: application/json' \
  -d '{"category_id":"cat_plumbing","scheduled_at":"2026-07-15T09:00:00Z","address":"x","problem_description":"y"}')
c "POST /bookings (pro) → 403 forbidden" '"success":false' "$R"

R=$(curl -s -X POST $BASE/bookings \
  -H "Authorization: Bearer $TOKEN_SRES" \
  -H 'Content-Type: application/json' \
  -d '{"category_id":"cat_NOPE","scheduled_at":"2026-07-15T09:00:00Z","address":"x","problem_description":"y"}')
c "POST /bookings (bad category) → 400" '"success":false' "$R"

R=$(curl -s $BASE/bookings -H "Authorization: Bearer $TOKEN_SRES")
c "GET /bookings (resident-scoped) → success" '"success":true' "$R"

R=$(curl -s $BASE/bookings/$BKG_ID -H "Authorization: Bearer $TOKEN_SRES")
c "GET /bookings/:id → found"      '"success":true'   "$R"
c "GET /bookings/:id → address"    'House 99 Test'  "$R"

R=$(curl -s $BASE/bookings/bkg-NOPE -H "Authorization: Bearer $TOKEN_SRES")
c "GET /bookings/invalid → 404"  '"success":false' "$R"

echo ""
echo "━━━ 8. QUOTES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

PAYLOAD="{\"booking_id\":\"$BKG_ID\",\"amount\":1500,\"note\":\"Parts and labour included\"}"
R=$(curl -s -X POST $BASE/quotes \
  -H "Authorization: Bearer $TOKEN_SPRO" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD")
c "POST /quotes → success"  '"success":true' "$R"
c "POST /quotes → amount"   '"amount":1500'  "$R"
c "POST /quotes → note"     'Parts and labour' "$R"
QUOTE_ID=$(echo "$R" | fld id)

R=$(curl -s -X POST $BASE/quotes \
  -H "Authorization: Bearer $TOKEN_SRES" \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD")
c "POST /quotes (resident) → 403" '"success":false' "$R"

R=$(curl -s $BASE/quotes/booking/$BKG_ID -H "Authorization: Bearer $TOKEN_SRES")
c "GET /quotes/booking/:id → list"    '"success":true' "$R"
c "GET /quotes/booking/:id → quote"   '"amount":1500'  "$R"

R=$(curl -s -X PATCH $BASE/quotes/$QUOTE_ID/accept \
  -H "Authorization: Bearer $TOKEN_SRES")
c "PATCH /quotes/:id/accept → success"          '"success":true'           "$R"
c "PATCH /quotes/:id/accept → confirmed_amount" '"confirmed_amount":1500'  "$R"

R=$(curl -s $BASE/bookings/$BKG_ID -H "Authorization: Bearer $TOKEN_SRES")
c "booking status after accept → confirmed" '"confirmed"' "$R"
c "booking quote_amount set"                '"quote_amount":1500' "$R"

# Try accepting same quote again
R=$(curl -s -X PATCH $BASE/quotes/$QUOTE_ID/accept \
  -H "Authorization: Bearer $TOKEN_SRES")
c "PATCH /quotes/:id/accept (already accepted) → 400" '"success":false' "$R"

echo ""
echo "━━━ 9. MESSAGES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

R=$(curl -s -X POST $BASE/messages \
  -H "Authorization: Bearer $TOKEN_SRES" \
  -H 'Content-Type: application/json' \
  -d "{\"booking_id\":\"$BKG_ID\",\"content\":\"Will you arrive by 9am?\"}")
c "POST /messages → success"   '"success":true'        "$R"
c "POST /messages → content"   'Will you arrive'     "$R"

R=$(curl -s -X POST $BASE/messages \
  -H "Authorization: Bearer $TOKEN_SPRO" \
  -H 'Content-Type: application/json' \
  -d "{\"booking_id\":\"$BKG_ID\",\"content\":\"Yes, I will be there at 9am sharp.\"}")
c "POST /messages (pro reply) → success" '"success":true' "$R"

R=$(curl -s $BASE/messages/booking/$BKG_ID -H "Authorization: Bearer $TOKEN_SRES")
c "GET /messages/booking/:id → success"    '"success":true'     "$R"
c "GET /messages/booking/:id → 2 messages" 'Will you arrive'  "$R"
c "GET /messages ordered ASC"              '9am sharp'        "$R"

R=$(curl -s -X POST $BASE/messages \
  -H "Authorization: Bearer $TOKEN_SRES" \
  -H 'Content-Type: application/json' \
  -d '{"booking_id":"bkg-NOPE","content":"hello"}')
c "POST /messages (bad booking) → 404" '"success":false' "$R"

echo ""
echo "━━━ 10. REVIEWS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Seeded bkg_4 is completed; seeded review already exists — try duplicate
R=$(curl -s -X POST $BASE/reviews \
  -H "Authorization: Bearer $TOKEN_SRES4" \
  -H 'Content-Type: application/json' \
  -d '{"booking_id":"bkg_4","professional_id":"usr_pro_3","rating":5,"comment":"Great!"}')
c "POST /reviews (duplicate) → 409" '"success":false' "$R"

# review on non-completed booking → 400
R=$(curl -s -X POST $BASE/reviews \
  -H "Authorization: Bearer $TOKEN_SRES" \
  -H 'Content-Type: application/json' \
  -d "{\"booking_id\":\"$BKG_ID\",\"professional_id\":\"usr_pro_1\",\"rating\":4,\"comment\":\"ok\"}")
c "POST /reviews (booking not completed) → 400" '"success":false' "$R"

# bad rating
R=$(curl -s -X POST $BASE/reviews \
  -H "Authorization: Bearer $TOKEN_SRES4" \
  -H 'Content-Type: application/json' \
  -d '{"booking_id":"bkg_4","professional_id":"usr_pro_3","rating":6,"comment":"ok"}')
c "POST /reviews (rating > 5) → 400" '"success":false' "$R"

R=$(curl -s $BASE/reviews/professional/usr_pro_3 \
  -H "Authorization: Bearer $TOKEN_SRES")
c "GET /reviews/professional/:id → success"       '"success":true'  "$R"
c "GET /reviews/professional/:id → reviewer_name" '"reviewer_name"' "$R"
c "GET /reviews/professional/:id → rating 5"      '"rating":5'      "$R"

echo ""
echo "━━━ 11. USERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

R=$(curl -s $BASE/users/usr_res_1 -H "Authorization: Bearer $TOKEN_SRES")
c "GET /users/:id → success"   '"success":true'  "$R"
c "GET /users/:id → id match"  '"usr_res_1"'     "$R"

R=$(curl -s $BASE/users/usr_pro_1 -H "Authorization: Bearer $TOKEN_SRES")
c "GET /users/:id (pro) → professional obj" '"professional":{' "$R"

R=$(curl -s $BASE/users/uid_NOPE -H "Authorization: Bearer $TOKEN_SRES")
c "GET /users/invalid → 404"  '"success":false' "$R"

R=$(curl -s -X PATCH $BASE/users/me \
  -H "Authorization: Bearer $TOKEN_SRES" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Aisha Malik Updated"}')
c "PATCH /users/me → success"   '"success":true'          "$R"
c "PATCH /users/me → new name"  '"Aisha Malik Updated"'   "$R"

R=$(curl -s -X PATCH $BASE/users/me \
  -H "Authorization: Bearer $TOKEN_SRES" \
  -H 'Content-Type: application/json' \
  -d '{"name":""}')
c "PATCH /users/me (empty name) → 400" '"success":false' "$R"

echo ""
echo "━━━ 12. ADMIN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

R=$(curl -s $BASE/auth/users -H "Authorization: Bearer $TOKEN_ADMIN")
c "GET /auth/users (admin) → success"   '"success":true' "$R"
c "GET /auth/users (admin) → has users" '"phone"'        "$R"

R=$(curl -s $BASE/auth/users -H "Authorization: Bearer $TOKEN_SRES")
c "GET /auth/users (resident) → 403"  '"success":false' "$R"

echo ""
echo "━━━ 13. EDGE CASES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

R=$(curl -s $BASE/totally/unknown)
c "Unknown route → Route not found"  '"Route not found"' "$R"
c "Unknown route → success false"    '"success":false'   "$R"

R=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+923990000xx","password":"pass123","role":"admin"}')
c "Register as admin → rejected"  '"success":false' "$R"

R=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"X","phone":"+92399009999","password":"pass123","role":"resident","society_id":"soc_FAKE"}')
c "Register bad society_id → 400"  '"success":false' "$R"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $pass passed, $fail failed out of $((pass+fail)) tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
