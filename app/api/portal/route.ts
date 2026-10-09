import { env } from "cloudflare:workers";
import { issueOtp, normalizeEmail, OtpError, resendOtp, verifyOtp, type OtpPayload } from "@/lib/otp";
import { clearMockMailQueue, getMockMailQueue } from "@/lib/smtp";

export const runtime = "edge";

const categories: Record<string, string[]> = {
  Education: ["school", "teacher", "student", "college", "education", "learning"],
  Healthcare: ["hospital", "health", "doctor", "medicine", "ambulance", "clinic"],
  Agriculture: ["farm", "crop", "fertilizer", "irrigation", "agriculture", "seed"],
  Water: ["water", "well", "pump", "drain", "river", "irrigation"],
  Environment: ["waste", "pollution", "forest", "environment", "garbage"],
  Energy: ["electricity", "power", "solar", "energy", "streetlight"],
  "Urban Development": ["road", "traffic", "bridge", "urban", "transport"],
  Accessibility: ["disabled", "wheelchair", "accessibility", "ramp", "blind"],
  "Public Administration": ["certificate", "pension", "ration", "government", "service"],
  "Rural Livelihoods": ["livelihood", "self help", "artisan", "village", "rural"],
};

function classify(text: string) {
  const value = text.toLowerCase();
  let best = "Public Administration";
  let score = 0;
  for (const [category, words] of Object.entries(categories)) {
    const current = words.filter((word) => value.includes(word)).length;
    if (current > score) {
      best = category;
      score = current;
    }
  }
  return best;
}

function priority(text: string) {
  const value = text.toLowerCase();
  if (["emergency", "death", "unsafe", "contaminated", "accident", "hospital"].some((w) => value.includes(w))) return "Critical";
  if (["urgent", "school", "water", "crop", "road"].some((w) => value.includes(w))) return "High";
  return "Medium";
}

const progressByStatus: Record<string, number> = {
  "Submitted": 10,
  "Under Review": 22,
  "Validated": 38,
  "Assigned": 52,
  "In Progress": 68,
  "Pilot": 84,
  "Implemented": 100,
};

function workflowMessage(status: string) {
  const messages: Record<string,string> = {
    "Submitted": "The challenge has been received and queued for screening.",
    "Under Review": "Government reviewers are checking the problem statement and evidence.",
    "Validated": "The issue has been validated and is ready for institutional matching.",
    "Assigned": "An eligible university team has been assigned to prepare a solution approach.",
    "In Progress": "The assigned team is actively researching and building the solution.",
    "Pilot": "The solution is being tested with the affected community.",
    "Implemented": "The solution has been verified and implemented for community use.",
  };
  return messages[status] || "The challenge workflow was updated.";
}

function json(data: unknown, status = 200, extraHeaders: Record<string,string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
}

const allowedRoles = ["Citizen", "University", "Industry", "Government"];

function normalizeRole(value: unknown) {
  const role = String(value || "").trim();
  return allowedRoles.includes(role) ? role : "";
}

function sessionToken(request: Request) {
  return request.headers.get("cookie")?.match(/(?:^|; )js_session=([^;]+)/)?.[1] || "";
}

function otpErrorResponse(error: OtpError) {
  return json(
    { error: error.message, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) },
    error.status,
    error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {},
  );
}

function normalizeIndianMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return "";
}

