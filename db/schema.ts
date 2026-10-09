import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const challenges = sqliteTable("challenges", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("Medium"),
  status: text("status").notNull().default("Submitted"),
  district: text("district").notNull(),
  village: text("village"),
  address: text("address"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  submitterName: text("submitter_name").notNull(),
  submitterType: text("submitter_type").notNull(),
  contact: text("contact").notNull(),
  evidenceKey: text("evidence_key"),
  assignedInstitution: text("assigned_institution"),
  industryPartner: text("industry_partner"),
  impactScore: integer("impact_score").notNull().default(50),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_challenges_created_at").on(table.createdAt),
  index("idx_challenges_district_title").on(table.district, table.title),
  index("idx_challenges_status").on(table.status),
]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id").notNull(),
  title: text("title").notNull(),
  stage: text("stage").notNull().default("Proposal"),
  progress: integer("progress").notNull().default(10),
  institution: text("institution").notNull(),
  industry: text("industry"),
  facultyLead: text("faculty_lead"),
  nextMilestone: text("next_milestone"),
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_projects_created_at").on(table.createdAt),
  index("idx_projects_challenge_id").on(table.challengeId),
]);

export const partners = sqliteTable("partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  expertise: text("expertise").notNull(),
  district: text("district"),
  engagement: text("engagement").notNull().default("Available"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_partners_created_at").on(table.createdAt)]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  audience: text("audience").notNull().default("All"),
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_notifications_created_at").on(table.createdAt)]);

export const serviceBookings = sqliteTable("service_bookings", {
  id: text("id").primaryKey(),
  serviceType: text("service_type").notNull(),
  facilityId: text("facility_id").notNull(),
  facilityName: text("facility_name").notNull(),
  citizenName: text("citizen_name").notNull(),
  phone: text("phone").notNull(),
  district: text("district").notNull(),
  bookingDate: text("booking_date").notNull(),
  timeSlot: text("time_slot").notNull(),
  quantity: integer("quantity"),
  notes: text("notes"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  status: text("status").notNull().default("Requested"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_service_bookings_created_at").on(table.createdAt),
  index("idx_service_bookings_phone").on(table.phone),
  index("idx_service_bookings_type_status").on(table.serviceType, table.status),
]);

export const progressUpdates = sqliteTable("progress_updates", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id").notNull(),
  stage: text("stage").notNull(),
  progress: integer("progress").notNull(),
  message: text("message").notNull(),
  actor: text("actor").notNull().default("JanSamadhan system"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_progress_updates_challenge_created").on(table.challengeId, table.createdAt),
  index("idx_progress_updates_created_at").on(table.createdAt),
]);


export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email").notNull(),
  role: text("role").notNull().default("Citizen"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_users_phone").on(table.phone), index("idx_users_email").on(table.email)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_sessions_token").on(table.token), index("idx_sessions_expires").on(table.expiresAt)]);

export const challengeVotes = sqliteTable("challenge_votes", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id").notNull(),
  voterPhone: text("voter_phone").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_challenge_votes_challenge").on(table.challengeId),
]);

export const challengeComments = sqliteTable("challenge_comments", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id").notNull(),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_challenge_comments_challenge").on(table.challengeId, table.createdAt)]);

export const solutionProposals = sqliteTable("solution_proposals", {
  id: text("id").primaryKey(),
  challengeId: text("challenge_id").notNull(),
  proposerName: text("proposer_name").notNull(),
  proposerRole: text("proposer_role").notNull(),
  institution: text("institution").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("Submitted"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_solution_proposals_challenge").on(table.challengeId, table.createdAt)]);

export const otpChallenges = sqliteTable("otp_challenges", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  purpose: text("purpose").notNull(),
  otpHash: text("otp_hash").notNull(),
  payload: text("payload"),
  attempts: integer("attempts").notNull().default(0),
  sendCount: integer("send_count").notNull().default(1),
  lastSentAt: text("last_sent_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  consumedAt: text("consumed_at"),
  requestIp: text("request_ip"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_otp_challenges_email_sent").on(table.email, table.lastSentAt),
  index("idx_otp_challenges_ip_created").on(table.requestIp, table.createdAt),
  index("idx_otp_challenges_created").on(table.createdAt),
]);
