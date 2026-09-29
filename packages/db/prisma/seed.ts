import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();
const pw = (p: string) => hashSync(p, 10);

async function main() {
  // Clean slate for dev seeding
  await prisma.hospital.deleteMany();

  const hospital = await prisma.hospital.create({
    data: {
      name: "City Care Hospital",
      city: "Lahore",
      address: "12 Main Boulevard, Gulberg",
      phone: "+924235700123",
      whatsappNumber: "+923001234567",
      waPhoneNumberId: "demo-phone-number-id",
    },
  });
  const h = hospital.id;

  // ── Users ──
  const mkUser = (name: string, phone: string, role: any, email?: string) =>
    prisma.user.create({
      data: { hospitalId: h, name, phone, role, passwordHash: pw("password123"), email },
    });

  const owner = await mkUser("Dr. Owner", "+923000000001", "OWNER", "owner@citycare.pk");
  await mkUser("Admin Ali", "+923000000002", "ADMIN");
  const recep = await mkUser("Sana Receptionist", "+923000000003", "RECEPTIONIST");
  const nurseUser = await mkUser("Nurse Ayesha", "+923000000004", "NURSE");
  const labUser = await mkUser("Lab Tech Bilal", "+923000000005", "LAB_STAFF");

  const docUser1 = await mkUser("Dr. Ahmed Khan", "+923000000011", "DOCTOR");
  const docUser2 = await mkUser("Dr. Sara Malik", "+923000000012", "DOCTOR");

  const schedule = [
    { day: "MON", slots: ["10:00", "10:20", "10:40", "11:00", "11:20", "18:00", "18:20"], slotMinutes: 20 },
    { day: "TUE", slots: ["10:00", "10:20", "10:40", "11:00", "11:20", "18:00", "18:20"], slotMinutes: 20 },
    { day: "WED", slots: ["10:00", "10:20", "10:40", "11:00", "11:20"], slotMinutes: 20 },
    { day: "THU", slots: ["10:00", "10:20", "10:40", "11:00", "11:20", "18:00", "18:20"], slotMinutes: 20 },
    { day: "FRI", slots: ["10:00", "10:20", "10:40", "11:00"], slotMinutes: 20 },
    { day: "SAT", slots: ["10:00", "10:20", "10:40"], slotMinutes: 20 },
  ];

  const doctor1 = await prisma.doctor.create({
    data: {
      hospitalId: h, userId: docUser1.id, specialization: "General Physician",
      qualification: "MBBS, FCPS", pmcNumber: "12345-P", consultationFee: 1500,
      bio: "15 years experience in general medicine.", schedule,
    },
  });
  const doctor2 = await prisma.doctor.create({
    data: {
      hospitalId: h, userId: docUser2.id, specialization: "Pediatrician",
      qualification: "MBBS, DCH", pmcNumber: "67890-P", consultationFee: 2000,
      bio: "Child specialist, 10 years experience.", schedule,
    },
  });

  // ── Patients ──
  const patients = [];
  const names = ["Muhammad Usman", "Fatima Noor", "Ali Raza", "Ayesha Siddiqui", "Bilal Hussain",
    "Zainab Tariq", "Hassan Javed", "Maryam Aslam", "Omar Farooq", "Sadia Khan"];
  for (let i = 0; i < names.length; i++) {
    patients.push(await prisma.patient.create({
      data: {
        hospitalId: h, name: names[i], phone: `+92321${String(1000000 + i * 137).slice(0, 7)}`,
        gender: i % 2 ? "Female" : "Male", createdVia: i % 3 === 0 ? "WHATSAPP" : "WALK_IN",
      },
    }));
  }

  // ── Appointments (today, mixed statuses) ──
  const today = new Date();
  const at = (hh: number, mm: number) => {
    const d = new Date(today); d.setHours(hh, mm, 0, 0); return d;
  };
  const statuses: any[] = ["CHECKED_IN", "CHECKED_IN", "CONFIRMED", "CONFIRMED", "PENDING", "IN_CONSULTATION"];
  for (let i = 0; i < 6; i++) {
    await prisma.appointment.create({
      data: {
        hospitalId: h, patientId: patients[i].id,
        doctorId: i % 2 ? doctor2.id : doctor1.id,
        bookedById: recep.id, source: "PORTAL",
        scheduledAt: at(10 + Math.floor(i / 2), (i % 2) * 20),
        tokenNumber: statuses[i] === "CHECKED_IN" || statuses[i] === "IN_CONSULTATION" ? i + 1 : null,
        status: statuses[i], visitType: i % 3 === 0 ? "FOLLOW_UP" : "FIRST",
      },
    });
  }
  // One completed visit with prescription
  const doneAppt = await prisma.appointment.create({
    data: {
      hospitalId: h, patientId: patients[6].id, doctorId: doctor1.id, bookedById: recep.id,
      source: "WHATSAPP", scheduledAt: at(9, 0), tokenNumber: 0, status: "COMPLETED", visitType: "FIRST",
    },
  });
  const visit = await prisma.visit.create({
    data: {
      hospitalId: h, appointmentId: doneAppt.id, patientId: patients[6].id, doctorId: doctor1.id,
      vitals: { bp: "120/80", pulse: 88, temp: "101°F" },
      chiefComplaint: "Fever and body ache for 2 days", diagnosis: "Viral fever",
      doctorNotes: "Mild viral illness. Hydration advised.", status: "COMPLETED", completedAt: new Date(),
    },
  });
  await prisma.prescription.create({
    data: {
      visitId: visit.id,
      items: [
        { medicine: "Paracetamol 500mg", dosage: "1 tablet", frequency: "TDS", duration: "3 days" },
        { medicine: "ORS", dosage: "1 sachet", frequency: "after every loose motion", duration: "3 days" },
      ],
      advice: "Rest and plenty of fluids.", followUpInDays: 3,
    },
  });
  await prisma.invoice.create({
    data: {
      hospitalId: h, invoiceNo: "CCH-000001", patientId: patients[6].id, visitId: visit.id,
      items: [{ label: "Consultation — Dr. Ahmed Khan", qty: 1, unitPrice: 1500 }],
      subtotal: 1500, total: 1500, paid: 1500, status: "PAID", createdById: recep.id,
    },
  });

  // ── WhatsApp conversation ──
  const conv = await prisma.conversation.create({
    data: {
      hospitalId: h, patientId: patients[0].id, patientPhone: patients[0].phone,
      lastMessageAt: new Date(),
      messages: {
        create: [
          { direction: "IN", type: "TEXT", body: "Assalam-o-Alaikum, mujhe appointment chahiye", status: "READ", waMessageId: "wamid.seed1" },
          { direction: "OUT", type: "TEXT", body: "Walaikum Assalam! Kis doctor se milna hai? 1) Dr. Ahmed Khan 2) Dr. Sara Malik", status: "READ", waMessageId: "wamid.seed2" },
          { direction: "IN", type: "TEXT", body: "1", status: "READ", waMessageId: "wamid.seed3" },
        ],
      },
    },
  });
  void conv;

  // ── Templates ──
  for (const t of [
    { name: "appointment_confirmation", body: "Assalam-o-Alaikum {{1}}, your appointment request with {{2}} on {{3}} at {{4}} is received." },
    { name: "appointment_confirmed", body: "{{1}}, your appointment with Dr. {{2}} is confirmed: {{3}} at {{4}}." },
    { name: "appointment_reminder_24h", body: "Reminder: appointment with Dr. {{1}} tomorrow at {{2}}. Reply YES to confirm." },
    { name: "appointment_reminder_2h", body: "Your appointment with Dr. {{1}} is in 2 hours ({{2}}). Please arrive 15 min early." },
    { name: "prescription_ready", body: "{{1}}, your prescription from Dr. {{2}} is attached. Get well soon!" },
  ]) await prisma.template.create({ data: { hospitalId: h, ...t } });

  // ── POS ──
  for (const p of [
    { sku: "MED-001", name: "Paracetamol 500mg (20 tabs)", price: 120, stockQty: 500, category: "Medicine" },
    { sku: "MED-002", name: "ORS Sachet", price: 45, stockQty: 300, category: "Medicine" },
    { sku: "MED-003", name: "Augmentin 625mg (10 tabs)", price: 480, stockQty: 150, category: "Medicine" },
  ]) await prisma.posProduct.create({ data: { hospitalId: h, ...p } });
  await prisma.posSale.create({
    data: {
      hospitalId: h, receiptNo: "CCH-20260928-0001",
      items: [{ sku: "MED-001", name: "Paracetamol 500mg (20 tabs)", qty: 2, unitPrice: 120 }],
      subtotal: 240, total: 240, paymentMethod: "CASH", cashierId: recep.id,
    },
  });

  // ── Subscriptions ──
  const plan = await prisma.subscriptionPlan.create({
    data: { hospitalId: h, name: "Sehat Plus Monthly", pricePkr: 1000, durationDays: 30,
      features: { aiDoctor: true, priorityBooking: true } },
  });
  await prisma.patientSubscription.create({
    data: { hospitalId: h, patientId: patients[1].id, planId: plan.id,
      startsAt: new Date(), endsAt: new Date(Date.now() + 30 * 864e5), status: "ACTIVE", paymentRef: "EASYPAISA-123" },
  });

  // ── AI protocol ──
  await prisma.protocol.create({
    data: {
      hospitalId: h, name: "Viral fever (adult)", symptomKeywords: ["fever", "bukhar", "body ache", "dard"],
      medicines: [
        { medicine: "Paracetamol 500mg", dosage: "1 tablet", frequency: "TDS", duration: "3 days", maxDays: 5 },
        { medicine: "ORS", dosage: "1 sachet in 1L water", frequency: "as needed", duration: "3 days", maxDays: 3 },
      ],
      redFlags: ["chest pain", "breathing difficulty", "seene mein dard", "saans"],
      advice: "Rest and plenty of fluids.", createdByDoctorId: doctor1.id,
      isActive: true, approvedAt: new Date(),
    },
  });

  // ── Wards & beds ──
  const ward = await prisma.ward.create({ data: { hospitalId: h, name: "General Ward", wardType: "General" } });
  const room = await prisma.room.create({ data: { hospitalId: h, wardId: ward.id, roomNo: "101", roomType: "Shared" } });
  const bed1 = await prisma.bed.create({ data: { hospitalId: h, roomId: room.id, bedNo: "1" } });
  await prisma.bed.create({ data: { hospitalId: h, roomId: room.id, bedNo: "2" } });
  await prisma.bedAllocation.create({
    data: { hospitalId: h, bedId: bed1.id, patientId: patients[7].id, admittedById: recep.id },
  });
  await prisma.bed.update({ where: { id: bed1.id }, data: { status: "OCCUPIED" } });
  await prisma.nurseTask.create({
    data: { hospitalId: h, assignedToUserId: nurseUser.id, patientId: patients[7].id,
      kind: "VITALS", title: "Morning vitals — Bed 1", dueAt: new Date(Date.now() + 3600e3), createdById: owner.id },
  });

  // ── Lab ──
  const cbc = await prisma.labTest.create({ data: { hospitalId: h, name: "CBC", price: 800, sampleType: "Blood" } });
  await prisma.labTest.create({ data: { hospitalId: h, name: "HbA1c", price: 1200, sampleType: "Blood" } });
  const labOrder = await prisma.labOrder.create({
    data: { hospitalId: h, patientId: patients[2].id, orderedById: docUser1.id,
      items: [{ testId: cbc.id, testName: "CBC", price: 800 }], total: 800, status: "SAMPLE_COLLECTED" },
  });
  void labOrder; void labUser; void owner;

  // ── Default role permissions ──
  const modules = ["APPOINTMENTS","INBOX","BILLING","POS","LAB","WARDS","AI_PROTOCOLS","SUBSCRIPTIONS","ANALYTICS","STAFF","SETTINGS"];
  const allow: Record<string, string[]> = {
    OWNER: modules, ADMIN: modules,
    DOCTOR: ["APPOINTMENTS","LAB","WARDS","AI_PROTOCOLS"],
    RECEPTIONIST: ["APPOINTMENTS","INBOX","BILLING","POS","LAB","WARDS","SUBSCRIPTIONS"],
    NURSE: ["WARDS","APPOINTMENTS"],
    LAB_STAFF: ["LAB"],
  };
  for (const [role, mods] of Object.entries(allow))
    for (const m of modules)
      await prisma.rolePermission.create({ data: { hospitalId: h, role: role as any, module: m, allowed: mods.includes(m) } });

  console.log("Seed complete:", hospital.name);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
