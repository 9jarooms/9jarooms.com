#!/usr/bin/env python3
"""End-to-end check of the caretaker flows against the local app (live DB, PAYSTACK_MOCK=1).
Uses the test caretaker login from .env.local and Studio in Garki; everything it creates is removed.
Emails go to Resend's test inbox only (TEAM_NOTIFY_EMAILS / guest = delivered@resend.dev).

  ~/bobbybrown/growth-team/.venv/bin/python scripts/e2e-caretaker.py
"""
import re, sys, time
from datetime import date, timedelta
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
ENV = dict(l.strip().split("=", 1) for l in open(ROOT / ".env.local") if "=" in l and not l.startswith("#"))
APP = "http://localhost:3300"
SB = ENV["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1"
H = {"apikey": ENV["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": f"Bearer {ENV['SUPABASE_SERVICE_ROLE_KEY']}", "Content-Type": "application/json"}
PROP = "9df26cec-1740-4a18-99fd-d380f1995eb6"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
GUEST = "E2E Test Guest"
ok = []


def check(name, cond, extra=""):
    ok.append(bool(cond)); print(("PASS " if cond else "FAIL ") + name + (f"  ({extra})" if extra else ""))


def sb(path):
    return requests.get(SB + path, headers=H, timeout=30).json()


def cleanup():
    ids = [b["id"] for b in sb(f"/bookings?select=id&guest_name=eq.{GUEST}")]
    if ids:
        q = f"in.({','.join(ids)})"
        for t in ("availability", "booking_payments", "booking_rooms", "transactions"):
            requests.delete(SB + f"/{t}?booking_id={q}", headers=H)
        requests.delete(SB + f"/bookings?id={q}", headers=H)


def login(ctx):
    pg = ctx.new_page()
    pg.goto(APP + "/login")
    pg.get_by_placeholder("Username or email address").fill(ENV["TEST_CARETAKER_EMAIL"])
    pg.locator("input[type=password]").fill(ENV["TEST_CARETAKER_PASSWORD"])
    pg.get_by_role("button", name="Sign In").click()
    pg.wait_for_url(lambda u: "/login" not in u, timeout=30000)
    pg.wait_for_load_state("networkidle")
    return pg


cleanup()
lagos = date.today()
with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME, headless=True)

    # 1. phone sign-in lands on the Today app
    phone = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id="Africa/Lagos")
    pg = login(phone)
    check("caretaker on a phone lands on the Today app", "/dashboard" in pg.url, pg.url)

    # 2. room type editor: hide Studio 2 from the website, check the website, put it back
    pg.goto(APP + "/dashboard?tab=units"); pg.wait_for_selector("text=Photos & price")
    btn = pg.get_by_role("button", name=re.compile(r"^Edit .*Studio 2$")); btn.tap(); pg.wait_for_selector("text=Showing on the website")
    pg.get_by_text("Showing on the website").tap(); pg.get_by_role("button", name="Save").tap()
    pg.wait_for_selector("text=not on website", timeout=15000)
    t = sb("/room_types?select=is_active,price_per_night&name=eq.Studio%202&property_id=eq." + PROP)[0]
    check("caretaker can take a room type off the website", t["is_active"] is False)
    ci, co = (lagos + timedelta(days=5)).isoformat(), (lagos + timedelta(days=6)).isoformat()
    pub = requests.get(APP + f"/api/availability?propertyId={PROP}&mode=roomTypes&from={ci}&to={co}").json()
    check("hidden room type disappears from the website", "Studio 2" not in [x["name"] for x in pub["roomTypes"]])
    pg.get_by_role("button", name=re.compile(r"^Edit .*Studio 2$")).tap(); pg.wait_for_selector("text=Hidden from the website")
    pg.get_by_text("Hidden from the website").tap(); pg.get_by_role("button", name="Save").tap()
    pg.wait_for_timeout(2500)
    t = sb("/room_types?select=is_active&name=eq.Studio%202&property_id=eq." + PROP)[0]
    pub = requests.get(APP + f"/api/availability?propertyId={PROP}&mode=roomTypes&from={ci}&to={co}").json()
    check("and back on the website", t["is_active"] is True and "Studio 2" in [x["name"] for x in pub["roomTypes"]])

    # 3. hold -> guest pays (simulated Paystack) -> confirmed by itself, emails sent
    r = pg.evaluate("""async ([prop, ci, co, guest]) => {
        const units = await (await fetch('/api/ops/today?propertyId=' + prop)).json();
        const b1 = units.units.find(u => u.unit_code === 'B1');
        const res = await fetch('/api/bookings', {method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({roomId: b1.id, propertyId: prop, mode:'single', guestName: guest, guestEmail: 'delivered@resend.dev',
            guestPhone: '08000000001', checkIn: ci, checkOut: co, isManualBooking: true, hold: true, bookingSource: 'whatsapp'})});
        return [res.status, await res.json()];
    }""", [PROP, ci, co, GUEST])
    check("caretaker hold creates a 15-minute hold with a pay link", r[0] == 200 and r[1].get("holdMinutes") == 15 and r[1].get("paystackUrl"), r[0])
    b = sb(f"/bookings?select=id,status,expires_at,paystack_reference,availability(status)&guest_name=eq.{GUEST}")[0]
    check("unit is held, not booked, until payment", b["status"] == "pending" and b["availability"] and b["availability"][0]["status"] == "held")
    guest = br.new_context(viewport={"width": 390, "height": 844})
    gp = guest.new_page(); gp.goto(r[1]["paystackUrl"]); gp.get_by_role("link", name=re.compile("^Pay")).click()
    gp.wait_for_selector("text=Booking Confirmed", timeout=30000)
    b = sb(f"/bookings?select=status,availability(status),booking_payments(amount,method)&guest_name=eq.{GUEST}")[0]
    check("payment confirms the booking by itself", b["status"] == "paid" and b["availability"][0]["status"] == "booked" and b["booking_payments"], b["status"])

    # 4. same unit can no longer be held by anyone else
    r2 = pg.evaluate("""async ([prop, ci, co]) => {
        const units = await (await fetch('/api/ops/today?propertyId=' + prop)).json();
        const b1 = units.units.find(u => u.unit_code === 'B1');
        const res = await fetch('/api/bookings', {method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({roomId: b1.id, propertyId: prop, mode:'single', guestName: 'E2E Test Guest', guestPhone: '08000000002',
            checkIn: ci, checkOut: co, isManualBooking: true, hold: true})});
        return res.status;
    }""", [PROP, ci, co])
    check("a second booking of the same unit and nights is refused", r2 == 409, r2)

    # 5. desktop sign-in lands on the full console, which a caretaker may now use
    desk = br.new_context(viewport={"width": 1440, "height": 900})
    dp = login(desk)
    check("caretaker on a computer lands on the console", "/crm" in dp.url, dp.url)
    dp.goto(APP + "/crm/properties"); dp.wait_for_load_state("networkidle")
    check("caretaker can open Properties in the console", "/crm/properties" in dp.url and dp.get_by_text("Studio in Garki").count() > 0)
    br.close()

cleanup()
print(f"\n{sum(ok)}/{len(ok)} checks passed")
sys.exit(0 if all(ok) else 1)