function safeCookie(value: string) {
  return `js_session=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

function mockMailModeEnabled() {
  const mode = String((env as Record<string, string | undefined>).EMAIL_TEST_MODE ?? (env as Record<string, string | undefined>).TEST_MODE ?? "").toLowerCase();
  return mode === "mock";
}

// These starter records make the public workflow usable on a new deployment.
// INSERT OR IGNORE keeps them stable once a reviewer advances a stage.
async function ensureDemonstrationRecords(db: D1Database) {
  const created = "2026-09-01T09:00:00.000Z";
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO challenges (id,title,description,category,priority,status,district,address,latitude,longitude,submitter_name,submitter_type,contact,assigned_institution,industry_partner,impact_score,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("JH-24018","Fluoride contamination in village handpumps","Residents report unsafe drinking water and recurring dental health issues.","Water","Critical","In Progress","Palamu","Hussainabad block",24.04,84.08,"Community Water Group","Community organisation","9000000001","BIT Mesra","Tata Steel Foundation",94,created),
    db.prepare(`INSERT OR IGNORE INTO challenges (id,title,description,category,priority,status,district,address,latitude,longitude,submitter_name,submitter_type,contact,assigned_institution,industry_partner,impact_score,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("JH-23984","Post-harvest vegetable losses for small farmers","A cold-chain and local aggregation challenge affecting farmer incomes.","Agriculture","High","Pilot","Ranchi","Kanke block",23.43,85.32,"Farmer Producer Group","Community organisation","9000000002","BAU Ranchi","KissanPro Labs",86,created),
    db.prepare(`INSERT OR IGNORE INTO challenges (id,title,description,category,priority,status,district,address,latitude,longitude,submitter_name,submitter_type,contact,assigned_institution,industry_partner,impact_score,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("JH-23941","Accessible learning tools for tribal schools","Offline multilingual learning support is needed in low-connectivity blocks.","Education","High","Assigned","West Singhbhum","Chaibasa",22.55,85.80,"School Management Committee","Citizen","9000000003","Central University of Jharkhand",null,82,created),
    db.prepare(`INSERT OR IGNORE INTO challenges (id,title,description,category,priority,status,district,address,latitude,longitude,submitter_name,submitter_type,contact,assigned_institution,industry_partner,impact_score,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("JH-23876","Overflowing waste points near public market","Smart collection scheduling and citizen reporting required.","Environment","Medium","Validated","Dhanbad","Bank More",23.80,86.43,"Market Committee","Community organisation","9000000004",null,null,68,created),
  ]);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const db = env.DB;
    if (!db) return json({ error: "Database binding is unavailable." }, 503);

    if (action === "session") {
      const token = sessionToken(request);
      if (!token) return json({ authenticated: false }, 401);
      const session = await db.prepare("SELECT u.id,u.name,u.phone,u.email,u.role,s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? LIMIT 1").bind(token, new Date().toISOString()).first();
      if (!session) return json({ authenticated: false }, 401);
      return json({ authenticated: true, user: session });
    }

    if (action === "mockInbox") {
      if (!mockMailModeEnabled()) return json({ error: "Mock email delivery is disabled in this environment." }, 404);
      return json({ ok: true, messages: getMockMailQueue().slice(-25).map((message) => ({
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        createdAt: message.createdAt,
      })) });
    }

    if (action === "clearMockInbox") {
      if (!mockMailModeEnabled()) return json({ error: "Mock email delivery is disabled in this environment." }, 404);
      clearMockMailQueue();
      return json({ ok: true });
    }

    if (action === "villageSearch") {
      const q = (url.searchParams.get("q") || "").trim();
      if (q.length < 2) return json({ villages: [] });
      const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
      searchUrl.searchParams.set("q", `${q}, Jharkhand, India`);
      searchUrl.searchParams.set("format", "jsonv2");
      searchUrl.searchParams.set("addressdetails", "1");
      searchUrl.searchParams.set("limit", "8");
      searchUrl.searchParams.set("dedupe", "1");
      const response = await fetch(searchUrl, { headers: { "User-Agent": "JanSamadhan/1.0 societal-innovation-portal" } });
      if (!response.ok) return json({ error: "Village search is temporarily unavailable." }, 502);
      const results = await response.json() as Array<Record<string, unknown>>;
      const villages = results.map((item) => {
        const address = (item.address || {}) as Record<string,string>;
        return {
          name: address.village || address.hamlet || address.town || address.city || String(item.display_name || "").split(",")[0],
          displayName: item.display_name,
          latitude: Number(item.lat),
          longitude: Number(item.lon),
          district: address.county || address.state_district || "",
          state: address.state || "Jharkhand",
          type: item.type || "place",
          source: "OpenStreetMap / Nominatim",
        };
      }).filter((v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude));
      return json({ villages });
    }

    if (!db) return json({ error: "Database binding is unavailable." }, 503);
    await ensureDemonstrationRecords(db);
    const [challengeResult, projectResult, partnerResult, notificationResult, updateResult, voteResult, proposalResult] = await db.batch([
      db.prepare("SELECT * FROM challenges ORDER BY created_at DESC LIMIT 100"),
      db.prepare("SELECT * FROM projects ORDER BY created_at DESC LIMIT 50"),
      db.prepare("SELECT * FROM partners ORDER BY created_at DESC LIMIT 50"),
      db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 30"),
      db.prepare("SELECT * FROM progress_updates ORDER BY created_at DESC LIMIT 100"),
      db.prepare("SELECT challenge_id, COUNT(*) AS votes FROM challenge_votes GROUP BY challenge_id"),
      db.prepare("SELECT * FROM solution_proposals ORDER BY created_at DESC LIMIT 100"),
    ]);
    return json({
      challenges: challengeResult.results,
      projects: projectResult.results,
      partners: partnerResult.results,
      notifications: notificationResult.results,
      updates: updateResult.results,
      votes: voteResult.results,
      proposals: proposalResult.results,
    });
  } catch (error) {
    console.error("Portal load failed", error);
    return json({ error: "The collaboration database is temporarily unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const db = env.DB;
    if (!db) return json({ error: "Database binding is unavailable." }, 503);
    await ensureDemonstrationRecords(db);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "challenge");
    const now = new Date().toISOString();

    // ---- Email OTP authentication (server-side; see lib/otp.ts) ----
    // requestOtp -> email a 6-digit code; resendOtp -> new code after cooldown;
    // verifyOtp -> consume the code once and open the existing js_session cookie session.
    if (action === "requestOtp") {
      const mode = body.mode === "signup" ? "signup" : "login";
      const email = normalizeEmail(body.email);
      if (!email) return json({ error: "Enter a valid email address." }, 400);
      let payload: OtpPayload;
      if (mode === "signup") {
        const name = String(body.name || "").trim().replace(/\s+/g, " ");
        const phone = normalizeIndianMobile(String(body.phone || ""));
        const role = normalizeRole(body.role);
        if (name.length < 2 || name.length > 80) return json({ error: "Enter your full name." }, 400);
        if (!phone) return json({ error: "Enter a valid 10-digit mobile number." }, 400);
        if (!role) return json({ error: "Choose a valid access role." }, 400);
        const [byEmail, byPhone] = await db.batch<{ id: string }>([
          db.prepare("SELECT id FROM users WHERE lower(email) = ? LIMIT 1").bind(email),
          db.prepare("SELECT id FROM users WHERE phone = ? LIMIT 1").bind(phone),
        ]);
        if (byEmail.results.length) return json({ error: "An account with this email already exists. Please log in instead." }, 409);
        if (byPhone.results.length) return json({ error: "This mobile number is already registered with another account." }, 409);
        payload = { name, phone, role };
      } else {
        const user = await db.prepare("SELECT id FROM users WHERE lower(email) = ? LIMIT 1").bind(email).first<{ id: string }>();
        if (!user) return json({ error: "No account found for this email. Please create an account first." }, 404);
        const role = normalizeRole(body.role);
        payload = role ? { role } : {};
      }
      const issued = await issueOtp(db, request, email, mode, payload);
      return json({ ok: true, message: `A 6-digit OTP was sent to ${issued.maskedEmail}.`, ...issued });
    }

    if (action === "resendOtp") {
      const email = normalizeEmail(body.email);
      const challengeId = String(body.challengeId || "");
      if (!email || !challengeId) return json({ error: "This OTP session is invalid. Please start again." }, 400);
      const issued = await resendOtp(db, request, challengeId, email);
      return json({ ok: true, message: `A new OTP was sent to ${issued.maskedEmail}.`, ...issued });
    }

    if (action === "verifyOtp") {
      const email = normalizeEmail(body.email);
      const challengeId = String(body.challengeId || "");
      const otp = String(body.otp || "").replace(/\D/g, "");
      if (!email || !challengeId) return json({ error: "This OTP session is invalid. Please start again." }, 400);
      const { purpose, payload } = await verifyOtp(db, challengeId, email, otp);

      let user: { id: string; name: string; phone: string; email: string; role: string } | null;
      if (purpose === "signup") {
        const name = String(payload.name || "");
        const phone = String(payload.phone || "");
        const role = normalizeRole(payload.role) || "Citizen";
        const userId = crypto.randomUUID();
        try {
          await db.prepare("INSERT INTO users (id,name,phone,email,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(userId, name, phone, email, role, now, now).run();
        } catch {
          return json({ error: "This email or mobile number was registered meanwhile. Please log in instead." }, 409);
        }
        user = { id: userId, name, phone, email, role };
      } else {
        user = await db.prepare("SELECT id,name,phone,email,role FROM users WHERE lower(email) = ? LIMIT 1").bind(email).first();
        if (!user) return json({ error: "Account not found. Please create an account." }, 404);
        const role = normalizeRole(payload.role);
        if (role && role !== user.role) {
          await db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").bind(role, now, user.id).run();
          user = { ...user, role };
        }
      }

      const sessionTokenValue = crypto.randomUUID() + crypto.randomUUID();
      const expires = new Date(Date.now() + 7*24*60*60*1000).toISOString();
      await db.batch([
        db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
        db.prepare("INSERT INTO sessions (id,user_id,token,expires_at,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),user.id,sessionTokenValue,expires,now),
      ]);
      return json({ ok: true, user }, 200, { "Set-Cookie": safeCookie(sessionTokenValue) });
    }

    if (action === "logout") {
      const token = sessionToken(request);
      if (token) await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
      return json({ ok: true }, 200, { "Set-Cookie": "js_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
    }

    if (action === "challenge") {
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const district = String(body.district || "").trim();
      const submitterName = String(body.submitterName || "").trim();
      const submitterType = String(body.submitterType || "Citizen").trim();
      const contact = String(body.contact || "").trim();
      if (title.length < 8 || description.length < 30 || !district || !submitterName || !contact) {
        return json({ error: "Please complete all required challenge details." }, 400);
      }
      const duplicate = await db.prepare(
        "SELECT id, title FROM challenges WHERE district = ? AND lower(title) = lower(?) LIMIT 1"
      ).bind(district, title).first();
      if (duplicate) return json({ error: "A similar challenge already exists in this district.", duplicate }, 409);

      const id = "JH-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      const detectedCategory = body.category ? String(body.category) : classify(title + " " + description);
      const detectedPriority = priority(title + " " + description);
      const impactScore = detectedPriority === "Critical" ? 92 : detectedPriority === "High" ? 78 : 62;
      const notificationId = crypto.randomUUID();
      const updateId = crypto.randomUUID();
      await db.batch([
        db.prepare(`INSERT INTO challenges
          (id,title,description,category,priority,status,district,village,address,latitude,longitude,submitter_name,submitter_type,contact,evidence_key,assigned_institution,industry_partner,impact_score,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, title, description, detectedCategory, detectedPriority, "Submitted", district, body.village || null, body.address || null, body.latitude || null, body.longitude || null, submitterName, submitterType, contact, body.evidenceKey || null, null, null, impactScore, now),
        db.prepare("INSERT INTO notifications (id,title,message,audience,is_read,created_at) VALUES (?,?,?,?,?,?)")
          .bind(notificationId, "New challenge submitted", `${title} was submitted from ${district}.`, "Government", 0, now),
        db.prepare("INSERT INTO progress_updates (id,challenge_id,stage,progress,message,actor,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(updateId, id, "Submitted", progressByStatus.Submitted, "Challenge received and queued for automated screening.", "JanSamadhan system", now),
      ]);
      return json({ ok: true, id, category: detectedCategory, priority: detectedPriority }, 201);
    }

    if (action === "updateChallenge") {
      const id = String(body.id || "");
      const status = String(body.status || "");
      const allowed = ["Submitted", "Under Review", "Validated", "Assigned", "In Progress", "Pilot", "Implemented"];
      if (!id || !allowed.includes(status)) return json({ error: "Invalid workflow update." }, 400);
      const updateResult = await db.prepare("UPDATE challenges SET status = ?, assigned_institution = ?, industry_partner = ? WHERE id = ?")
        .bind(status, body.assignedInstitution || null, body.industryPartner || null, id).run();
      if (!updateResult.meta.changes) return json({ error: "Challenge record was not found." }, 404);
      const progress = progressByStatus[status];
      await db.prepare("INSERT INTO progress_updates (id,challenge_id,stage,progress,message,actor,created_at) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), id, status, progress, workflowMessage(status), String(body.actor || "Government workflow"), now).run();
      return json({ ok: true, progress });
    }

    if (action === "challengeVote") {
      const challengeId = String(body.challengeId || "").trim();
      const token = sessionToken(request);
      if (!challengeId || !token) return json({ error: "Login with email OTP before voting." }, 401);
      const sessionUser = await db.prepare("SELECT u.phone FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? LIMIT 1").bind(token, now).first<{phone:string}>();
      const phone = sessionUser?.phone || "";
      if (!phone) return json({ error: "Your login session has expired. Please login again." }, 401);
      const exists = await db.prepare("SELECT id FROM challenges WHERE id = ? LIMIT 1").bind(challengeId).first();
      if (!exists) return json({ error: "Challenge not found." }, 404);
      try {
        await db.prepare("INSERT INTO challenge_votes (id,challenge_id,voter_phone,created_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(), challengeId, phone, now).run();
      } catch {
        return json({ error: "You have already supported this challenge." }, 409);
      }
      const count = await db.prepare("SELECT COUNT(*) AS votes FROM challenge_votes WHERE challenge_id = ?").bind(challengeId).first<{votes:number}>();
      return json({ ok: true, votes: Number(count?.votes || 0) }, 201);
    }

    if (action === "challengeComment") {
      const challengeId = String(body.challengeId || "").trim();
      const authorName = String(body.authorName || "").trim();
      const authorRole = String(body.authorRole || "Citizen").trim();
      const message = String(body.message || "").trim();
      if (!challengeId || authorName.length < 2 || message.length < 5) return json({ error: "Please provide your name and a useful comment." }, 400);
      await db.prepare("INSERT INTO challenge_comments (id,challenge_id,author_name,author_role,message,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), challengeId, authorName, authorRole, message, now).run();
      return json({ ok: true }, 201);
    }

    if (action === "solutionProposal") {
      const challengeId = String(body.challengeId || "").trim();
      const proposerName = String(body.proposerName || "").trim();
      const proposerRole = String(body.proposerRole || "University").trim();
      const institution = String(body.institution || "").trim();
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      if (!challengeId || proposerName.length < 2 || institution.length < 2 || title.length < 5 || description.length < 20) return json({ error: "Complete the solution proposal details." }, 400);
      const challenge = await db.prepare("SELECT title FROM challenges WHERE id = ? LIMIT 1").bind(challengeId).first<{title:string}>();
      if (!challenge) return json({ error: "Challenge not found." }, 404);
      const id = "SOL-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      await db.batch([
        db.prepare("INSERT INTO solution_proposals (id,challenge_id,proposer_name,proposer_role,institution,title,description,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id, challengeId, proposerName, proposerRole, institution, title, description, "Submitted", now),
        db.prepare("INSERT INTO notifications (id,title,message,audience,is_read,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(), "New solution proposal", `${institution} submitted a solution for ${challenge.title}.`, "Government", 0, now),
      ]);
      return json({ ok: true, id, status: "Submitted" }, 201);
    }

    if (action === "publicReview") {
      const projectId = String(body.projectId || "").trim();
      const projectTitle = String(body.projectTitle || "").trim();
      const name = String(body.name || "").trim();
      const rating = Math.max(1, Math.min(5, Number(body.rating || 0)));
      const review = String(body.review || "").trim();
      if (!projectId || !projectTitle || name.length < 2 || review.length < 10) return json({ error: "Please provide a complete review." }, 400);
      await db.prepare("INSERT INTO notifications (id,title,message,audience,is_read,created_at) VALUES (?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), `Public review · ${projectTitle}`, `${rating}/5 from ${name}: ${review}`, `Government:${projectId}`, 0, now).run();
      return json({ ok: true }, 201);
    }

    if (action === "projectGovernmentUpdate") {
      const projectId = String(body.projectId || "").trim();
      const challengeId = String(body.challengeId || "").trim();
      const projectTitle = String(body.projectTitle || "").trim();
      const message = String(body.message || "").trim();
      if (!projectId || !challengeId || !projectTitle || message.length < 12) return json({ error: "A clear project update is required." }, 400);
      await db.batch([
        db.prepare("INSERT INTO progress_updates (id,challenge_id,stage,progress,message,actor,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), challengeId, "Government update", 0, message, `Project ${projectId}`, now),
        db.prepare("INSERT INTO notifications (id,title,message,audience,is_read,created_at) VALUES (?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), `Project update: ${projectTitle}`, message, "Government", 0, now),
      ]);
      return json({ ok: true }, 201);
    }

    if (action === "project") {
      const title = String(body.title || "").trim();
      const challengeId = String(body.challengeId || "").trim();
      const institution = String(body.institution || "").trim();
      if (!title || !challengeId || !institution) return json({ error: "Project title, challenge and institution are required." }, 400);
      const id = "PRJ-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      await db.prepare(`INSERT INTO projects
        (id,challenge_id,title,stage,progress,institution,industry,faculty_lead,next_milestone,due_date,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, challengeId, title, body.stage || "Proposal", Number(body.progress || 10), institution, body.industry || null, body.facultyLead || null, body.nextMilestone || null, body.dueDate || null, now).run();
      return json({ ok: true, id }, 201);
    }

    if (action === "partnerMessage") {
      const partnerId = String(body.partnerId || "").trim();
      const partnerName = String(body.partnerName || "").trim();
      const sender = String(body.sender || "").trim();
      const contact = String(body.contact || "").trim();
      const message = String(body.message || "").trim();
      if (!partnerId || !partnerName || sender.length < 2 || contact.length < 5 || message.length < 10) {
        return json({ error: "Please complete your name, contact and message." }, 400);
      }
      await db.prepare("INSERT INTO notifications (id,title,message,audience,is_read,created_at) VALUES (?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), `Partner message for ${partnerName}`, `${sender} (${contact}): ${message}`, `Partner:${partnerId}`, 0, now).run();
      return json({ ok: true, message: "Partner message routed successfully." }, 201);
    }

    if (action === "serviceBooking") {
      const serviceType = String(body.serviceType || "").trim();
      const facilityId = String(body.facilityId || "").trim();
      const facilityName = String(body.facilityName || "").trim();
      const citizenName = String(body.citizenName || "").trim();
      const phone = String(body.phone || "").replace(/\D/g, "");
      const district = String(body.district || "").trim();
      const bookingDate = String(body.bookingDate || "").trim();
      const timeSlot = String(body.timeSlot || "").trim();
      const allowedServices = ["Hospital", "Ambulance", "Fertilizer", "Water Test", "Soil Test"];
      if (!allowedServices.includes(serviceType) || !facilityId || !facilityName || !citizenName || phone.length !== 10 || !district || !bookingDate || !timeSlot) {
        return json({ error: "Please complete all required booking details with a valid 10-digit mobile number." }, 400);
      }
      const id = "BKG-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      const notificationId = crypto.randomUUID();
      const quantity = body.quantity ? Math.max(1, Math.min(1000, Number(body.quantity))) : null;
      const doctorName = String(body.doctorName || "").trim();
      const doctorSpecialty = String(body.doctorSpecialty || "").trim();
      const userNotes = String(body.notes || "").trim();
      const bookingNotes = [doctorName ? `Doctor: ${doctorName}${doctorSpecialty ? ` (${doctorSpecialty})` : ""}` : "", userNotes].filter(Boolean).join(" · ") || null;
      const isAmbulance = serviceType === "Ambulance";
      await db.batch([
        db.prepare(`INSERT INTO service_bookings
          (id,service_type,facility_id,facility_name,citizen_name,phone,district,booking_date,time_slot,quantity,notes,latitude,longitude,status,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, serviceType, facilityId, facilityName, citizenName, phone, district, bookingDate, timeSlot, quantity, bookingNotes, body.latitude ?? null, body.longitude ?? null, isAmbulance ? "Dispatch requested" : "Requested", now),
        db.prepare("INSERT INTO notifications (id,title,message,audience,is_read,created_at) VALUES (?,?,?,?,?,?)")
          .bind(notificationId, isAmbulance ? "New ambulance dispatch request" : `${serviceType} booking received`, isAmbulance ? `${id}: dispatch requested for ${citizenName} in ${district}. Open Ambulance Control to assign a vehicle.` : `${id} was requested for ${facilityName} in ${district}.`, isAmbulance ? "Ambulance control room" : "Government", 0, now),
      ]);
      return json({ ok: true, id, status: isAmbulance ? "Dispatch requested" : "Requested", message: isAmbulance ? "Ambulance control room was notified." : "Booking request submitted successfully." }, 201);
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    if (error instanceof OtpError) return otpErrorResponse(error);
    console.error("Portal mutation failed", error);
    return json({ error: "Could not save your request. Please try again." }, 500);
  }
}
