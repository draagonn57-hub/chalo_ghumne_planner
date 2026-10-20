import { MessageCircle } from "lucide-react";
import { mailtoLink } from "@/lib/siteConfig";

/**
 * Floating contact button — fixed bottom-right above the BackToTop button.
 * bottom-20 keeps it above BackToTop (bottom-6).
 */
export default function FloatingContact() {
  return (
    <a
      id="floating-contact"
      href={mailtoLink("Chalo Ghumne support")}
      aria-label="Contact us"
      title="Contact us"
      className="floating-btn no-print fixed bottom-20 right-6 z-40 group flex items-center justify-center w-11 h-11 rounded-full bg-[#E76F51] text-white shadow-lg hover:bg-[#D65A3D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D5C75] focus-visible:ring-offset-2"
    >
      <MessageCircle size={20} />
      {/* Tooltip */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-full bg-[#1A2530] text-white text-[11px] font-medium px-2.5 py-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      >
        Contact us
      </span>
    </a>
  );
}
