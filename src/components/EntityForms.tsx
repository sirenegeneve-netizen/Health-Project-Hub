"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function Toggle({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="btn mb-4" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  return <div className="card mb-4 space-y-3">{children(() => setOpen(false))}</div>;
}

const inputCls = "input";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="label mb-1">{label}</div>
      {children}
    </label>
  );
}

async function post(url: string, body: unknown) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function ActionForm({ projectId, meetingId, label }: { projectId: string; meetingId?: string; label?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ title: "", responsable: "", echeance: "", priority: "normale", comments: "" });
  return (
    <Toggle label={label || "+ Nouvelle action"}>
      {(close) => (
        <>
          <Field label="Intitulé">
            <input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Responsable">
              <input className={inputCls} value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} />
            </Field>
            <Field label="Échéance">
              <input type="date" className={inputCls} value={f.echeance} onChange={(e) => setF({ ...f, echeance: e.target.value })} />
            </Field>
            <Field label="Priorité">
              <select className={inputCls} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
                <option value="basse">Basse</option>
                <option value="normale">Normale</option>
                <option value="haute">Haute</option>
                <option value="critique">Critique</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.title) return;
                await post("/api/actions", { projectId, meetingId, origine: meetingId ? "reunion" : "manuel", ...f });
                setF({ title: "", responsable: "", echeance: "", priority: "normale", comments: "" });
                close();
                router.refresh();
              }}
            >
              Créer
            </button>
            <button className="btn-secondary" onClick={close}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Toggle>
  );
}

export function RiskForm({ projectId, meetingId, label }: { projectId: string; meetingId?: string; label?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ description: "", cause: "", proprietaire: "", probabilite: "moyenne", impact: "moyen", criticite: "moyenne", planAction: "" });
  return (
    <Toggle label={label || "+ Nouveau risque"}>
      {(close) => (
        <>
          <Field label="Description">
            <input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Field label="Cause">
            <input className={inputCls} value={f.cause} onChange={(e) => setF({ ...f, cause: e.target.value })} />
          </Field>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Propriétaire">
              <input className={inputCls} value={f.proprietaire} onChange={(e) => setF({ ...f, proprietaire: e.target.value })} />
            </Field>
            <Field label="Probabilité">
              <select className={inputCls} value={f.probabilite} onChange={(e) => setF({ ...f, probabilite: e.target.value })}>
                <option value="faible">Faible</option>
                <option value="moyenne">Moyenne</option>
                <option value="forte">Forte</option>
              </select>
            </Field>
            <Field label="Impact">
              <select className={inputCls} value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })}>
                <option value="faible">Faible</option>
                <option value="moyen">Moyen</option>
                <option value="fort">Fort</option>
              </select>
            </Field>
            <Field label="Criticité">
              <select className={inputCls} value={f.criticite} onChange={(e) => setF({ ...f, criticite: e.target.value })}>
                <option value="faible">Faible</option>
                <option value="moyenne">Moyenne</option>
                <option value="forte">Forte</option>
                <option value="critique">Critique</option>
              </select>
            </Field>
          </div>
          <Field label="Plan d'action">
            <input className={inputCls} value={f.planAction} onChange={(e) => setF({ ...f, planAction: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.description) return;
                await post("/api/risks", { projectId, meetingId, ...f });
                close();
                router.refresh();
              }}
            >
              Créer
            </button>
            <button className="btn-secondary" onClick={close}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Toggle>
  );
}

