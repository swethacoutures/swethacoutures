# Attendance — from the fingerprint machine to payroll

Everything the shop needs to run attendance, in the order you would actually do it.
Written for the owner, not for a developer.

---

## 1. How it works, in one picture

```
  Employee presses finger
            │
            ▼
  ZKTeco K40 Pro  ──plain HTTP──▶  punch.swethacoutures.com   (Cloudflare Worker)
   (the terminal)                            │
                                             │ HTTPS
                                             ▼
                                    swethacoutures.com/iclock/cdata
                                       (our ingest endpoint)
                                             │
                                             ▼
                                        Firestore
                                    devicePunches (raw presses)
                                             │
                                             ▼
                                    attendanceRecords (one row per person per day)
                                             │
                                             ▼
                                    Attendance → Payroll → salary
```

**The device pushes to us.** We never dial into it. It contacts the server every ~30 seconds
whether or not anybody has punched, which is why the Attendance page can tell you the
terminal is alive even on a quiet afternoon.

### What each layer means

| Layer | What it holds | Where you see it |
|---|---|---|
| **Punch** | One press of one finger, exactly as the device reported it | Attendance → **Punches** |
| **Record** | One person, one day: first punch in, last punch out, hours | Attendance → **Records** |
| **Employee** | The person, their pay basis and rate | Attendance → **Employees** |
| **Payroll** | A month of records turned into money | Attendance → **Payroll** |

A punch is never edited. If a day is wrong you correct the **record**, and that correction
wins over the device from then on.

---

## 2. The clock problem — why it kept coming back, and the fix

### What was happening

The K40's own clock drifts, and it loses the time completely whenever it is unplugged long
enough to flatten its internal coin cell. Setting it on the keypad appears to work and then
"becomes normal" again later, because nothing was keeping it right.

Your device was showing **16-08-26 Sunday, 21:09** — the wrong date *and* the wrong time.
Every punch it recorded was being stamped with that wrong clock, which means the hours in
Payroll would have been wrong too.

### The fix (already done, nothing for you to do)

**The server now sets the device's clock.** Our ingest endpoint pushes the correct Indian
time to the terminal on its command poll, and repeats it every 6 hours. The device can no
longer drift, and it re-learns the time by itself within a minute of any power cut.

You will also find a **Sync clock** button on **Attendance → the device bar at the top**, for
when you are standing in front of the machine and do not want to wait. Press it and the
device corrects itself on its next check-in, usually inside 30 seconds.

> Why the server and not the keypad: a punch is worth exactly as much as the clock that
> stamped it. The server knows the real time; the terminal does not.

### If the time is still wrong after that

Check that the device is actually reaching us, because a device that cannot talk to the
server cannot be corrected by it:

1. On the device: **M/OK → COMM. → Ethernet**
2. Confirm **Gateway** and **DNS** are *not* `0.0.0.0`. They should be roughly:
   - IP Address: `192.168.1.xxx`
   - Subnet Mask: `255.255.255.0`
   - **Gateway: `192.168.1.1`**
   - **DNS: `8.8.8.8`**

⚠️ **This is the single most common cause of "the device is not working".** A terminal with
a static IP but no gateway can still be pinged from a PC on the same network, so it *looks*
perfectly healthy — but it cannot reach the internet at all. This exact setting cost two days
of debugging in August. Check it **before** anything else.

3. Then **M/OK → COMM. → Cloud Server Setting**:
   - Server Address: `punch.swethacoutures.com`
   - Server Port: `80`
   - Enable Domain Name: **ON**

---

## 3. First-time setup, step by step

Do this once. If the device is already sending punches, skip to section 4.

### Step 1 — Put the employee on the device

On the terminal:

1. **M/OK** → **User Mgt.** → **New User**
2. **User ID** — this is the number that matters. Write it down. Give each person a simple
   number: `1`, `2`, `3`…
3. **Name** — type it if the keypad allows; it is optional, we can pull it in later.
4. **Fingerprint** → place the finger 3 times as prompted.
5. **ESC** to save.

Repeat for every employee. **Keep a written list of ID → person.** That number is the only
thing the device sends us.

### Step 2 — Approve the device in the app (once, ever)

Open **Attendance**. If the terminal has contacted us, a bar appears at the top saying a
device is awaiting approval. Press **Approve**.

Anything the device sent while it was waiting is backfilled at that moment — nothing is lost.

> Why approval exists: the ingest endpoint is public. Without this step, anyone who found
> the address could invent attendance for your shop. Punches from an unapproved device are
> stored but kept out of payroll until you vouch for it.

