// SEO & General Settings Handler
// Uses D1 settings table (section, key, value)

const DEFAULT_SEO = {
  meta_title: 'Avnideep 6Pro Vitality Shilajit | 50% OFF + Free Doctor Consult',
  meta_description: 'Avnideep 6Pro Vitality Shilajit Capsules - 14 जड़ी-बूटियों से बना 100% आयुर्वेदिक formula। COD उपलब्ध, 10 दिन Money Back Guarantee, Free Delivery।',
  canonical_url: 'https://shop.avnideep.in/',
  og_image: 'https://cdn.avnideepayurveda.in/Avnideep-shilajit/og-image.webp',
  robots: 'index, follow',
  favicon: '/favicon.ico'
};

const DEFAULT_SETTINGS = {
  maintenance_mode: 'false',
  announcement_text: '',
  footer_text: '© 2026 Avnideep Ayurveda. All rights reserved.'
};

// Helper: Get all settings for a section
async function getSectionSettings(db, section) {
  try {
    const rows = await db.prepare('SELECT key, value FROM settings WHERE section = ?').bind(section).all();
    const result = {};
    for (const row of rows.results || []) {
      result[row.key] = row.value;
    }
    return result;
  } catch(e) {
    console.error('Get settings error:', e);
    return {};
  }
}

// Helper: Upsert single setting
async function upsertSetting(db, section, key, value) {
  await db.prepare(
    'INSERT INTO settings (section, key, value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(section, key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP'
  ).bind(section, key, String(value), String(value)).run();
}

export async function handleGetSeoSettings(request, env) {
  try {
    const db = env.DB;
    const stored = await getSectionSettings(db, 'seo');
    const seo = { ...DEFAULT_SEO, ...stored };
    return new Response(JSON.stringify({ ok: true, seo }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    });
  } catch(err) {
    console.error('Get SEO error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function handleUpdateSeoSettings(request, env) {
  try {
    const body = await request.json();
    const db = env.DB;
    const allowed = ['meta_title', 'meta_description', 'canonical_url', 'og_image', 'robots', 'favicon'];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        await upsertSetting(db, 'seo', key, String(body[key]).trim());
      }
    }

    return new Response(JSON.stringify({ ok: true, message: 'SEO settings saved' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch(err) {
    console.error('Update SEO error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function handleGetGeneralSettings(request, env) {
  try {
    const db = env.DB;
    const stored = await getSectionSettings(db, 'general');
    const settings = { ...DEFAULT_SETTINGS, ...stored };
    return new Response(JSON.stringify({ ok: true, settings }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    });
  } catch(err) {
    console.error('Get settings error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function handleUpdateGeneralSettings(request, env) {
  try {
    const body = await request.json();
    const db = env.DB;
    const allowed = ['maintenance_mode', 'announcement_text', 'footer_text'];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        await upsertSetting(db, 'general', key, String(body[key]).trim());
      }
    }

    return new Response(JSON.stringify({ ok: true, message: 'Settings saved' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch(err) {
    console.error('Update settings error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// Public endpoint for landing page to read settings (cached)
export async function handleGetPublicSettings(request, env) {
  try {
    const db = env.DB;
    const seo = await getSectionSettings(db, 'seo');
    const general = await getSectionSettings(db, 'general');
    return new Response(JSON.stringify({ ok: true, seo: { ...DEFAULT_SEO, ...seo }, settings: { ...DEFAULT_SETTINGS, ...general } }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' }
    });
  } catch(err) {
    console.error('Get public settings error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
