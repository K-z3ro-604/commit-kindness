import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Lock, Loader2, LogOut, ShieldCheck, Users, Copy, Check } from "lucide-react";
import { adminStatus, adminLogin, adminLogout, adminListCodes } from "@/lib/license.functions";

export const Route = createFileRoute("/subscribers")({
  head: () => ({
    meta: [
      { title: "المشتركون — صوتُك" },
      { name: "description", content: "جدول المشتركين في تطبيق صوتُك." },
      { property: "og:title", content: "المشتركون — صوتُك" },
      { property: "og:description", content: "جدول المشتركين في تطبيق صوتُك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SubscribersPage,
});

function SubscribersPage() {
  const status = useServerFn(adminStatus);
  const q = useQuery({ queryKey: ["admin"], queryFn: () => status() });
  if (q.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-surface"><Loader2 className="size-8 animate-spin text-brand" /></div>;
  }
  return q.data?.admin ? <SubscribersTable /> : <GateLogin />;
}

function GateLogin() {
  const login = useServerFn(adminLogin);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(false);
    const r = await login({ data: { passcode: pass } });
    setBusy(false);
    if (r.ok) window.location.reload();
    else setErr(true);
  };
  return (
    <div dir="rtl" className="grid min-h-screen place-items-center bg-surface p-5 font-body">
      <form onSubmit={submit} className="w-full max-w-sm rounded-4xl border border-line bg-card p-7 shadow-card">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-ink text-background"><Lock className="size-6" /></div>
        <h1 className="mt-4 text-center font-display text-xl font-extrabold text-foreground">دخول الإدارة</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">هذه الصفحة محمية — أدخل رمز المرور لعرض المشتركين.</p>
        <label htmlFor="sub-pass" className="mt-6 block text-sm font-bold text-foreground">رمز المرور</label>
        <input
          id="sub-pass" type="password" dir="ltr" value={pass} onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
          className="mt-2 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        {err && <p className="mt-2 text-sm font-bold text-destructive">رمز المرور غير صحيح</p>}
        <button disabled={busy || !pass} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3 font-display font-extrabold text-background shadow-ink disabled:opacity-50">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />} دخول
        </button>
mila      </form>
    </div>
  );
}

function SubscribersTable() {
  const logout = useServerFn(adminLogout);
  const list = useServerFn(adminListCodes);
  const codes = useQuery({ queryKey: ["admin-codes"], queryFn: () => list() });
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (t: string) => { await navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 1400); };

  const rows = codes.data ?? [];
  const used = rows.filter((r) => r.first_used_at).length;
  const activeCount = rows.filter((r) => r.active && !r.expired && r.usesLeft > 0).length;

  return (
    <div dir="rtl" className="min-h-screen bg-surface font-body text-foreground">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-extrabold"><Users className="size-5 text-brand" /> جدول المشتركين</p>
            <p className="text-xs text-muted-foreground">سجل أكواد التفعيل وحالتها</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/K.z3ro" className="rounded-full px-4 py-2 text-sm font-bold text-brand hover:bg-muted">لوحة التحكم</Link>
            <button onClick={async () => { await logout(); window.location.reload(); }}
              aria-label="خروج" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><LogOut className="size-4" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-5 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-muted px-3 py-1">الإجمالي {rows.length.toLocaleString("ar-EG")}</span>
          <span className="rounded-full bg-success/15 px-3 py-1 text-success">اشتراكات صالحة {activeCount.toLocaleString("ar-EG")}</span>
          <span className="rounded-full bg-brand/10 px-3 py-1 text-brand">مُفعّلة {used.toLocaleString("ar-EG")}</span>
        </div>

        <section className="min-w-0 rounded-3xl border border-line bg-card p-5 shadow-card">
          {codes.isLoading ? (
            <div className="grid h-40 place-items-center"><Loader2 className="size-6 animate-spin text-brand" /></div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">لا يوجد مشتركون بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="text-start text-xs text-muted-foreground">
                  <tr className="border-b border-line">
                    <th className="py-2 text-start">#</th>
                    <th className="text-start">الكود</th>
                    <th className="text-start">العميل</th>
                    <th className="text-start">الاستخدام</th>
                    <th className="text-start">الأيام المتبقية</th>
                    <th className="text-start">تاريخ التفعيل</th>
                    <th className="text-start">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const state = !r.active ? ["موقوف", "bg-muted text-muted-foreground"]
                      : r.expired ? ["منتهٍ", "bg-destructive/15 text-destructive"]
                      : r.usesLeft === 0 ? ["مُستنفد", "bg-gold/20 text-accent-foreground"]
                      : r.first_used_at ? ["نشط", "bg-success/15 text-success"]
                      : ["لم يُفعّل", "bg-brand/10 text-brand"];
                    return (
                      <tr key={r.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5 tabular-nums text-muted-foreground">{(i + 1).toLocaleString("ar-EG")}</td>
                        <td className="py-2.5">
                          <button dir="ltr" onClick={() => copy(r.code)} className="inline-flex items-center gap-1.5 font-mono font-bold hover:text-brand">
                            {copied === r.code ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}{r.code}
                          </button>
                        </td>
                        <td className="text-muted-foreground">{r.label ?? "—"}</td>
                        <td className="tabular-nums">{r.uses.toLocaleString("ar-EG")} / {r.max_uses.toLocaleString("ar-EG")}</td>
                        <td className="tabular-nums">
                          {r.daysLeft.toLocaleString("ar-EG")} {!r.first_used_at && <span className="text-xs text-muted-foreground">(تبدأ عند التفعيل)</span>}
                        </td>
                        <td className="whitespace-nowrap text-muted-foreground" dir="ltr">
                          {r.first_used_at ? new Date(r.first_used_at).toLocaleDateString("ar-EG") : "—"}
                        </td>
                        <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${state[1]}`}>{state[0]}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
