"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope,
  Check,
  Loader2,
  Trash,
  Upload,
  Clock,
  Shield,
  XCircle,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  doctorRegisterStep1Schema,
  doctorRegisterStep2Schema,
  doctorRegisterStep3Schema,
  doctorRegisterStep4Schema,
} from "@/lib/schemas/doctor.schema";
import toast from "react-hot-toast";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function DoctorRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const [specialities, setSpecialities] = useState<string[]>([]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Mock Upload state
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Fetch initial profile/session info
  useEffect(() => {
    async function init() {
      try {
        // Fetch session
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          router.push("/login");
          return;
        }
        const meData = await meRes.json();
        const user = meData.data.user;
        setSessionUser(user);

        if (user.phone) {
          setPhoneVerified(true);
          fStep1.setValue("phone", user.phone);
        }
        if (user.name) {
          fStep1.setValue("name", user.name);
        }

        // Fetch specialities
        const specRes = await fetch("/api/public/specialities");
        if (specRes.ok) {
          const specData = await specRes.json();
          setSpecialities(specData.data.map((s: any) => s.name));
        }

        // Fetch existing doctor profile if any
        const docRes = await fetch("/api/doctor/profile");
        if (docRes.ok) {
          const docData = await docRes.json();
          const doc = docData.data.doctor;
          setDoctorProfile(doc);
          if (doc.registrationComplete && doc.verificationStatus === "VERIFIED") {
            router.push("/doctor/dashboard");
          } else {
            setStep(doc.registrationStep || 1);
          }
        } else if (docRes.status === 404 && user.googleId && user.phone) {
          // Doctor profile doesn't exist, but user is logged in with both phone and Google.
          // Let's check if we have saved step 1 data in localStorage
          const savedStep1 = localStorage.getItem("jvc_doc_reg_step1");
          if (savedStep1) {
            const parsed = JSON.parse(savedStep1);
            // Submit Step 1 details automatically
            const regRes = await fetch("/api/doctor/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ step: 1, ...parsed }),
            });
            if (regRes.ok) {
              const regData = await regRes.json();
              setDoctorProfile(regData.data.doctor);
              setStep(2);
              localStorage.removeItem("jvc_doc_reg_step1");
              toast.success("Identity verified and Google account linked!");
              return;
            }
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    init();

    // Check url search params for errors
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err) {
        toast.error(`Linking failed: ${err.replace(/_/g, " ")}`);
      }
    }
  }, [router]);

  // Form setups for each step
  const fStep1 = useForm({
    resolver: zodResolver(doctorRegisterStep1Schema),
    defaultValues: { name: "", phone: "", speciality: "" },
  });

  const fStep2 = useForm({
    resolver: zodResolver(doctorRegisterStep2Schema),
    defaultValues: {
      clinicName: "",
      clinicAddress: "",
      clinicCity: "",
      clinicDistrict: "Jamui" as any,
      clinicPincode: "",
      operatorName: "",
      operatorMobile: "",
      receptionist1Name: "",
      receptionist1Phone: "",
    },
  });

  const fStep3 = useForm({
    resolver: zodResolver(doctorRegisterStep3Schema),
    defaultValues: {
      gender: "MALE" as any,
      registrationNumber: "",
      qualifications: [] as string[],
      experienceYears: 1,
      bio: "",
      languages: ["Hindi"],
      expertiseTags: [] as string[],
      diseases: [] as string[],
      procedures: [] as string[],
      profilePhoto: "",
      clinicPhotos: [] as string[],
      documents: [] as string[],
      isEmergencyEnabled: false,
      emergencyCapacity: 0,
    },
  });

  const fStep4 = useForm({
    resolver: zodResolver(doctorRegisterStep4Schema),
    defaultValues: {
      weeklySchedule: DAYS_OF_WEEK.reduce((acc, day) => {
        acc[day] = { isActive: true, startTime: "09:00", endTime: "17:00" };
        return acc;
      }, {} as any),
      bookingWindowStart: "08:00",
      bookingWindowEnd: "20:00",
      dailyTokenLimit: 30,
      consultationFee: 100,
    },
  });

  // Load existing profile values into forms when profile is fetched
  useEffect(() => {
    if (doctorProfile) {
      fStep1.reset({
        name: doctorProfile.name || "",
        phone: doctorProfile.phone || "",
        speciality: doctorProfile.speciality || "",
      });
      fStep2.reset({
        clinicName: doctorProfile.clinicName || "",
        clinicAddress: doctorProfile.clinicAddress || "",
        clinicCity: doctorProfile.clinicCity || "",
        clinicDistrict: (doctorProfile.clinicDistrict as any) || "Jamui",
        clinicPincode: doctorProfile.clinicPincode || "",
        operatorName: doctorProfile.operatorName || "",
        operatorMobile: doctorProfile.operatorMobile || "",
        receptionist1Name: doctorProfile.receptionist1Name || "",
        receptionist1Phone: doctorProfile.receptionist1Phone || "",
      });
      if (doctorProfile.registrationStep >= 3) {
        fStep3.reset({
          gender: (doctorProfile.gender as any) || "MALE",
          registrationNumber: doctorProfile.registrationNumber || "",
          qualifications: doctorProfile.qualifications || [],
          experienceYears: doctorProfile.experienceYears || 1,
          bio: doctorProfile.bio || "",
          languages: doctorProfile.languages || ["Hindi"],
          expertiseTags: doctorProfile.expertiseTags || [],
          diseases: doctorProfile.diseases || [],
          procedures: doctorProfile.procedures || [],
          profilePhoto: doctorProfile.profilePhoto || "",
          clinicPhotos: doctorProfile.clinicPhotos || [],
          documents: doctorProfile.documents || [],
          isEmergencyEnabled: doctorProfile.isEmergencyEnabled || false,
          emergencyCapacity: doctorProfile.emergencyCapacity || 0,
        });
      }
    }
  }, [doctorProfile, fStep1, fStep2, fStep3]);

  // Step 1: Send OTP handler
  const handleSendOtp = async () => {
    const phone = fStep1.getValues("phone");
    if (!/^\+91[6-9]\d{9}$/.test(phone)) {
      fStep1.setError("phone", { message: "Invalid Indian mobile number format" });
      return;
    }

    setOtpSent(false);
    const promise = fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setOtpSent(true);
    });

    toast.promise(promise, {
      loading: "Sending OTP...",
      success: "OTP sent successfully to " + phone,
      error: (err) => err.message,
    });
  };

  // Step 1: Verify OTP handler
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast.error("Please enter a 6-digit OTP code");
      return;
    }

    setOtpVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fStep1.getValues("phone"),
          otp: otpCode,
          isDoctor: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid OTP code");

      toast.success("Mobile number verified successfully!");
      setPhoneVerified(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleLinkGoogle = () => {
    const name = fStep1.getValues("name");
    const speciality = fStep1.getValues("speciality");
    const phone = fStep1.getValues("phone");

    if (!name || name.trim() === "") {
      fStep1.setError("name", { message: "Name is required" });
      return;
    }
    if (!speciality || speciality.trim() === "") {
      fStep1.setError("speciality", { message: "Speciality is required" });
      return;
    }

    localStorage.setItem("jvc_doc_reg_step1", JSON.stringify({ name, phone, speciality }));
    window.location.href = `/api/auth/google/signin?mockRole=doctor`;
  };

  const handleSaveStep1 = async () => {
    setSubmitting(true);
    try {
      const step1Values = fStep1.getValues();
      const regRes = await fetch("/api/doctor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 1, ...step1Values }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.error || "Failed to save Step 1 details");

      setDoctorProfile(regData.data.doctor);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Mock Upload Handler (simulates file upload to Cloudinary)
  const handleMockUpload = (field: "profilePhoto" | "clinicPhotos" | "documents") => {
    setUploadingField(field);
    setTimeout(() => {
      const mockUrls: Record<string, string> = {
        profilePhoto: "https://res.cloudinary.com/jivnicare/image/upload/v1/mock-avatar.jpg",
        clinicPhotos: "https://res.cloudinary.com/jivnicare/image/upload/v1/mock-clinic.jpg",
        documents: "https://res.cloudinary.com/jivnicare/image/upload/v1/mock-credentials.pdf",
      };

      const url = mockUrls[field];
      if (field === "profilePhoto") {
        fStep3.setValue("profilePhoto", url);
      } else if (field === "clinicPhotos") {
        const current = fStep3.getValues("clinicPhotos") || [];
        if (current.length >= 3) {
          toast.error("Max 3 clinic photos allowed");
        } else {
          fStep3.setValue("clinicPhotos", [...current, url]);
        }
      } else if (field === "documents") {
        const current = fStep3.getValues("documents") || [];
        fStep3.setValue("documents", [...current, url]);
      }
      toast.success("File uploaded successfully! (Mocked)");
      setUploadingField(null);
    }, 1500);
  };

  // Submit Step 2-4 logic
  const handleStepSubmit = async (data: any, nextStep: number) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/doctor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, ...data }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to save step details");

      setDoctorProfile(resData.data.doctor);
      toast.success(`Step ${step} completed!`);
      
      if (nextStep === 5) {
        // Complete registration
        router.push("/doctor/dashboard");
      } else {
        setStep(nextStep);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#1B3F6B] mb-2" />
        <p className="text-slate-500 font-medium text-sm">Loading registration data...</p>
      </div>
    );
  }

  // Render "Under Review" state if registration is complete but status is PENDING/REJECTED
  if (doctorProfile && doctorProfile.registrationComplete) {
    const isPending = doctorProfile.verificationStatus === "PENDING_REVIEW" || doctorProfile.verificationStatus === "PENDING_ACTIVATION";
    const isSuspended = doctorProfile.verificationStatus === "SUSPENDED" || doctorProfile.user?.isBanned;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full shadow-lg rounded-2xl border-none">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-16 w-16 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B] mb-4">
              {isSuspended ? (
                <XCircle className="h-8 w-8 text-red-500 animate-pulse" />
              ) : isPending ? (
                <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
              ) : (
                <Shield className="h-8 w-8 text-red-500" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold text-[#1B3F6B]">
              {isSuspended
                ? "Account Suspended"
                : isPending
                ? "Verification Under Review"
                : "Registration Rejected"}
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              ID: {doctorProfile.internalDoctorId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-center">
            {isSuspended ? (
              <p className="text-slate-600 text-sm leading-relaxed">
                Your clinic partner account has been suspended. Reason:{" "}
                <span className="font-semibold text-red-600">
                  {doctorProfile.user?.bannedReason || "Contact support."}
                </span>
              </p>
            ) : isPending ? (
              <p className="text-slate-600 text-sm leading-relaxed">
                Thank you, Dr. <span className="font-semibold text-slate-800">{doctorProfile.name}</span>. Your details have been submitted to the JivniCare Command Center. Verification takes up to 24 hours. You will receive an email notification once active.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-600 text-sm leading-relaxed">
                  Your registration request was declined by the administrator.
                </p>
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 text-left">
                  <span className="font-bold block mb-1">Reason:</span>
                  {doctorProfile.rejectionReason || "No explanation provided."}
                </div>
                <Button
                  onClick={() => setStep(2)}
                  className="w-full bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl"
                >
                  Edit Information
                </Button>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-between text-xs text-slate-400">
              <span>District: {doctorProfile.clinicDistrict}</span>
              <span>Speciality: {doctorProfile.speciality}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 bg-[#1B3F6B]/10 rounded-full flex items-center justify-center text-[#1B3F6B]">
            <Stethoscope className="h-6 w-6" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1B3F6B]">JivniCare Doctor Registration</h1>
          <p className="text-slate-500 text-sm">Grow your digital clinic presence in Jamui & Deoghar</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between text-xs font-semibold text-slate-500">
            <span>Step {step} of 4</span>
            <span>{Math.round((step / 4) * 100)}% Complete</span>
          </div>
          <Progress value={(step / 4) * 100} className="h-2 bg-slate-100 [&>div]:bg-[#1B3F6B]" />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="rounded-2xl border-none shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl text-[#1B3F6B] font-bold">Step 1: Basic Information</CardTitle>
                  <CardDescription>Enter your mobile number to receive verification OTP code</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-slate-700">Full Name (Prefix Dr.)</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Dr. Rajesh Sharma"
                      className="rounded-xl border-slate-200 mt-1"
                      {...fStep1.register("name")}
                    />
                    {fStep1.formState.errors.name && (
                      <p className="text-red-500 text-xs mt-1">{fStep1.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="speciality" className="text-slate-700">Medical Speciality</Label>
                    <select
                      id="speciality"
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B3F6B]"
                      {...fStep1.register("speciality")}
                    >
                      <option value="">Select Speciality</option>
                      {specialities.map((spec) => (
                        <option key={spec} value={spec}>
                          {spec}
                        </option>
                      ))}
                    </select>
                    {fStep1.formState.errors.speciality && (
                      <p className="text-red-500 text-xs mt-1">{fStep1.formState.errors.speciality.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-slate-700">Mobile Number (with +91)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="phone"
                        placeholder="e.g. +919876543210"
                        className="rounded-xl border-slate-200 flex-1"
                        {...fStep1.register("phone")}
                        disabled={otpSent || phoneVerified}
                      />
                      {!phoneVerified && (
                        <Button
                          type="button"
                          onClick={handleSendOtp}
                          className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl"
                        >
                          {otpSent ? "Resend OTP" : "Get OTP"}
                        </Button>
                      )}
                      {phoneVerified && (
                        <Badge className="bg-emerald-500 text-white rounded-xl flex items-center gap-1 shrink-0 px-3">
                          <Check className="h-3.5 w-3.5" /> Verified
                        </Badge>
                      )}
                    </div>
                    {fStep1.formState.errors.phone && (
                      <p className="text-red-500 text-xs mt-1">{fStep1.formState.errors.phone.message}</p>
                    )}
                  </div>

                  {otpSent && !phoneVerified && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 pt-3 border-t border-slate-100"
                    >
                      <Label htmlFor="otp" className="text-slate-700">Enter 6-Digit OTP Code</Label>
                      <div className="flex gap-2">
                        <Input
                          id="otp"
                          placeholder="000000"
                          maxLength={6}
                          className="rounded-xl border-slate-200 text-center tracking-widest text-lg font-bold"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={otpVerifying}
                          className="bg-[#4E9B5A] hover:bg-[#4E9B5A]/90 text-white rounded-xl min-w-[100px]"
                        >
                          {otpVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify OTP"}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {phoneVerified && (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      {sessionUser?.googleId ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-sm font-semibold justify-center">
                            <Globe className="h-5 w-5 text-emerald-500" />
                            <span>Google Linked ({sessionUser.email})</span>
                          </div>
                          <Button
                            type="button"
                            onClick={handleSaveStep1}
                            disabled={submitting}
                            className="w-full bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl py-6 font-semibold"
                          >
                            {submitting ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Save & Continue"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-slate-500 leading-relaxed text-center">
                            Google account linking is mandatory for doctors to log in subsequently. Please link your Google profile.
                          </p>
                          <Button
                            type="button"
                            onClick={handleLinkGoogle}
                            className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl py-6 font-semibold flex items-center justify-center gap-2 shadow-sm"
                          >
                            <Globe className="h-5 w-5 text-red-500" />
                            Link Google Account
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="rounded-2xl border-none shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl text-[#1B3F6B] font-bold">Step 2: Clinic & Location details</CardTitle>
                  <CardDescription>Setup clinic info and contact details for receptionist</CardDescription>
                </CardHeader>
                <form onSubmit={fStep2.handleSubmit((data) => handleStepSubmit(data, 3))}>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="clinicName" className="text-slate-700">Clinic Name</Label>
                      <Input
                        id="clinicName"
                        placeholder="e.g. Care Plus Clinic"
                        className="rounded-xl border-slate-200 mt-1"
                        {...fStep2.register("clinicName")}
                      />
                      {fStep2.formState.errors.clinicName && (
                        <p className="text-red-500 text-xs mt-1">{fStep2.formState.errors.clinicName.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="clinicAddress" className="text-slate-700">Clinic Full Address</Label>
                      <Input
                        id="clinicAddress"
                        placeholder="e.g. Station Road, Near Town Hall"
                        className="rounded-xl border-slate-200 mt-1"
                        {...fStep2.register("clinicAddress")}
                      />
                      {fStep2.formState.errors.clinicAddress && (
                        <p className="text-red-500 text-xs mt-1">{fStep2.formState.errors.clinicAddress.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="clinicCity" className="text-slate-700">City</Label>
                        <Input
                          id="clinicCity"
                          placeholder="e.g. Jamui"
                          className="rounded-xl border-slate-200 mt-1"
                          {...fStep2.register("clinicCity")}
                        />
                        {fStep2.formState.errors.clinicCity && (
                          <p className="text-red-500 text-xs mt-1">{fStep2.formState.errors.clinicCity.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="clinicDistrict" className="text-slate-700">District</Label>
                        <select
                          id="clinicDistrict"
                          className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B3F6B]"
                          {...fStep2.register("clinicDistrict")}
                        >
                          <option value="Jamui">Jamui (Bihar)</option>
                          <option value="Deoghar">Deoghar (Jharkhand)</option>
                        </select>
                        {fStep2.formState.errors.clinicDistrict && (
                          <p className="text-red-500 text-xs mt-1">{fStep2.formState.errors.clinicDistrict.message}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="clinicPincode" className="text-slate-700">Pincode</Label>
                      <Input
                        id="clinicPincode"
                        placeholder="e.g. 811307"
                        maxLength={6}
                        className="rounded-xl border-slate-200 mt-1"
                        {...fStep2.register("clinicPincode")}
                      />
                      {fStep2.formState.errors.clinicPincode && (
                        <p className="text-red-500 text-xs mt-1">{fStep2.formState.errors.clinicPincode.message}</p>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-4">
                      <h4 className="font-semibold text-[#1B3F6B] text-sm">Owner/Operator Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="operatorName" className="text-slate-700 font-medium text-xs">Operator Name</Label>
                          <Input
                            id="operatorName"
                            placeholder="Operator Name"
                            className="rounded-xl border-slate-200 mt-1"
                            {...fStep2.register("operatorName")}
                          />
                          {fStep2.formState.errors.operatorName && (
                            <p className="text-red-500 text-xs mt-1">{fStep2.formState.errors.operatorName.message}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="operatorMobile" className="text-slate-700 font-medium text-xs">Operator Phone (+91)</Label>
                          <Input
                            id="operatorMobile"
                            placeholder="+91..."
                            className="rounded-xl border-slate-200 mt-1"
                            {...fStep2.register("operatorMobile")}
                          />
                          {fStep2.formState.errors.operatorMobile && (
                            <p className="text-red-500 text-xs mt-1">{fStep2.formState.errors.operatorMobile.message}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-4">
                      <h4 className="font-semibold text-[#1B3F6B] text-sm">Receptionist 1 (Optional)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="receptionist1Name" className="text-slate-700 font-medium text-xs">Receptionist Name</Label>
                          <Input
                            id="receptionist1Name"
                            placeholder="Receptionist Name"
                            className="rounded-xl border-slate-200 mt-1"
                            {...fStep2.register("receptionist1Name")}
                          />
                        </div>

                        <div>
                          <Label htmlFor="receptionist1Phone" className="text-slate-700 font-medium text-xs">Receptionist Phone (+91)</Label>
                          <Input
                            id="receptionist1Phone"
                            placeholder="+91..."
                            className="rounded-xl border-slate-200 mt-1"
                            {...fStep2.register("receptionist1Phone")}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="rounded-xl border-slate-200 text-[#1B3F6B]"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl px-6"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Continue"}
                      </Button>
                    </div>
                  </CardContent>
                </form>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="rounded-2xl border-none shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl text-[#1B3F6B] font-bold">Step 3: Professional Info & Documents</CardTitle>
                  <CardDescription>Enter medical qualifications and upload verification documents</CardDescription>
                </CardHeader>
                <form onSubmit={fStep3.handleSubmit((data) => handleStepSubmit(data, 4))}>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="gender" className="text-slate-700">Gender</Label>
                        <select
                          id="gender"
                          className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B3F6B]"
                          {...fStep3.register("gender")}
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="experienceYears" className="text-slate-700">Years of Experience</Label>
                        <Input
                          id="experienceYears"
                          type="number"
                          min={0}
                          max={60}
                          className="rounded-xl border-slate-200 mt-1"
                          {...fStep3.register("experienceYears", { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="registrationNumber" className="text-slate-700">Medical Council Registration Number</Label>
                      <Input
                        id="registrationNumber"
                        placeholder="e.g. MCI-12345"
                        className="rounded-xl border-slate-200 mt-1"
                        {...fStep3.register("registrationNumber")}
                      />
                      {fStep3.formState.errors.registrationNumber && (
                        <p className="text-red-500 text-xs mt-1">
                          {fStep3.formState.errors.registrationNumber.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label className="text-slate-700">Qualifications (MBBS, MD, MS, etc.)</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id="newQual"
                          placeholder="e.g. MBBS"
                          className="rounded-xl border-slate-200"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val) {
                                const current = fStep3.getValues("qualifications") || [];
                                fStep3.setValue("qualifications", [...current, val]);
                                e.currentTarget.value = "";
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById("newQual") as HTMLInputElement;
                            if (el && el.value.trim()) {
                              const current = fStep3.getValues("qualifications") || [];
                              fStep3.setValue("qualifications", [...current, el.value.trim()]);
                              el.value = "";
                            }
                          }}
                          className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl"
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {fStep3.watch("qualifications")?.map((q, i) => (
                          <Badge key={i} variant="secondary" className="px-3 py-1 text-xs rounded-full bg-slate-100">
                            {q}
                            <Trash
                              className="h-3 w-3 ml-2 text-slate-400 hover:text-red-500 cursor-pointer"
                              onClick={() => {
                                const current = fStep3.getValues("qualifications") || [];
                                fStep3.setValue(
                                  "qualifications",
                                  current.filter((_, idx) => idx !== i)
                                );
                              }}
                            />
                          </Badge>
                        ))}
                      </div>
                      {fStep3.formState.errors.qualifications && (
                        <p className="text-red-500 text-xs mt-1">{fStep3.formState.errors.qualifications.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="bio" className="text-slate-700">Short Bio / About (Max 500 characters)</Label>
                      <textarea
                        id="bio"
                        rows={3}
                        placeholder="Explain your expertise and background..."
                        className="w-full mt-1 p-3 rounded-xl border border-slate-200 text-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B3F6B]"
                        {...fStep3.register("bio")}
                      />
                    </div>

                    {/* File Upload Simulator */}
                    <div className="border-t border-slate-100 pt-4 space-y-4">
                      <h4 className="font-semibold text-[#1B3F6B] text-sm flex items-center gap-1">
                        <Upload className="h-4 w-4" /> Supporting Documents & Photos
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                          <Label className="text-slate-700 block font-semibold text-xs mb-2">Profile Photo</Label>
                          {fStep3.watch("profilePhoto") ? (
                            <div className="flex flex-col items-center">
                              <img
                                src={fStep3.watch("profilePhoto")}
                                alt="avatar"
                                className="h-16 w-16 object-cover rounded-full border border-slate-200 mb-2"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => fStep3.setValue("profilePhoto", "")}
                                className="text-red-500 hover:text-red-600 text-xs"
                              >
                                Remove
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              onClick={() => handleMockUpload("profilePhoto")}
                              disabled={uploadingField === "profilePhoto"}
                              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl"
                            >
                              {uploadingField === "profilePhoto" ? (
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              ) : (
                                "Select Image"
                              )}
                            </Button>
                          )}
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center">
                          <Label className="text-slate-700 block font-semibold text-xs mb-2">Credentials PDF/Docs</Label>
                          <Button
                            type="button"
                            onClick={() => handleMockUpload("documents")}
                            disabled={uploadingField === "documents"}
                            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl"
                          >
                            {uploadingField === "documents" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                            ) : (
                              "Upload PDF / Certificate"
                            )}
                          </Button>
                          <div className="mt-2 text-xs text-slate-500">
                            {fStep3.watch("documents")?.length || 0} document(s) uploaded
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="isEmergencyEnabled" className="text-slate-700 font-semibold text-sm">
                          Offer Emergency Queue Facility?
                        </Label>
                        <input
                          id="isEmergencyEnabled"
                          type="checkbox"
                          className="h-4 w-4 accent-[#1B3F6B]"
                          {...fStep3.register("isEmergencyEnabled")}
                        />
                      </div>
                      {fStep3.watch("isEmergencyEnabled") && (
                        <div className="pl-6">
                          <Label htmlFor="emergencyCapacity" className="text-xs text-slate-500">
                            Emergency Patients Capacity Limit per Day
                          </Label>
                          <Input
                            id="emergencyCapacity"
                            type="number"
                            min={1}
                            className="rounded-xl border-slate-200 mt-1 max-w-[150px]"
                            {...fStep3.register("emergencyCapacity", { valueAsNumber: true })}
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(2)}
                        className="rounded-xl border-slate-200 text-[#1B3F6B]"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl px-6"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit details"}
                      </Button>
                    </div>
                  </CardContent>
                </form>
              </Card>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="rounded-2xl border-none shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl text-[#1B3F6B] font-bold">Step 4: Weekly Clinic Schedule</CardTitle>
                  <CardDescription>Setup weekly consultation timings and fees</CardDescription>
                </CardHeader>
                <form onSubmit={fStep4.handleSubmit((data) => handleStepSubmit(data, 5))}>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <Label className="text-slate-700 font-semibold block">Weekly Availability</Label>
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-50 rounded-xl gap-2 sm:gap-0">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[#1B3F6B]"
                              {...fStep4.register(`weeklySchedule.${day}.isActive`)}
                            />
                            <span className="text-sm font-semibold text-slate-700">{day}</span>
                          </div>
                          {fStep4.watch(`weeklySchedule.${day}.isActive`) && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="time"
                                className="rounded-xl border-slate-200 py-1 px-2 text-xs"
                                {...fStep4.register(`weeklySchedule.${day}.startTime`)}
                              />
                              <span className="text-xs text-slate-400">to</span>
                              <Input
                                type="time"
                                className="rounded-xl border-slate-200 py-1 px-2 text-xs"
                                {...fStep4.register(`weeklySchedule.${day}.endTime`)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <Label htmlFor="dailyTokenLimit" className="text-slate-700">Daily Regular Token Limit</Label>
                        <Input
                          id="dailyTokenLimit"
                          type="number"
                          min={1}
                          max={100}
                          className="rounded-xl border-slate-200 mt-1"
                          {...fStep4.register("dailyTokenLimit", { valueAsNumber: true })}
                        />
                      </div>

                      <div>
                        <Label htmlFor="consultationFee" className="text-slate-700">Consultation Fee (₹)</Label>
                        <Input
                          id="consultationFee"
                          type="number"
                          min={0}
                          max={2000}
                          className="rounded-xl border-slate-200 mt-1"
                          {...fStep4.register("consultationFee", { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(3)}
                        className="rounded-xl border-slate-200 text-[#1B3F6B]"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-[#1B3F6B] hover:bg-[#1B3F6B]/90 text-white rounded-xl px-6"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish Setup"}
                      </Button>
                    </div>
                  </CardContent>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
