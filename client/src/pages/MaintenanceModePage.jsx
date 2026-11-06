import BuildRoundedIcon from "@mui/icons-material/BuildRounded";

export default function MaintenanceModePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0917] px-5 py-10 font-[Arial,sans-serif] text-white">
      <section className="w-full max-w-xl rounded-3xl border border-[#41316c] bg-[#15112a] px-7 py-10 text-center shadow-[0_0_70px_rgba(139,92,246,0.16)] sm:px-12">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full border border-amber-300/30 bg-violet-500/15 text-amber-300 shadow-[0_0_30px_rgba(139,92,246,0.35)]">
          <BuildRoundedIcon sx={{ fontSize: 42, filter: "drop-shadow(0 0 8px rgba(251,191,36,0.55))" }} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Hệ thống đang bảo trì</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#c2bad5] sm:text-base">
          Ứng dụng thành viên đang tạm thời tạm dừng để nâng cấp hạ tầng. Vui lòng quay lại sau!
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
        >
          Tải lại trang
        </button>
      </section>
    </main>
  );
}
