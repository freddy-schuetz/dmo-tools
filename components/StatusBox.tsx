// Gemeinsame Running-/Fehler-Anzeige für alle Tool-Seiten.
export function RunningBox({ text }: { text: string }) {
  return (
    <div className="mb-6 rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
      <p className="animate-pulse font-medium text-brand">{text}</p>
    </div>
  );
}

export function ErrorBox({ message }: { message?: string | null }) {
  return (
    <div className="mb-6 rounded-2xl bg-red-50 p-6 text-center ring-1 ring-red-200">
      <p className="text-bad">
        {message ?? "Etwas ist schiefgelaufen. Bitte versuche es in ein paar Minuten erneut."}
      </p>
    </div>
  );
}
