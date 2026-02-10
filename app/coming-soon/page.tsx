import Image from "next/image";

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex items-center justify-center px-6">
      <div className="w-full max-w-4xl flex items-center justify-center">
        <Image
          src="/MM2026 Coming Soon.svg"
          alt="March Madness 2026 Coming Soon"
          width={1600}
          height={900}
          priority
          className="h-auto w-full max-w-3xl"
        />
      </div>
    </div>
  );
}
