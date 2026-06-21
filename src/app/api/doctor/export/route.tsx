import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, ERRORS } from "@/lib/utils/api-response";
import { getSession } from "@/lib/utils/auth";
import { generatePhoneHash } from "@/lib/services/crypto.service";
import React from "react";
import path from "path";
import {
  Document,
  Page,
  Text,
  Image,
  StyleSheet,
  pdf,
  View,
} from "@react-pdf/renderer";

export const dynamic = "force-dynamic";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
    color: "#333333",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#1B3F6B",
    paddingBottom: 15,
    marginBottom: 20,
  },
  logo: {
    width: 50,
    height: 50,
  },
  doctorInfo: {
    textAlign: "right",
  },
  doctorName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1B3F6B",
  },
  doctorSub: {
    fontSize: 9,
    color: "#666666",
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1B3F6B",
    marginBottom: 5,
    textAlign: "center",
  },
  dateRange: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 15,
    textAlign: "center",
  },
  table: {
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableColHeaderDate: { width: "12%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: "#f8fafc", padding: 5 },
  tableColHeaderName: { width: "18%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: "#f8fafc", padding: 5 },
  tableColHeaderPhone: { width: "14%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: "#f8fafc", padding: 5 },
  tableColHeaderAddress: { width: "16%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: "#f8fafc", padding: 5 },
  tableColHeaderType: { width: "12%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: "#f8fafc", padding: 5 },
  tableColHeaderNotes: { width: "28%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: "#f8fafc", padding: 5 },

  tableColDate: { width: "12%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, padding: 5 },
  tableColName: { width: "18%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, padding: 5 },
  tableColPhone: { width: "14%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, padding: 5 },
  tableColAddress: { width: "16%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, padding: 5 },
  tableColType: { width: "12%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, padding: 5 },
  tableColNotes: { width: "28%", borderStyle: "solid", borderWidth: 1, borderColor: "#e2e8f0", borderLeftWidth: 0, borderTopWidth: 0, padding: 5 },

  tableHeaderCell: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#1B3F6B",
  },
  tableCell: {
    fontSize: 7,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
  },
});

interface VisitRecord {
  date: string;
  name: string;
  phone: string;
  address: string;
  typeAndNum: string;
  notes: string;
}

interface ExportPDFProps {
  doctorName: string;
  speciality: string;
  clinicName: string;
  clinicCity: string;
  jvcId: string;
  logoPath: string;
  dateRangeStr: string;
  records: VisitRecord[];
}

const BrandedPatientsDocument = ({
  doctorName,
  speciality,
  clinicName,
  clinicCity,
  jvcId,
  logoPath,
  dateRangeStr,
  records,
}: ExportPDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Branded Letterhead */}
      <View style={styles.headerContainer}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image style={styles.logo} src={logoPath} />
        <View style={styles.doctorInfo}>
          <Text style={styles.doctorName}>Dr. {doctorName}</Text>
          <Text style={styles.doctorSub}>{speciality}</Text>
          <Text style={styles.doctorSub}>{clinicName}, {clinicCity}</Text>
          <Text style={styles.doctorSub}>Doctor ID: {jvcId}</Text>
        </View>
      </View>

      <Text style={styles.title}>Patient Consultation History</Text>
      <Text style={styles.dateRange}>{dateRangeStr}</Text>

      {/* Patients Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={[styles.tableRow, { backgroundColor: "#f8fafc" }]}>
          <View style={styles.tableColHeaderDate}>
            <Text style={styles.tableHeaderCell}>Date</Text>
          </View>
          <View style={styles.tableColHeaderName}>
            <Text style={styles.tableHeaderCell}>Patient Name</Text>
          </View>
          <View style={styles.tableColHeaderPhone}>
            <Text style={styles.tableHeaderCell}>Phone</Text>
          </View>
          <View style={styles.tableColHeaderAddress}>
            <Text style={styles.tableHeaderCell}>Address</Text>
          </View>
          <View style={styles.tableColHeaderType}>
            <Text style={styles.tableHeaderCell}>Type/Token</Text>
          </View>
          <View style={styles.tableColHeaderNotes}>
            <Text style={styles.tableHeaderCell}>Internal Notes</Text>
          </View>
        </View>

        {/* Table Rows */}
        {records.length === 0 ? (
          <View style={styles.tableRow}>
            <View style={{ width: "100%", padding: 10, textAlign: "center" }}>
              <Text style={{ fontSize: 9, color: "#666" }}>No records found in this date range.</Text>
            </View>
          </View>
        ) : (
          records.map((r, idx) => (
            <View key={idx} style={styles.tableRow}>
              <View style={styles.tableColDate}>
                <Text style={styles.tableCell}>{r.date}</Text>
              </View>
              <View style={styles.tableColName}>
                <Text style={styles.tableCell}>{r.name}</Text>
              </View>
              <View style={styles.tableColPhone}>
                <Text style={styles.tableCell}>{r.phone}</Text>
              </View>
              <View style={styles.tableColAddress}>
                <Text style={styles.tableCell}>{r.address}</Text>
              </View>
              <View style={styles.tableColType}>
                <Text style={styles.tableCell}>{r.typeAndNum}</Text>
              </View>
              <View style={styles.tableColNotes}>
                <Text style={styles.tableCell}>{r.notes || "-"}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={styles.footer}>Generated by JivniCare (jivnicare.com) — Same-Day Queue Booking Platform</Text>
    </Page>
  </Document>
);

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "DOCTOR") {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const doctor = await prisma.doctor.findUnique({
      where: { userId },
    });
    if (!doctor) {
      return apiError("Doctor profile not found.", 404);
    }

    const { searchParams } = request.nextUrl;
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    if (!fromStr || !toStr) {
      return apiError("Start date ('from') and end date ('to') are required.", 400);
    }

    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);
    toDate.setHours(23, 59, 59, 999);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return apiError("Invalid date formats provided.", 400);
    }

    // Enforce 31 days limit as per 05-prd.md
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 31) {
      return apiError("Export date range cannot exceed 31 days as per PRD constraints.", 400);
    }

    // Fetch tokens in the date range
    const tokens = await prisma.queueToken.findMany({
      where: {
        queue: {
          doctorId: doctor.id,
        },
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        patient: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const records: VisitRecord[] = tokens.map((t) => {
      const date = new Date(t.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const name = t.type === "WALKIN" ? t.walkinName || "" : t.patient?.name || "Online Patient";
      const phone = t.type === "WALKIN" ? t.walkinPhone || "" : t.patient?.phone || "N/A";
      const address = t.type === "WALKIN" ? t.walkinAddress || "" : "Online Booking";
      const typeAndNum = `${t.type === "WALKIN" ? "Walk-in" : "Online"} #${t.tokenNumber}`;
      return {
        date,
        name,
        phone,
        address,
        typeAndNum,
        notes: t.internalNotes || "",
      };
    });

    const logoPath = path.join(process.cwd(), "public", "logo-icon-master-transparent.png");
    const dateRangeStr = `Range: ${fromDate.toLocaleDateString("en-IN")} to ${toDate.toLocaleDateString("en-IN")}`;

    const doc = React.createElement(BrandedPatientsDocument, {
      doctorName: doctor.name,
      speciality: doctor.speciality,
      clinicName: doctor.clinicName,
      clinicCity: doctor.clinicCity,
      jvcId: doctor.internalDoctorId,
      logoPath,
      dateRangeStr,
      records,
    });

    const buffer = await pdf(doc as any).toBuffer();

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=jivnicare-export-${doctor.internalDoctorId}.pdf`,
      },
    });
  } catch (error: any) {
    console.error("Export PDF error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
