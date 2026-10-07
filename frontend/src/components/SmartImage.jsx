import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { resolveImage } from "@/lib/imageService";

function ImagePlaceholder({ alt = "Image unavailable", className = "" }) {
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#0D5C75] via-[#176F86] to-[#E76F51] ${className}`}
      role="img"
      aria-label={`${alt} image unavailable`}
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-white/10" />

      <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center text-white">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
          <MapPin size={24} strokeWidth={1.8} />
        </div>

        <p className="text-sm font-semibold tracking-wide">
          Photo coming soon
        </p>

        <p className="mt-1 text-xs text-white/75">
          Image currently unavailable
        </p>
      </div>
    </div>
  );
}

export default function SmartImage({
  directUrl = "",
  imageQuery = "",
  salt = "",
  type = "",
  alt = "Travel image",
  className = "",
}) {
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(Boolean(directUrl || imageQuery));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      setFailed(false);

      if (directUrl) {
        setImageUrl(directUrl);
        setLoading(false);
        return;
      }

      if (!imageQuery) {
        setImageUrl("");
        setLoading(false);
        setFailed(true);
        return;
      }

      setLoading(true);
      setImageUrl("");

      try {
        const resolvedUrl = await resolveImage(
          imageQuery,
          salt,
          type
        );

        if (cancelled) return;

        if (resolvedUrl) {
          setImageUrl(resolvedUrl);
          setFailed(false);
        } else {
          setImageUrl("");
          setFailed(true);
        }
      } catch {
        if (!cancelled) {
          setImageUrl("");
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [directUrl, imageQuery, salt, type]);

  if (loading) {
    return (
      <div
        className={`h-full w-full animate-pulse bg-slate-200 ${className}`}
        aria-label="Loading image"
      />
    );
  }

  if (failed || !imageUrl) {
    return (
      <ImagePlaceholder
        alt={alt}
        className={className}
      />
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        setImageUrl("");
        setFailed(true);
      }}
    />
  );
}