import { NextRequest, NextResponse } from "next/server";
import { apiError, ERRORS } from "@/lib/utils/api-response";
import { doctorService } from "@/lib/services/doctor.service";
import { getSession } from "@/lib/utils/auth";
import React from "react";
import {
  Document,
  Page,
  Text,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

export const dynamic = "force-dynamic";

// Helper to fetch QR code from public API and convert to Base64
async function getQrCodeBase64(slug: string): Promise<string> {
  const dataUrl = `https://jivnicare.com/doctors/${slug}`;
  // Generate white QR code on navy background (#1B3F6B)
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=ffffff&bgcolor=1B3F6B&data=${encodeURIComponent(
    dataUrl
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to generate QR code");
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#1B3F6B",
    color: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  logo: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
  },
  name: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  speciality: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: "center",
    opacity: 0.9,
  },
  jvcId: {
    fontSize: 14,
    marginBottom: 15,
    textAlign: "center",
    opacity: 0.8,
  },
  clinic: {
    fontSize: 16,
    marginBottom: 40,
    textAlign: "center",
    opacity: 0.8,
  },
  qrCode: {
    width: 220,
    height: 220,
    marginBottom: 40,
  },
  instruction: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  footer: {
    fontSize: 14,
    opacity: 0.7,
    position: "absolute",
    bottom: 40,
  },
  // Sticker page (10x10 cm = 283x283 pt)
  stickerPage: {
    flexDirection: "column",
    backgroundColor: "#1B3F6B",
    color: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
  },
  stickerLogo: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  stickerName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 3,
    textAlign: "center",
  },
  stickerSpeciality: {
    fontSize: 11,
    marginBottom: 3,
    textAlign: "center",
    opacity: 0.9,
  },
  stickerJvcId: {
    fontSize: 9,
    marginBottom: 5,
    textAlign: "center",
    opacity: 0.8,
  },
  stickerClinic: {
    fontSize: 10,
    marginBottom: 15,
    textAlign: "center",
    opacity: 0.8,
  },
  stickerQrCode: {
    width: 110,
    height: 110,
    marginBottom: 15,
  },
  stickerInstruction: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "center",
  },
  stickerFooter: {
    fontSize: 9,
    opacity: 0.7,
    position: "absolute",
    bottom: 10,
  },
});

interface PDFProps {
  name: string;
  speciality: string;
  jvcId: string;
  clinicName: string;
  clinicCity: string;
  qrCodeDataUrl: string;
}

const BrandedQRDocument = ({
  name,
  speciality,
  jvcId,
  clinicName,
  clinicCity,
  qrCodeDataUrl,
}: PDFProps) => (
  <Document>
    {/* Page 1: A4 Size (595.27 x 841.89 pt) */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.logo}>JivniCare</Text>
      <Text style={styles.name}>Dr. {name}</Text>
      <Text style={styles.speciality}>{speciality}</Text>
      <Text style={styles.jvcId}>ID: {jvcId}</Text>
      <Text style={styles.clinic}>
        {clinicName}, {clinicCity}
      </Text>
      <Image style={styles.qrCode} src={qrCodeDataUrl} />
      <Text style={styles.instruction}>Scan to Book Appointment</Text>
      <Text style={styles.footer}>jivnicare.com</Text>
    </Page>

    {/* Page 2: 10x10 cm Sticker (283.46 x 283.46 pt) */}
    <Page size={[283.46, 283.46]} style={styles.stickerPage}>
      <Text style={styles.stickerLogo}>JivniCare</Text>
      <Text style={styles.stickerName}>Dr. {name}</Text>
      <Text style={styles.stickerSpeciality}>{speciality}</Text>
      <Text style={styles.stickerJvcId}>ID: {jvcId}</Text>
      <Text style={styles.stickerClinic}>
        {clinicName}, {clinicCity}
      </Text>
      <Image style={styles.stickerQrCode} src={qrCodeDataUrl} />
      <Text style={styles.stickerInstruction}>Scan to Book Appointment</Text>
      <Text style={styles.stickerFooter}>jivnicare.com</Text>
    </Page>
  </Document>
);

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "DOCTOR" && session.role !== "ADMIN")) {
      return apiError(ERRORS.UNAUTHORIZED, 401);
    }
    const userId = session.userId;

    const doctor = await doctorService.getProfileByUserId(userId);

    if (!doctor) {
      return apiError("Doctor profile not found.", 404);
    }

    if (!doctor.registrationComplete) {
      return apiError("Doctor registration is not complete.", 400);
    }

    // Generate base64 QR code
    let qrCodeDataUrl: string;
    try {
      qrCodeDataUrl = await getQrCodeBase64(doctor.slug);
    } catch (err) {
      console.error("QR generator service failed, using fallback:", err);
      // Fallback url that @react-pdf/renderer will try to fetch directly
      qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=ffffff&bgcolor=1B3F6B&data=${encodeURIComponent(
        `https://jivnicare.com/doctors/${doctor.slug}`
      )}`;
    }

    const doc = React.createElement(BrandedQRDocument, {
      name: doctor.name,
      speciality: doctor.speciality,
      jvcId: doctor.internalDoctorId,
      clinicName: doctor.clinicName,
      clinicCity: doctor.clinicCity,
      qrCodeDataUrl,
    });

    // Render to buffer
    const buffer = await pdf(doc as any).toBuffer();

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=jivnicare-qr-${doctor.internalDoctorId}.pdf`,
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return apiError(error.message || ERRORS.SERVER_ERROR, 500);
  }
}
