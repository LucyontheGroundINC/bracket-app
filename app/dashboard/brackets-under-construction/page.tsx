import Image from "next/image";

export default function BracketsUnderConstructionPage() {
  return (
    <div className="min-h-screen bg-[#F9DCD8] text-[#0A2041] flex items-center justify-center px-6">
      <div className="w-full max-w-3xl flex flex-col items-center justify-center gap-6 text-center">
        <div className="relative w-[280px] h-[280px] sm:w-[360px] sm:h-[360px]">
          <Image
            src="/LOTG_Logo_Red_Navy.png"
            alt="Lucy On The Ground"
            fill
            priority
            className="object-contain"
          />
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold text-[#CA4C4C]">Under Construction</h1>
      </div>
    </div>
  );
}