### Step 3 — Let the employees appear

The first time someone punches, they appear automatically on **Attendance → Employees** with
their device ID as their name (e.g. an employee called `1`).

You do not have to create them by hand.

### Step 4 — Give them real names

Two ways:

- **Attendance → Employees → "Get names from device"** — pulls the names you typed into the
  terminal. A name you have edited in the app is never overwritten.
- Or click the employee and type the name yourself.

### Step 5 — Set how each person is paid

**Attendance → Employees → click the employee.**

| Pay basis | Meaning |
|---|---|
| **Monthly salary** | A fixed monthly figure, paid by the hour underneath (see §5) |
| **Daily wage** | A flat amount for each day they check in |
| **Rate per hour** | Rate × the hours actually worked |

Until this is set, the person shows **"Needs setup"** in Payroll and contributes ₹0. That is
deliberate — it is better than silently paying nothing.

### Step 6 — Set the shop's working rules

**Attendance → Payroll → Working rules.** One set of rules for the whole shop:

- Office start / end time
- Standard hours per day (the divisor behind the hourly rate)
- Unpaid break minutes
- Weekly off days (Sunday by default)
- How close together two presses count as one (default 5 minutes)
- The shortest absence that counts as a break (default 20 minutes)

The dialog shows a live worked example on ₹10,000 before you save, so you can see exactly
what your change does to somebody's pay.

---

## 4. The daily routine

**There isn't one.** Employees punch; everything else happens by itself.

What you might do:

- **Admin Dashboard → Attendance Today** — who is in, who has gone home, who has not turned
  up, and what today's wages come to.
- **Attendance → Records** — correct a day if somebody forgot to punch out. A corrected day
  is marked and the device can never overwrite it again.
- **Attendance → Punches** — the raw feed, if you ever need to see exactly what the machine
  sent.

---

## 5. How the hours become money

Monthly salary is **paid by the hour**:

```
hourly rate = monthly salary ÷ (working days in the month × standard hours per day)
pay         = hourly rate × hours actually worked
```

So:

- Arriving late and staying on still earns a full day.
- Leaving early docks only the hours missed.
- Hours beyond a full month are **overtime, paid at the same rate** — there is no cap.

### Lunch comes from the punches, not a guess

- **4+ punches in a day** (out for lunch, back in) — the real gap is excluded, exactly.
- **2 punches only** (nobody punched out for lunch) — the configured break is deducted.
- Repeated presses within the "same press" window are treated as one. People press twice
  when they are not sure it read, and without this the day gets shredded into fragments.

### Paying

**Attendance → Payroll** → pick the month → **Mark paid** per person. Got it wrong? **Undo**
puts it back, and leaves a note showing what was undone. Nothing is ever silently rewritten.

Export the whole month to Excel with **Export Excel**.

---

## 6. When something looks wrong

| What you see | What it means | What to do |
|---|---|---|
| **"Fingerprint device has stopped reporting"** | No contact for 15+ minutes | Check power and network cable, then the Ethernet settings in §2 |
| Device time is wrong | Clock drifted or was reset by a power cut | Press **Sync clock**; it also fixes itself within 6 hours |
| Employee shows as a **number** | Nobody has named them yet | Employees → Get names from device, or type it |
| **"Needs setup"** in Payroll | No pay basis set | Employees → click them → choose basis and amount |
| Hours look far too low | Someone forgot to punch out | Records → edit the day; your correction wins permanently |
| Everyone shows **Absent** today | It is a weekly off day, or the device is offline | Check the device bar at the top of Attendance |
| A punch is a duplicate | Somebody pressed twice | Punches → delete it. The day is *not* recalculated automatically — fix the day on Records, where the change is visible and logged |

Every hand edit, deletion and payment is recorded in **Attendance → Activity** with who did
it, when, and what changed.

---

## 7. Where things live

| Thing | Where |
|---|---|
| Device settings | The terminal: **M/OK → COMM.** |
| Approve / block a device, **Sync clock** | Attendance, top bar |
| Raw punches | Attendance → Punches |
| Day records, corrections | Attendance → Records |
| People and pay | Attendance → Employees |
| Salary, Mark paid, Excel | Attendance → Payroll |
| Shop rules | Attendance → Payroll → Working rules |
| Audit trail | Attendance → Activity |
| Today at a glance | Admin Dashboard |

Technical detail for whoever maintains the code: `docs/BIOMETRIC_DEVICE.md` and
`project-memory/present.md`.
