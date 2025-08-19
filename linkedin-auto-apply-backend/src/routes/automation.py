from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import time
import random
from datetime import datetime, timedelta
import sqlite3
import os
from pathlib import Path
from threading import Thread, Event
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError

automation_bp = Blueprint('automation', __name__)

# ---------- Database helpers ----------
def get_db_connection():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'app.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_automation_db():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS job_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT NOT NULL,
            salary TEXT,
            status TEXT NOT NULL,
            url TEXT,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            keywords TEXT,
            job_type TEXT
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS automation_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT DEFAULT 'default',
            keywords TEXT,
            location TEXT,
            experience_level TEXT,
            salary_min INTEGER,
            job_type TEXT,
            remote BOOLEAN,
            hybrid BOOLEAN,
            onsite BOOLEAN,
            auto_answer BOOLEAN,
            years_experience INTEGER,
            cover_letter TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# Initialize database on import
init_automation_db()

# ---------- In memory state ----------
automation_state = {
    'is_running': False,
    'start_time': None,
    'applications_count': 0
}

# Worker controls
worker_thread = None
stop_event = Event()

# ---------- Helpers ----------
def _insert_application(job_data):
    conn = get_db_connection()
    conn.execute(
        '''
        INSERT INTO job_applications
            (title, company, location, salary, status, url, keywords, job_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            job_data.get('title', ''),
            job_data.get('company', ''),
            job_data.get('location', ''),
            job_data.get('salary', ''),
            job_data.get('status', ''),
            job_data.get('url', ''),
            job_data.get('keywords', ''),
            job_data.get('job_type', '')
        ),
    )
    conn.commit()
    conn.close()

def _generate_fake_job():
    companies = ['Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Netflix', 'Tesla', 'Spotify', 'Airbnb', 'Uber']
    job_titles = ['Software Engineer', 'Backend Developer', 'Full Stack Developer', 'Frontend Developer', 'DevOps Engineer']
    locations = ['Remote', 'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Boston, MA']
    return {
        'title': f"{random.choice(job_titles)} - {random.choice(['Junior', 'Mid-Level', 'Senior'])}",
        'company': random.choice(companies),
        'location': random.choice(locations),
        'salary': f"${random.randint(80, 180)}K - ${random.randint(120, 250)}K",
        'status': 'successful' if random.random() > 0.1 else 'failed',
        'url': f"https://linkedin.com/jobs/view/{random.randint(1000000, 9999999)}",
        'keywords': 'software engineer, python, javascript',
        'job_type': random.choice(['Full-time', 'Contract', 'Internship']),
    }

def _load_settings():
    conn = get_db_connection()
    row = conn.execute("""
        SELECT * FROM automation_settings
        WHERE user_id = 'default'
        ORDER BY updated_at DESC
        LIMIT 1
    """).fetchone()
    conn.close()
    if not row:
        return {
            'keywords': 'software engineer, software developer, qa automation engineer, full stack',
            'location': 'United States',
            'experience_level': 'Entry level,Associate',
            'salary_min': 0,
            'job_type': 'Full-time,Contract',
            'remote': True,
            'hybrid': True,
            'onsite': True,
            'auto_answer': True,
            'years_experience': 1,
            'cover_letter': ''
        }
    return dict(row)

def _build_search_url(settings):
    # Simple URL with Easy Apply facet, we also click filters in the UI as backup
    kws = (settings.get('keywords') or '').replace(' ', '%20')
    loc = (settings.get('location') or 'United States').replace(' ', '%20')
    base = "https://www.linkedin.com/jobs/search/"
    qp = f"?keywords={kws}&location={loc}&f_AL=true"
    return base + qp

def _apply_filters_from_settings(page, settings):
    # Best effort filter clicking
    try:
        # Easy Apply chip
        btn = page.query_selector('button[aria-label*="Easy Apply"]')
        if btn:
            btn.click()
            page.wait_for_timeout(300)
    except Exception:
        pass

def _safe_text(page, selector):
    el = page.query_selector(selector)
    try:
        return el.inner_text().strip() if el else ''
    except Exception:
        return ''

def _should_skip_title(title):
    if not title:
        return False
    title_l = title.lower()
    bad = ['senior', 'lead', 'principal', 'staff', 'architect', 'clearance']
    return any(w in title_l for w in bad)

def _posted_days_ago(page):
    # Best effort to read posting age
    txt = _safe_text(page, '[data-test-job-posted-date], .jobs-unified-top-card__subtitle-primary-group')
    # Look for "X days ago"
    for token in txt.split():
        if token.isdigit():
            return int(token)
    return None

def _too_many_questions(page):
    modal = page.query_selector('div[role="dialog"]')
    if not modal:
        return False
    inputs = modal.query_selector_all('input, textarea, select')
    return len(inputs) >= 18  # rough proxy for 6+ custom questions

def _auto_answer_questions(page, settings):
    # Yes defaults
    yes_markers = [
        "legally authorized to work in the United States",
        "at least 18 years of age",
        "background check",
        "willing to relocate",
        "open to hybrid",
        "experience with CI/CD",
        "version control",
        "automated UI testing",
        "API testing",
        "cross functional teams",
        "startup",
        "Agile",
    ]
    no_markers = [
        "performance testing",
        "security testing",
        "require visa sponsorship",
    ]

    # Radio or checkbox labels
    for lab in page.query_selector_all('label'):
        t = (lab.inner_text() or '').strip().lower()
        try:
            if any(m in t for m in yes_markers):
                lab.click()
            if any(m in t for m in no_markers):
                # click No if present, else click label that contains No
                parent = lab.locator('xpath=..')
                no_opt = None
                try:
                    no_opt = parent.locator('label:has-text("No")')
                except Exception:
                    pass
                if no_opt:
                    no_opt.click()
        except Exception:
            pass

    # Number fields for years
    years = str(settings.get('years_experience', 1))
    for inp in page.query_selector_all('input[type="number"], input[aria-label*="year"], input[placeholder*="year"]'):
        try:
            inp.fill(years)
        except Exception:
            pass

    # Free text questions that look like years with unknown tools, fill 1 to 3
    for ta in page.query_selector_all('textarea, input[type="text"]'):
        ph = ((ta.get_attribute('placeholder') or '') + ' ' + (ta.get_attribute('aria-label') or '')).lower()
        if 'year' in ph:
            try:
                ta.fill(str(random.randint(1, 3)))
            except Exception:
                pass

def _handle_easy_apply_modal(page, settings, screenshots_dir):
    start = time.time()

    def timeout():
        return (time.time() - start) > 60

    try:
        page.wait_for_selector('div[role="dialog"]', timeout=10_000)
    except PWTimeoutError:
        return {'status': 'skipped:no-modal'}

    # Skip if too many questions
    if _too_many_questions(page):
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
        return {'status': 'skipped:too-many-questions'}

    step = 0
    while True:
        if timeout():
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
            return {'status': 'skipped:timeout'}

        _auto_answer_questions(page, settings)

        # If cover letter required, skip
        if page.query_selector('input[type="file"][name*="cover"], textarea[placeholder*="cover"], textarea[aria-label*="cover"]'):
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
            return {'status': 'skipped:cover-letter'}

        # If resume re upload is required, skip
        if page.query_selector('input[type="file"][name*="resume"], input[type="file"][accept*=".pdf"]'):
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
            return {'status': 'skipped:resume-reupload'}

        # Check for external redirect warnings
        if page.query_selector('a:has-text("Continue to")') or page.query_selector('button:has-text("Continue to")'):
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
            return {'status': 'skipped:external-redirect'}

        # Next or Submit
        submit = page.query_selector('button[aria-label*="Submit application"], button:has-text("Submit application")')
        next_btn = page.query_selector('button[aria-label*="Next"], button:has-text("Next")')

        if submit:
            submit.click()
            page.wait_for_timeout(800)
            confirm = page.query_selector('button:has-text("Submit"), button:has-text("Done")')
            if confirm:
                confirm.click()
                page.wait_for_timeout(800)
            page.screenshot(path=str(screenshots_dir / f"apply_submit_{int(time.time())}.png"))
            return {'status': 'successful'}

        if next_btn:
            next_btn.click()
            step += 1
            if step > 6:
                try:
                    page.keyboard.press("Escape")
                except Exception:
                    pass
                return {'status': 'skipped:too-many-steps'}
            page.wait_for_timeout(600)
            continue

        # Stuck, close
        try:
            page.keyboard.press("Escape")
        except Exception:
            pass
        return {'status': 'skipped:unknown'}

# ---------- Worker ----------
def _worker_loop():
    screenshots_dir = Path(os.path.dirname(os.path.dirname(__file__))) / "static" / "session"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    # macOS default Chrome profile
    user_data_dir = os.path.expanduser("~/Library/Application Support/Google/Chrome")
    profile_dir = os.path.join(user_data_dir, "Default")

    settings = _load_settings()

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=profile_dir,
                channel="chrome",
                headless=False,
                args=["--disable-blink-features=AutomationControlled"],
            )
            page = context.new_page()

            # Build search URL and open
            search_url = _build_search_url(settings)
            page.goto(search_url, wait_until="domcontentloaded", timeout=60_000)
            page.screenshot(path=str(screenshots_dir / "01_jobs_page.png"))

            # Reapply filters if needed
            _apply_filters_from_settings(page, settings)
            page.screenshot(path=str(screenshots_dir / "02_filters_applied.png"))

            applied = 0
            max_apps = 50
            cutoff_days = 14

            while not stop_event.is_set() and automation_state['is_running'] and applied < max_apps:
                try:
                    page.wait_for_selector('[data-job-id], .jobs-search-results__list-item', timeout=20_000)
                except PWTimeoutError:
                    break

                cards = page.query_selector_all('[data-job-id], .jobs-search-results__list-item')
                if not cards:
                    break

                for card in cards:
                    if stop_event.is_set() or not automation_state['is_running']:
                        break

                    # Open card
                    try:
                        card.click()
                        page.wait_for_timeout(900)
                    except Exception:
                        continue

                    title = _safe_text(page, 'h1 a, h2 a, .job-details-jobs-unified-top-card__job-title')
                    if _should_skip_title(title):
                        continue

                    # Skip if too old
                    d = _posted_days_ago(page)
                    if d is not None and d > cutoff_days:
                        continue

                    easy_apply = page.query_selector('button:has-text("Easy Apply")')
                    if not easy_apply:
                        continue

                    easy_apply.click()
                    result = _handle_easy_apply_modal(page, settings, screenshots_dir)

                    # Log to DB
                    _insert_application({
                        'title': title or 'N/A',
                        'company': _safe_text(page, 'a[href*="/company/"], .job-details-jobs-unified-top-card__company-name'),
                        'location': _safe_text(page, '.jobs-unified-top-card__bullet'),
                        'salary': _safe_text(page, 'span:has-text("$")') or '',
                        'status': result['status'],
                        'url': page.url,
                        'keywords': settings.get('keywords', ''),
                        'job_type': settings.get('job_type', '')
                    })

                    automation_state['applications_count'] += 1
                    applied += 1

                    # Small random delay
                    page.wait_for_timeout(random.randint(3000, 6000))

            try:
                context.close()
            except Exception:
                pass

    except Exception as e:
        _insert_application({
            'title': 'Worker error',
            'company': str(e.__class__.__name__),
            'location': 'N/A',
            'salary': '',
            'status': 'failed',
            'url': '',
            'keywords': '',
            'job_type': ''
        })

# ---------- Routes ----------
@automation_bp.route('/start', methods=['POST'])
@cross_origin()
def start_automation():
    global automation_state, worker_thread, stop_event
    if automation_state['is_running']:
        return jsonify({'error': 'Automation is already running'}), 400

    automation_state['is_running'] = True
    automation_state['start_time'] = datetime.now()
    automation_state['applications_count'] = 0

    stop_event.clear()
    worker_thread = Thread(target=_worker_loop, daemon=True)
    worker_thread.start()

    return jsonify({
        'message': 'Automation started successfully',
        'status': 'running',
        'start_time': automation_state['start_time'].isoformat()
    })

@automation_bp.route('/stop', methods=['POST'])
@cross_origin()
def stop_automation():
    global automation_state, worker_thread, stop_event
    if not automation_state['is_running']:
        return jsonify({'error': 'Automation is not running'}), 400

    automation_state['is_running'] = False
    stop_event.set()
    try:
        if worker_thread and worker_thread.is_alive():
            worker_thread.join(timeout=1.5)
    except Exception:
        pass

    end_time = datetime.now()
    duration = end_time - automation_state['start_time'] if automation_state['start_time'] else None
    return jsonify({
        'message': 'Automation stopped successfully',
        'status': 'stopped',
        'duration_seconds': duration.total_seconds() if duration else 0,
        'applications_submitted': automation_state['applications_count']
    })

@automation_bp.route('/status', methods=['GET'])
@cross_origin()
def get_automation_status():
    global automation_state
    duration = None
    if automation_state['is_running'] and automation_state['start_time']:
        duration = (datetime.now() - automation_state['start_time']).total_seconds()
    return jsonify({
        'is_running': automation_state['is_running'],
        'start_time': automation_state['start_time'].isoformat() if automation_state['start_time'] else None,
        'duration_seconds': duration,
        'applications_count': automation_state['applications_count']
    })

@automation_bp.route('/simulate-application', methods=['POST'])
@cross_origin()
def simulate_application():
    global automation_state
    if not automation_state['is_running']:
        return jsonify({'error': 'Automation is not running'}), 400
    job_data = _generate_fake_job()
    _insert_application(job_data)
    automation_state['applications_count'] += 1
    return jsonify({
        'message': 'Job application simulated',
        'application': job_data,
        'total_applications': automation_state['applications_count']
    })

@automation_bp.route('/applications', methods=['GET'])
@cross_origin()
def get_applications():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    status_filter = request.args.get('status')

    conn = get_db_connection()

    query = 'SELECT * FROM job_applications'
    params = []
    if status_filter:
        query += ' WHERE status = ?'
        params.append(status_filter)
    query += ' ORDER BY applied_at DESC LIMIT ? OFFSET ?'
    params.extend([per_page, (page - 1) * per_page])
    rows = conn.execute(query, params).fetchall()

    if status_filter:
        total = conn.execute('SELECT COUNT(*) AS total FROM job_applications WHERE status = ?', [status_filter]).fetchone()['total']
    else:
        total = conn.execute('SELECT COUNT(*) AS total FROM job_applications').fetchone()['total']

    conn.close()

    applications = [
        {
            'id': r['id'],
            'title': r['title'],
            'company': r['company'],
            'location': r['location'],
            'salary': r['salary'],
            'status': r['status'],
            'url': r['url'],
            'applied_at': r['applied_at'],
            'keywords': r['keywords'],
            'job_type': r['job_type'],
        }
        for r in rows
    ]

    return jsonify({
        'applications': applications,
        'page': page,
        'per_page': per_page,
        'total': total
    })

@automation_bp.route('/stats', methods=['GET'])
@cross_origin()
def get_stats():
    conn = get_db_connection()
    totals = conn.execute('SELECT COUNT(*) AS total FROM job_applications').fetchone()['total']
    success = conn.execute("SELECT COUNT(*) AS c FROM job_applications WHERE status = 'successful'").fetchone()['c']
    failed = conn.execute("SELECT COUNT(*) AS c FROM job_applications WHERE status = 'failed'").fetchone()['c']
    skipped = conn.execute("SELECT COUNT(*) AS c FROM job_applications WHERE status LIKE 'skipped:%'").fetchone()['c']
    daily = conn.execute("""
        SELECT DATE(applied_at) AS day, COUNT(*) AS count
        FROM job_applications
        WHERE applied_at >= DATE('now', '-7 day')
        GROUP BY DATE(applied_at)
        ORDER BY day DESC
    """).fetchall()
    conn.close()
    return jsonify({
        'total_applications': totals,
        'successful': success,
        'failed': failed,
        'skipped': skipped,
        'daily': [{'day': d['day'], 'count': d['count']} for d in daily]
    })

@automation_bp.route('/settings', methods=['GET', 'POST'])
@cross_origin()
def automation_settings():
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.get_json() or {}
        conn.execute('''
            INSERT OR REPLACE INTO automation_settings
            (id, user_id, keywords, location, experience_level, salary_min, job_type,
             remote, hybrid, onsite, auto_answer, years_experience, cover_letter, updated_at)
            VALUES (
                COALESCE((SELECT id FROM automation_settings WHERE user_id = 'default' ORDER BY updated_at DESC LIMIT 1), NULL),
                'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
            )
        ''', (
            data.get('keywords', ''),
            data.get('location', ''),
            data.get('experience_level', ''),
            data.get('salary_min', 0),
            data.get('job_type', ''),
            1 if data.get('remote', True) else 0,
            1 if data.get('hybrid', True) else 0,
            1 if data.get('onsite', True) else 0,
            1 if data.get('auto_answer', True) else 0,
            int(data.get('years_experience', 1)),
            data.get('cover_letter', '')
        ))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Settings updated successfully'})

    row = conn.execute("""
        SELECT * FROM automation_settings
        WHERE user_id = 'default'
        ORDER BY updated_at DESC
        LIMIT 1
    """).fetchone()
    conn.close()
    if not row:
        return jsonify(_load_settings())
    return jsonify(dict(row))

@automation_bp.route('/export', methods=['GET'])
@cross_origin()
def export_applications():
    conn = get_db_connection()
    apps = conn.execute('''
        SELECT title, company, location, salary, status, url, applied_at
        FROM job_applications
        ORDER BY applied_at DESC
    ''').fetchall()
    conn.close()

    csv_content = "Job Title,Company,Location,Salary,Status,URL,Applied At\n"
    for app in apps:
        csv_content += (
            f'"{app["title"]}","{app["company"]}","{app["location"]}","{app["salary"]}",'
            f'"{app["status"]}","{app["url"]}","{app["applied_at"]}"\n'
        )

    return csv_content, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=linkedin_applications.csv'
    }
