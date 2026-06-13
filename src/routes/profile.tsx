import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LogOut, KeyRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/hooks/usePlayer";
import { changePin } from "@/lib/api/auth.functions";
import type { Player } from "@/lib/types";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · الغُربة و كاس العالم" }] }),
  component: () => (
    <AppShell>
      <Profile />
    </AppShell>
  ),
});

function Profile() {
  const { slug, clear } = usePlayer();
  const navigate = useNavigate();
  const changeFn = useServerFn(changePin);

  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, slug, name, avatar_color, is_admin")
        .eq("slug", slug!)
        .maybeSingle();
      return data as Player | null;
    },
  });

  if (!slug || !me) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  const submit = async () => {
    if (!/^\d{4,8}$/.test(oldPin) || !/^\d{4,8}$/.test(newPin)) {
      toast.error("PIN must be 4-8 digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("New PINs do not match");
      return;
    }
    if (newPin === oldPin) {
      toast.error("New PIN must be different");
      return;
    }
    setBusy(true);
    try {
      await changeFn({ data: { slug, oldPin, newPin } });
      toast.success("PIN updated");
      setOldPin(""); setNewPin(""); setConfirmPin("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    clear();
    navigate({ to: "/" });
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="gold-border bg-card rounded-2xl p-6 flex items-center gap-4">
        <span
          className="w-16 h-16 rounded-full grid place-items-center font-display text-3xl"
          style={{ background: me.avatar_color, color: "#0A0A0C" }}
        >
          {me.name.charAt(0)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display tracking-wider text-2xl truncate">{me.name}</div>
          <div className="text-xs text-muted-foreground">@{me.slug}{me.is_admin && " · ADMIN"}</div>
        </div>
      </div>

      <div className="gold-border bg-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-primary" />
          <h2 className="font-display tracking-widest text-sm">CHANGE PIN</h2>
        </div>
        <PinInput value={oldPin} onChange={setOldPin} placeholder="Current PIN" />
        <PinInput value={newPin} onChange={setNewPin} placeholder="New PIN (4-8 digits)" />
        <PinInput value={confirmPin} onChange={setConfirmPin} placeholder="Confirm new PIN" onEnter={submit} />
        <button
          onClick={submit}
          disabled={busy}
          className="btn-hero w-full py-3 text-sm disabled:opacity-50"
        >
          {busy ? "..." : "UPDATE PIN"}
        </button>
      </div>

      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-card transition font-display tracking-widest text-xs"
      >
        <LogOut size={16} />
        SIGN OUT
      </button>
    </div>
  );
}

function PinInput({
  value,
  onChange,
  placeholder,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onEnter?: () => void;
}) {
  return (
    <input
      type="password"
      inputMode="numeric"
      maxLength={8}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      className="w-full bg-card-mid border border-border rounded-lg px-3 py-3 text-center text-lg font-display tracking-[0.4em]"
    />
  );
}
