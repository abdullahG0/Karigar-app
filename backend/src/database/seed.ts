import bcrypt from 'bcryptjs';
import { getDb } from './setup';

export async function seedIfEmpty(): Promise<void> {
  const pool = getDb();

  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM societies');
  if (parseInt(rows[0].count, 10) > 0) {
    console.log('[seed] Database already has data — skipping seed.');
    return;
  }

  console.log('[seed] Empty database detected — seeding initial data...');
  const pwHash = bcrypt.hashSync('password123', 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Societies ────────────────────────────────────────────────────────────
    await client.query('INSERT INTO societies (id, name, city) VALUES ($1,$2,$3)', ['soc_pvc_isl', 'ParkView City Islamabad', 'Islamabad']);
    await client.query('INSERT INTO societies (id, name, city) VALUES ($1,$2,$3)', ['soc_pvc_lhr', 'ParkView City Lahore', 'Lahore']);

    // ── Categories ───────────────────────────────────────────────────────────
    const cats = [
      { id: 'cat_plumbing',   name: 'Plumbing',           icon: 'wrench',     desc: 'Pipe repairs, leak fixing, and water heater installation', min: 500,  max: 2000 },
      { id: 'cat_electrical', name: 'Electrical',          icon: 'zap',        desc: 'Wiring, fixture installation, and panel upgrades',         min: 800,  max: 3000 },
      { id: 'cat_gardening',  name: 'Gardening',           icon: 'leaf',       desc: 'Lawn mowing, pruning, and landscaping',                    min: 1000, max: 4000 },
      { id: 'cat_cleaning',   name: 'Sanitary / Cleaning', icon: 'sparkles',   desc: 'Deep cleaning and sanitation services',                    min: 1500, max: 5000 },
      { id: 'cat_carpentry',  name: 'Carpentry',           icon: 'hammer',     desc: 'Furniture repair, custom woodwork, and door installation', min: 1000, max: 4000 },
      { id: 'cat_painting',   name: 'Painting',            icon: 'paintbrush', desc: 'Interior and exterior painting services',                  min: 2000, max: 8000 },
      { id: 'cat_ac',         name: 'AC Service',          icon: 'wind',       desc: 'AC installation, gas refilling, and routine servicing',    min: 1500, max: 5000 },
      { id: 'cat_pest',       name: 'Pest Control',        icon: 'bug',        desc: 'Fumigation, rodent control, and termite treatment',        min: 2000, max: 6000 },
    ] as const;
    for (const c of cats) {
      await client.query(
        'INSERT INTO service_categories (id, name, icon_name, description, base_price_min, base_price_max) VALUES ($1,$2,$3,$4,$5,$6)',
        [c.id, c.name, c.icon, c.desc, c.min, c.max]
      );
    }

    // ── Users ────────────────────────────────────────────────────────────────
    const insUser = (id: string, name: string, phone: string, role: string, society_id: string) =>
      client.query(
        'INSERT INTO users (id, name, phone, password_hash, role, society_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, name, phone, pwHash, role, society_id]
      );

    await insUser('usr_admin_1', 'Zara Ahmed',  '+92300000001', 'admin', 'soc_pvc_isl');
    await insUser('usr_admin_2', 'Hassan Khan', '+92300000002', 'admin', 'soc_pvc_lhr');

    const residents = [
      { id: 'usr_res_1', name: 'Aisha Malik',   phone: '+92311111001' },
      { id: 'usr_res_2', name: 'Bilal Qureshi', phone: '+92311111002' },
      { id: 'usr_res_3', name: 'Sara Riaz',     phone: '+92311111003' },
      { id: 'usr_res_4', name: 'Omar Farooq',   phone: '+92311111004' },
      { id: 'usr_res_5', name: 'Hina Shah',     phone: '+92311111005' },
      { id: 'usr_res_6', name: 'Kamran Iqbal',  phone: '+92311111006' },
    ];
    for (const r of residents) await insUser(r.id, r.name, r.phone, 'resident', 'soc_pvc_isl');

    const profUsers = [
      { id: 'usr_pro_1', name: 'Asif Mehmood',  phone: '+92322222001' },
      { id: 'usr_pro_2', name: 'Tariq Hussain', phone: '+92322222002' },
      { id: 'usr_pro_3', name: 'Naveed Baig',   phone: '+92322222003' },
      { id: 'usr_pro_4', name: 'Raza Ali',      phone: '+92322222004' },
      { id: 'usr_pro_5', name: 'Imran Sheikh',  phone: '+92322222005' },
      { id: 'usr_pro_6', name: 'Khalid Rehman', phone: '+92322222006' },
      { id: 'usr_pro_7', name: 'Adeel Chaudhry',phone: '+92322222007' },
      { id: 'usr_pro_8', name: 'Faisal Nawaz',  phone: '+92322222008' },
    ];
    for (const p of profUsers) await insUser(p.id, p.name, p.phone, 'professional', 'soc_pvc_isl');

    // ── Professional profiles ─────────────────────────────────────────────────
    const professionals = [
      { id: 'pro_1', userId: 'usr_pro_1', bio: '10 years of experience in residential plumbing. Specialises in pipe repairs, leak detection, and water heater installation.', rate: 1200, rating: 4.8, jobs: 120, cats: ['cat_plumbing'] },
      { id: 'pro_2', userId: 'usr_pro_2', bio: 'Certified electrician with 8 years handling wiring, fixture installations, and panel upgrades for residential complexes.', rate: 1500, rating: 4.7, jobs: 98, cats: ['cat_electrical'] },
      { id: 'pro_3', userId: 'usr_pro_3', bio: 'Expert gardener and landscaper passionate about creating green, well-kept spaces inside gated communities.', rate: 800, rating: 4.5, jobs: 75, cats: ['cat_gardening'] },
      { id: 'pro_4', userId: 'usr_pro_4', bio: 'Deep cleaning and sanitation specialist using eco-friendly products. 6 years of experience with residential clients.', rate: 1000, rating: 4.9, jobs: 140, cats: ['cat_cleaning'] },
      { id: 'pro_5', userId: 'usr_pro_5', bio: 'Master carpenter with 12 years in the trade. Specialises in custom furniture repair and solid door installations.', rate: 1800, rating: 4.6, jobs: 88, cats: ['cat_carpentry'] },
      { id: 'pro_6', userId: 'usr_pro_6', bio: 'Professional painter known for clean, precise work on both interior walls and exterior facades.', rate: 1400, rating: 4.4, jobs: 62, cats: ['cat_painting'] },
      { id: 'pro_7', userId: 'usr_pro_7', bio: 'AC technician certified across all major brands. Handles split-unit installation, gas recharging, and filter servicing.', rate: 1600, rating: 4.7, jobs: 105, cats: ['cat_ac', 'cat_electrical'] },
      { id: 'pro_8', userId: 'usr_pro_8', bio: 'Licensed pest control specialist providing safe fumigation, rodent exclusion, and anti-termite treatments.', rate: 2000, rating: 3.8, jobs: 12, cats: ['cat_pest', 'cat_cleaning'] },
    ] as const;

    for (const p of professionals) {
      await client.query(
        'INSERT INTO professionals (id, user_id, bio, hourly_rate, is_verified, is_available, rating, total_jobs) VALUES ($1,$2,$3,$4,true,true,$5,$6)',
        [p.id, p.userId, p.bio, p.rate, p.rating, p.jobs]
      );
      for (const catId of p.cats) {
        await client.query(
          'INSERT INTO professional_categories (professional_id, category_id) VALUES ($1,$2)',
          [p.id, catId]
        );
      }
    }

    // ── Sample bookings ───────────────────────────────────────────────────────
    const now        = new Date().toISOString();
    const yesterday  = new Date(Date.now() -  86_400_000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 172_800_000).toISOString();
    const tomorrow   = new Date(Date.now() +  86_400_000).toISOString();
    const nextWeek   = new Date(Date.now() +  604_800_000).toISOString();

    await client.query(
      'INSERT INTO bookings (id, resident_id, professional_id, category_id, status, scheduled_at, address, problem_description, quote_amount, final_amount, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      ['bkg_1', 'usr_res_1', null, 'cat_plumbing',   'pending_quote', nextWeek,   'House 42, Street 7, ParkView City Islamabad',  'Kitchen sink has been leaking for two days and water pressure is noticeably low throughout the house.',  null, null, now]
    );
    await client.query(
      'INSERT INTO bookings (id, resident_id, professional_id, category_id, status, scheduled_at, address, problem_description, quote_amount, final_amount, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      ['bkg_2', 'usr_res_2', 'usr_pro_2', 'cat_electrical', 'quoted',        tomorrow,   'House 18, Street 3, ParkView City Islamabad',  'Frequent power trips in the main circuit breaker — needs urgent inspection.',                           1800, null, yesterday]
    );
    await client.query(
      'INSERT INTO bookings (id, resident_id, professional_id, category_id, status, scheduled_at, address, problem_description, quote_amount, final_amount, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      ['bkg_3', 'usr_res_3', 'usr_pro_4', 'cat_cleaning',   'in_progress',   now,        'House 5, Street 12, ParkView City Islamabad', 'Full house deep cleaning required before Eid guests arrive next week.',                                 3500, null, yesterday]
    );
    await client.query(
      'INSERT INTO bookings (id, resident_id, professional_id, category_id, status, scheduled_at, address, problem_description, quote_amount, final_amount, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      ['bkg_4', 'usr_res_4', 'usr_pro_3', 'cat_gardening',  'completed',     twoDaysAgo, 'House 31, Street 9, ParkView City Islamabad', 'Lawn needs mowing and trimming; several plants also need pruning.',                                    1500, 1500, twoDaysAgo]
    );

    // ── Quote for bkg_2 ───────────────────────────────────────────────────────
    await client.query(
      'INSERT INTO quotes (id, booking_id, professional_id, amount, note, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['qte_1', 'bkg_2', 'usr_pro_2', 1800, 'Will inspect all circuit breakers and replace any faulty components. Estimate includes parts and labour.', 'pending', yesterday]
    );

    // ── Review for bkg_4 ──────────────────────────────────────────────────────
    await client.query(
      'INSERT INTO reviews (id, booking_id, resident_id, professional_id, rating, comment, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['rev_1', 'bkg_4', 'usr_res_4', 'usr_pro_3', 5, 'Naveed did an outstanding job! The garden looks immaculate now. Very punctual and professional throughout.', now]
    );

    await client.query('COMMIT');
    console.log('[seed] Initial data inserted successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