export function DecisionForm({ projectId, meetingId, label }: { projectId: string; meetingId?: string; label?: string }) {
  const router = useRouter();
  const [f, setF] = useState({ subject: "", context: "", options: "", recommendation: "", decideur: "" });
  return (
    <Toggle label={label || "+ Nouvelle décision"}>
      {(close) => (
        <>
          <Field label="Sujet">
            <input className={inputCls} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
          </Field>
          <Field label="Contexte">
            <textarea className={inputCls} rows={2} value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Options envisagées">
              <input className={inputCls} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} />
            </Field>
            <Field label="Décideur">
              <input className={inputCls} value={f.decideur} onChange={(e) => setF({ ...f, decideur: e.target.value })} />
            </Field>
          </div>
          <Field label="Recommandation">
            <input className={inputCls} value={f.recommendation} onChange={(e) => setF({ ...f, recommendation: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.subject) return;
                await post("/api/decisions", { projectId, meetingId, ...f });
                close();
                router.refresh();
              }}
            >
              Créer
            </button>
            <button className="btn-secondary" onClick={close}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Toggle>
  );
}

export function InterfaceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", systemeSource: "", systemeCible: "", flux: "", protocole: "", responsable: "", fournisseur: "", datePrevue: "" });
  return (
    <Toggle label="+ Nouvelle interface">
      {(close) => (
        <>
          <Field label="Nom">
            <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Système source">
              <input className={inputCls} value={f.systemeSource} onChange={(e) => setF({ ...f, systemeSource: e.target.value })} />
            </Field>
            <Field label="Système cible">
              <input className={inputCls} value={f.systemeCible} onChange={(e) => setF({ ...f, systemeCible: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Flux / protocole">
              <input className={inputCls} value={f.protocole} onChange={(e) => setF({ ...f, protocole: e.target.value })} />
            </Field>
            <Field label="Responsable">
              <input className={inputCls} value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} />
            </Field>
            <Field label="Fournisseur">
              <input className={inputCls} value={f.fournisseur} onChange={(e) => setF({ ...f, fournisseur: e.target.value })} />
            </Field>
          </div>
          <Field label="Date prévue">
            <input type="date" className={inputCls} value={f.datePrevue} onChange={(e) => setF({ ...f, datePrevue: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.name) return;
                await post("/api/interfaces", { projectId, ...f });
                close();
                router.refresh();
              }}
            >
              Créer
            </button>
            <button className="btn-secondary" onClick={close}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Toggle>
  );
}

export function MeetingForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ title: "", type: "suivi", date: "", participants: "", agenda: "" });
  return (
    <Toggle label="+ Nouvelle réunion">
      {(close) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Titre">
              <input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </Field>
            <Field label="Type">
              <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                {["kick_off", "comite_projet", "copil", "atelier_metier", "atelier_interop", "atelier_parametrage", "suivi", "go_no_go", "hypercare", "retex"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="datetime-local" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label="Participants">
              <input className={inputCls} value={f.participants} onChange={(e) => setF({ ...f, participants: e.target.value })} />
            </Field>
          </div>
          <Field label="Ordre du jour">
            <textarea className={inputCls} rows={2} value={f.agenda} onChange={(e) => setF({ ...f, agenda: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.title || !f.date) return;
                const res = await post("/api/meetings", { projectId, ...f });
                const meeting = await res.json();
                close();
                router.push(`/projects/${projectId}/meetings/${meeting.id}`);
              }}
            >
              Créer
            </button>
            <button className="btn-secondary" onClick={close}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Toggle>
  );
}

export function TrainingForm({ projectId, establishments }: { projectId: string; establishments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [f, setF] = useState({ establishmentId: "", service: "", metier: "", profil: "", nbUsers: "", nbFormes: "", autonomyLevel: "0" });
  return (
    <Toggle label="+ Suivi formation">
      {(close) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Établissement">
              <select className={inputCls} value={f.establishmentId} onChange={(e) => setF({ ...f, establishmentId: e.target.value })}>
                <option value="">—</option>
                {establishments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Profil / métier">
              <input className={inputCls} value={f.profil} onChange={(e) => setF({ ...f, profil: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Utilisateurs concernés">
              <input type="number" className={inputCls} value={f.nbUsers} onChange={(e) => setF({ ...f, nbUsers: e.target.value })} />
            </Field>
            <Field label="Formés">
              <input type="number" className={inputCls} value={f.nbFormes} onChange={(e) => setF({ ...f, nbFormes: e.target.value })} />
            </Field>
            <Field label="Niveau d'autonomie">
              <select className={inputCls} value={f.autonomyLevel} onChange={(e) => setF({ ...f, autonomyLevel: e.target.value })}>
                <option value="0">0 — Non formé</option>
                <option value="1">1 — Formé mais accompagné</option>
                <option value="2">2 — Autonome opérations courantes</option>
                <option value="3">3 — Autonome, aide ses collègues</option>
                <option value="4">4 — Référent / expert</option>
              </select>
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.profil) return;
                await post("/api/trainings", { projectId, ...f });
                close();
                router.refresh();
              }}
            >
              Enregistrer
            </button>
            <button className="btn-secondary" onClick={close}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Toggle>
  );
}

export function AnomalyForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ description: "", criticite: "moyenne", responsable: "", environnement: "" });
  return (
    <Toggle label="+ Nouvelle anomalie">
      {(close) => (
        <>
          <Field label="Description">
            <input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Criticité">
              <select className={inputCls} value={f.criticite} onChange={(e) => setF({ ...f, criticite: e.target.value })}>
                <option value="mineure">Mineure</option>
                <option value="moyenne">Moyenne</option>
                <option value="majeure">Majeure</option>
                <option value="critique">Critique</option>
              </select>
            </Field>
            <Field label="Responsable">
              <input className={inputCls} value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })} />
            </Field>
            <Field label="Environnement">
              <input className={inputCls} value={f.environnement} onChange={(e) => setF({ ...f, environnement: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.description) return;
                await post("/api/anomalies", { projectId, ...f });
                close();
                router.refresh();
              }}
            >
              Créer
            </button>
            <button className="btn-secondary" onClick={close}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Toggle>
  );
}

export function VigilanceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2 mb-4">
      <input className={inputCls} placeholder="Nouveau point de vigilance…" value={text} onChange={(e) => setText(e.target.value)} />
      <button
        className="btn-secondary shrink-0"
        onClick={async () => {
          if (!text) return;
          await post("/api/vigilance-points", { projectId, description: text });
          setText("");
          router.refresh();
        }}
      >
        Ajouter
      </button>
    </div>
  );
}

export function BacklogForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [f, setF] = useState({ demande: "", description: "", impact: "", priorite: "normale", estimationJh: "" });
  return (
    <Toggle label="+ Nouvelle demande">
      {(close) => (
        <>
          <Field label="Demande">
            <input className={inputCls} value={f.demande} onChange={(e) => setF({ ...f, demande: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className={inputCls} rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priorité">
              <select className={inputCls} value={f.priorite} onChange={(e) => setF({ ...f, priorite: e.target.value })}>
                <option value="basse">Basse</option>
                <option value="normale">Normale</option>
                <option value="haute">Haute</option>
              </select>
            </Field>
            <Field label="Estimation JH">
              <input type="number" className={inputCls} value={f.estimationJh} onChange={(e) => setF({ ...f, estimationJh: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <button
              className="btn"
              onClick={async () => {
                if (!f.demande) return;
                await post("/api/backlog", { projectId, ...f });
                close();
                router.refresh();
              }}
            >
              Ajouter au backlog
            </button>
            <button className="btn-secondary" onClick={close}>
              Annuler
            </button>
          </div>
        </>
      )}
    </Toggle>
  );
}
