"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Phone, Globe, ShieldAlert, Save, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import Header from "@/components/shared/Header";
import Footer from "@/components/shared/Footer";
import toast, { Toaster } from "react-hot-toast";

// Schema for profile updating
const profileFormSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100, "Name is too long"),
  email: z.string().email("Invalid email address").max(100).optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function PatientProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [language, setLanguage] = useState<"en" | "hi">("en");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
  });

  // Load profile details and cookies on mount
  useEffect(() => {
    // 1. Fetch current session
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login?redirect=/profile");
            return;
          }
          throw new Error("Failed to load user profile");
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setUser(data.data.user);
          setValue("name", data.data.user.name || "");
          setValue("email", data.data.user.email || "");
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Unable to load profile data.");
      })
      .finally(() => {
        setLoading(false);
      });

    // 2. Read language cookie preference
    const cookiesArr = document.cookie.split("; ");
    const langCookie = cookiesArr.find((row) => row.startsWith("jvc_language="));
    if (langCookie) {
      setLanguage(langCookie.split("=")[1] === "hi" ? "hi" : "en");
    }
  }, [router, setValue]);

  // Handle language switch
  const handleLanguageChange = (lang: "en" | "hi") => {
    setLanguage(lang);
    document.cookie = `jvc_language=${lang}; path=/; max-age=${60 * 60 * 24 * 365}`;
    toast.success(lang === "hi" ? "भाषा बदलकर हिंदी कर दी गई है।" : "Language switched to English.");
  };

  // Submit changes
  const onSubmit = async (values: ProfileFormValues) => {
    setSaving(true);
    try {
      const response = await fetch("/api/patient/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Profile updated successfully!");
        setUser(data.data.user);
      } else {
        toast.error(data.error || "Failed to update profile.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Connection error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Trigger Deletion Request
  const handleDeleteRequest = async () => {
    setDeleting(true);
    try {
      const response = await fetch("/api/patient/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.success) {
        setDeleteDialogOpen(false);
        // Display notification
        toast.success(data.data.message || "Deletion request received. 30 days processing.", {
          duration: 6000,
        });
      } else {
        toast.error(data.error || "Failed to submit deletion request.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Could not request deletion.");
    } finally {
      setDeleting(false);
    }
  };

  // Initials generator for avatar fallback
  const getInitials = (name: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface-primary">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
            <span className="text-sm text-content-secondary font-medium">Syncing profile data...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-primary">
      <Header />
      <Toaster position="top-center" />

      <main className="flex-1 container mx-auto max-w-xl px-4 py-6 md:py-10 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-content-primary">Profile & Settings</h1>
          <p className="text-sm text-content-secondary mt-1">Manage your account information and preferences</p>
        </div>

        {/* Profile Card */}
        <div className="bg-surface-card border border-border shadow-sm rounded-2xl p-5 md:p-6 flex flex-col gap-6">
          {/* Avatar and Phone Header */}
          <div className="flex items-center gap-4 border-b border-border/50 pb-5">
            <div className="w-16 h-16 rounded-full bg-brand-blue/10 border-2 border-brand-blue/20 text-brand-blue flex items-center justify-center text-xl font-display font-bold">
              {getInitials(user?.name || "")}
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-display font-bold text-content-primary">
                {user?.name || "JivniCare User"}
              </span>
              <span className="text-xs text-content-muted mt-0.5">Role: Patient</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Editable Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs font-semibold text-content-secondary flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-content-muted" /> Name
              </label>
              <input
                type="text"
                id="name"
                disabled={saving}
                placeholder="Enter your name"
                className="w-full border border-border bg-surface-primary px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-content-primary"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-status-error font-medium mt-0.5">{errors.name.message}</p>
              )}
            </div>

            {/* Read-only Phone */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-xs font-semibold text-content-secondary flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-content-muted" /> Phone Number (Locked)
              </label>
              <input
                type="text"
                id="phone"
                disabled
                value={user?.phone || ""}
                className="w-full border border-border bg-disabled-bg border-disabled-border/30 px-3.5 py-2.5 rounded-xl text-sm text-content-muted cursor-not-allowed font-mono"
              />
              <p className="text-[10px] text-content-muted">Phone verification is required for same-day bookings.</p>
            </div>

            {/* Editable Email */}
            {/* NOTE: The email field is used only for notifications and uniqueness-checking. */}
            {/* Patient login remains strictly phone-OTP only via the jvc_session flow; the email field has no login/auth role. */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-content-secondary flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-content-muted" /> Email Address
              </label>
              <input
                type="email"
                id="email"
                disabled={saving}
                placeholder="Enter email (e.g. user@domain.com)"
                className="w-full border border-border bg-surface-primary px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-content-primary"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-status-error font-medium mt-0.5">{errors.email.message}</p>
              )}
              <p className="text-[10px] text-content-muted">For appointment alerts and verification only. Not used for login.</p>
            </div>

            {/* Language Preference */}
            <div className="flex flex-col gap-2 pt-2">
              <span className="text-xs font-semibold text-content-secondary flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-content-muted" /> Interface Language
              </span>
              <div className="flex bg-surface-primary border border-border rounded-xl p-1 gap-1 self-start">
                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    language === "en"
                      ? "bg-brand-blue text-white shadow-sm"
                      : "text-content-secondary hover:text-content-primary"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("hi")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    language === "hi"
                      ? "bg-brand-blue text-white shadow-sm"
                      : "text-content-secondary hover:text-content-primary"
                  }`}
                >
                  हिंदी (Hindi)
                </button>
              </div>
            </div>

            {/* Save Button */}
            <Button
              type="submit"
              disabled={saving}
              className="bg-brand-blue hover:bg-brand-blue-hover text-white font-semibold py-6 rounded-xl mt-4 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Changes</span>
            </Button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="border border-status-error/30 bg-status-error/5 rounded-2xl p-5 md:p-6 flex flex-col gap-4">
          <div className="flex gap-3">
            <ShieldAlert className="w-5 h-5 text-status-error shrink-0" />
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-status-error">Danger Zone</h3>
              <p className="text-xs text-content-secondary mt-1">
                Once requested, data deletion takes up to 30 days to process. All booking tokens, history, and records will be deleted soft-archived.
              </p>
            </div>
          </div>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger render={
              <Button variant="destructive" className="bg-status-error hover:bg-status-error/90 text-white font-semibold rounded-xl py-5 self-start text-xs">
                Request Data Deletion
              </Button>
            } />
            <DialogContent className="bg-surface-card border border-border rounded-2xl max-w-sm">
              <DialogHeader className="flex flex-col gap-2">
                <div className="w-10 h-10 bg-status-error/10 text-status-error rounded-full flex items-center justify-center mb-1">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <DialogTitle className="text-lg font-display font-bold text-content-primary">
                  Confirm Data Deletion Request
                </DialogTitle>
                <DialogDescription className="text-sm text-content-secondary leading-relaxed">
                  Are you absolutely sure you want to request data deletion? An email notification will be dispatched to the system administrator. Under safety protocols, your profile and token history will be deleted soft-archived in 30 days.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2 justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deleting}
                  className="rounded-xl border-border hover:bg-surface-primary text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteRequest}
                  disabled={deleting}
                  className="bg-status-error hover:bg-status-error/90 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5"
                >
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Deletion
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>

      <Footer />
    </div>
  );
}
