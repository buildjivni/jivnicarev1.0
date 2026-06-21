import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="w-full bg-surface-primary border-t border-border py-8 md:py-12 mt-auto">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Brand Section */}
        <div className="flex flex-col gap-4">
          <Image
            src="/logo-horizontal-wordmark.png"
            alt="JivniCare Logo"
            width={130}
            height={36}
            className="w-auto h-8 object-contain"
          />
          <p className="text-sm text-content-secondary leading-relaxed max-w-sm">
            Queue-first same-day doctor booking platform. Designed to eliminate waiting times for patients in Jamui and Deoghar.
          </p>
        </div>

        {/* Areas of Operation */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-content-primary uppercase tracking-wider">
            Districts Served
          </h4>
          <ul className="text-sm text-content-secondary flex flex-col gap-2">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
              Jamui, Bihar (Active)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
              Deoghar, Jharkhand (Active)
            </li>
            <li className="text-content-muted flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-disabled-text" />
              Gaya, Darbhanga, Bhagalpur (Coming Soon)
            </li>
          </ul>
        </div>

        {/* Legal & Contacts */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-content-primary uppercase tracking-wider">
            Important Information
          </h4>
          <ul className="text-sm text-content-secondary flex flex-col gap-2">
            <li>
              <Link href="/terms" className="hover:text-brand-blue transition-colors">
                Terms & Conditions
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-brand-blue transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-brand-blue transition-colors">
                Contact Support
              </Link>
            </li>
          </ul>
        </div>

      </div>

      {/* Bottom Copyright */}
      <div className="container mx-auto px-4 mt-8 pt-6 border-t border-border/80 text-center">
        <p className="text-xs text-content-muted">
          &copy; {new Date().getFullYear()} JivniCare. All rights reserved. Platform convenience fees are entirely waived. Pay your doctor directly at the clinic.
        </p>
      </div>
    </footer>
  );
}
