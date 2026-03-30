"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import styles from "./encarts-diffusion.module.css";
import {
  EncartsConflictError,
  fetchEncartsSnapshot,
  saveEncartsSnapshot,
} from "@/lib/encarts-api";
import {
  buildDefaultState,
  type Contact,
  type EncartEditableCopy,
  type EncartsDiffusionState,
} from "@/lib/encarts-types";

type SyncPhase = "loading" | "ready" | "syncing" | "error";

type SyncStatus = {
  phase: SyncPhase;
  message: string;
  detail: string;
  lastSyncedAt: string | null;
};

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function formatContactDetails(contact: Contact) {
  return [contact.phone, contact.email].filter(Boolean).join(" / ");
}

function getNextContactId(contacts: Contact[]) {
  return contacts.length > 0
    ? Math.max(...contacts.map((contact) => contact.id)) + 1
    : 1;
}

function nowIso() {
  return new Date().toISOString();
}

export default function EncartsDiffusionApp() {
  const defaultStateRef = useRef<EncartsDiffusionState | null>(null);
  if (!defaultStateRef.current) {
    defaultStateRef.current = buildDefaultState();
  }

  const flyerRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(getNextContactId(defaultStateRef.current!.contacts));

  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    phase: "loading",
    message: "Chargement SQLite",
    detail: "Lecture de la base locale partagee...",
    lastSyncedAt: null,
  });
  const [state, setState] = useState<EncartsDiffusionState>(
    () => defaultStateRef.current!,
  );
  const [serverRevision, setServerRevision] = useState<number | null>(null);
  const [storageLabel, setStorageLabel] = useState(
    "data/encarts-diffusion.sqlite",
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [lastSavedSerialized, setLastSavedSerialized] = useState("");
  const [saveBlockedByConflict, setSaveBlockedByConflict] = useState(false);

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isTextEditorOpen, setIsTextEditorOpen] = useState(false);
  const [expandedContactId, setExpandedContactId] = useState<number | null>(
    null,
  );
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      setSyncStatus({
        phase: "loading",
        message: "Chargement SQLite",
        detail: "Lecture de la base locale partagee...",
        lastSyncedAt: null,
      });

      try {
        const snapshot = await fetchEncartsSnapshot();
        if (cancelled) return;

        setState(snapshot.state);
        setLastSavedSerialized(JSON.stringify(snapshot.state));
        setServerRevision(snapshot.revision);
        setStorageLabel(snapshot.storageLabel);
        setSaveBlockedByConflict(false);
        nextIdRef.current = getNextContactId(snapshot.state.contacts);
        setHydrated(true);
        setSyncStatus({
          phase: "ready",
          message: "SQLite connecte",
          detail: `Fichier: ${snapshot.storageLabel}`,
          lastSyncedAt: snapshot.state.updatedAt,
        });
      } catch (error) {
        if (cancelled) return;

        setHydrated(true);
        setServerRevision(null);
        setSaveBlockedByConflict(false);
        setSyncStatus({
          phase: "error",
          message: "SQLite indisponible",
          detail:
            error instanceof Error
              ? error.message
              : "Impossible d'ouvrir la base partagee.",
          lastSyncedAt: null,
        });
      }
    };

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [refreshVersion]);

  useEffect(() => {
    if (!hydrated || serverRevision === null || saveBlockedByConflict) {
      return;
    }

    const serialized = JSON.stringify(state);
    if (serialized === lastSavedSerialized) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSyncStatus({
        phase: "syncing",
        message: "Enregistrement SQLite",
        detail: `Mise a jour de ${storageLabel}...`,
        lastSyncedAt: null,
      });

      try {
        const snapshot = await saveEncartsSnapshot(serverRevision, state);
        if (cancelled) return;

        setLastSavedSerialized(serialized);
        setServerRevision(snapshot.revision);
        setStorageLabel(snapshot.storageLabel);
        setSaveBlockedByConflict(false);
        setSyncStatus({
          phase: "ready",
          message: "SQLite synchronise",
          detail: `Fichier: ${snapshot.storageLabel}`,
          lastSyncedAt: snapshot.state.updatedAt,
        });
      } catch (error) {
        if (cancelled) return;

        if (error instanceof EncartsConflictError) {
          setStorageLabel(error.snapshot.storageLabel);
          setSaveBlockedByConflict(true);
          setSyncStatus({
            phase: "error",
            message: "Conflit SQLite",
            detail:
              "Une autre session a modifie la base. Rechargez avant de poursuivre.",
            lastSyncedAt: error.snapshot.state.updatedAt,
          });
          return;
        }

        setSyncStatus({
          phase: "error",
          message: "Enregistrement SQLite echoue",
          detail:
            error instanceof Error
              ? error.message
              : "Les changements restent uniquement dans l'onglet.",
          lastSyncedAt: null,
        });
      }
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    hydrated,
    lastSavedSerialized,
    saveBlockedByConflict,
    serverRevision,
    state,
    storageLabel,
  ]);

  const serializedState = useMemo(() => JSON.stringify(state), [state]);
  const hasUnsavedChanges =
    hydrated &&
    serverRevision !== null &&
    serializedState !== lastSavedSerialized;
  const selectedContacts = useMemo(
    () => state.contacts.filter((contact) => contact.selected),
    [state.contacts],
  );
  const referenceLine = useMemo(
    () =>
      [state.copy.referenceLabel.trim(), state.offerReference.trim()]
        .filter(Boolean)
        .join(" "),
    [state.copy.referenceLabel, state.offerReference],
  );

  function patchState(
    updater: (current: EncartsDiffusionState) => EncartsDiffusionState,
  ) {
    setState((current) => {
      const nextState = updater(current);
      return { ...nextState, updatedAt: nowIso() };
    });
  }

  function updateCopy<K extends keyof EncartEditableCopy>(
    key: K,
    value: EncartEditableCopy[K],
  ) {
    patchState((current) => ({
      ...current,
      copy: { ...current.copy, [key]: value },
    }));
  }

  function updateOfferReference(value: string) {
    patchState((current) => ({
      ...current,
      offerReference: value,
    }));
  }

  function toggleContact(id: number) {
    const timestamp = nowIso();
    patchState((current) => ({
      ...current,
      contacts: current.contacts.map((contact) =>
        contact.id === id
          ? { ...contact, selected: !contact.selected, updatedAt: timestamp }
          : contact,
      ),
    }));
  }

  function updateContact(id: number, patch: Partial<Contact>) {
    const timestamp = nowIso();
    patchState((current) => ({
      ...current,
      contacts: current.contacts.map((contact) =>
        contact.id === id
          ? { ...contact, ...patch, updatedAt: timestamp }
          : contact,
      ),
    }));
  }

  function resetTemplateText() {
    const defaults = buildDefaultState();

    patchState((current) => ({
      ...current,
      copy: defaults.copy,
      offerReference: defaults.offerReference,
    }));
    setIsAddFormOpen(false);
    setExpandedContactId(null);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
  }

  function addContact() {
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const timestamp = nowIso();
    const id = nextIdRef.current++;

    patchState((current) => ({
      ...current,
      contacts: [
        ...current.contacts,
        {
          id,
          name: trimmedName,
          phone: newPhone.trim(),
          email: newEmail.trim(),
          selected: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }));
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setIsAddFormOpen(false);
    setExpandedContactId(id);
  }

  function removeContact(id: number) {
    patchState((current) => ({
      ...current,
      contacts: current.contacts.filter((contact) => contact.id !== id),
    }));
    setExpandedContactId((current) => (current === id ? null : current));
  }

  function toggleContactEditor(id: number) {
    setExpandedContactId((current) => (current === id ? null : id));
  }

  function syncBadgeClassName() {
    if (syncStatus.phase === "error") return styles.syncError;
    if (syncStatus.phase === "syncing" || syncStatus.phase === "loading") {
      return styles.syncSyncing;
    }
    return styles.syncReady;
  }

  function reloadSnapshot() {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Des modifications locales ne sont pas encore enregistrees. Recharger la base va ecraser cet etat local. Continuer ?",
      )
    ) {
      return;
    }

    setRefreshVersion((current) => current + 1);
  }

  async function exportPNG() {
    if (!flyerRef.current || isExporting) return;

    setIsExporting(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(flyerRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#16314d",
        logging: false,
      });

      const addressPart = sanitizeFilePart(
        state.copy.address.replace(/\s+/g, " "),
      );
      const referencePart = sanitizeFilePart(state.offerReference);
      const suffix = referencePart || addressPart || "encart";
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Newmark_Encart_${suffix}.png`;
      link.click();
    } catch (error) {
      console.error("Encart export failed", error);
      window.alert("Erreur lors de l'export PNG. Veuillez reessayer.");
    } finally {
      setIsExporting(false);
    }
  }

  if (!hydrated) {
    return (
      <section className={styles.page}>
        <div className={styles.loadingState}>
          <LoaderCircle className={styles.loadingSpinner} />
          Chargement de l&apos;application...
        </div>
      </section>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>D08 / CU1</p>
          <h1 className={styles.title}>Generateur d&apos;encarts diffusion</h1>
          <p className={styles.description}>
            Miniapp Next dediee, sortie du hub statique. Les contenus et les
            contacts sont maintenant charges et synchronises via une API serveur
            minimale et une base SQLite partagee sur cette instance.
          </p>
        </div>
        <div className={styles.heroMeta}>
          <span>PNG haute definition</span>
          <span>Tout le texte est editable</span>
          <span>
            {serverRevision === null
              ? "SQLite indisponible"
              : `Revision ${serverRevision}`}
          </span>
        </div>
      </section>

      <div className={styles.shell}>
        <aside className={styles.editorPanel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelEyebrow}>Editeur</p>
              <h2 className={styles.panelTitle}>Contenu de l&apos;encart</h2>
            </div>
            <div className={styles.panelActions}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={reloadSnapshot}
              >
                <RefreshCw size={14} />
                Recharger SQLite
              </button>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={resetTemplateText}
              >
                <RefreshCw size={14} />
                Reinitialiser le texte
              </button>
            </div>
          </div>

          <div className={styles.syncBanner}>
            <div className={styles.syncCopy}>
              <p className={styles.syncTitle}>SQLite</p>
              <p className={styles.syncDetail}>{syncStatus.detail}</p>
              <p className={styles.syncDetail}>
                Revision: {serverRevision ?? "non chargee"}
              </p>
              <p className={styles.syncDetail}>Base: {storageLabel}</p>
              {hasUnsavedChanges ? (
                <p className={styles.syncDetail}>
                  Modifications locales en attente d&apos;enregistrement.
                </p>
              ) : null}
              {syncStatus.lastSyncedAt ? (
                <p className={styles.syncDetail}>
                  Derniere synchro:{" "}
                  {new Date(syncStatus.lastSyncedAt).toLocaleString("fr-FR")}
                </p>
              ) : null}
            </div>
            <div
              className={`${styles.syncBadge} ${syncBadgeClassName()}`}
              aria-live="polite"
            >
              {syncStatus.phase === "syncing" || syncStatus.phase === "loading" ? (
                <LoaderCircle className={styles.loadingSpinner} size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
              {syncStatus.message}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="encart-address">Adresse du bien</label>
            <textarea
              id="encart-address"
              value={state.copy.address}
              onChange={(event) => updateCopy("address", event.target.value)}
              rows={4}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="encart-info">Informations complementaires</label>
            <textarea
              id="encart-info"
              value={state.copy.info}
              onChange={(event) => updateCopy("info", event.target.value)}
              rows={4}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="encart-reference">Reference offre</label>
            <input
              id="encart-reference"
              type="text"
              value={state.offerReference}
              onChange={(event) => updateOfferReference(event.target.value)}
            />
          </div>

          <div className={styles.editorSection}>
            <button
              type="button"
              className={styles.sectionToggle}
              onClick={() => setIsTextEditorOpen((current) => !current)}
              aria-expanded={isTextEditorOpen}
            >
              <span className={styles.sectionToggleIcon}>
                {isTextEditorOpen ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </span>
              <span className={styles.sectionTitle}>Textes additionnels</span>
            </button>

            {isTextEditorOpen ? (
              <div className={styles.sectionBody}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="encart-salutation">Salutation</label>
                  <textarea
                    id="encart-salutation"
                    value={state.copy.salutation}
                    onChange={(event) =>
                      updateCopy("salutation", event.target.value)
                    }
                    rows={2}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="encart-intro">Introduction</label>
                  <textarea
                    id="encart-intro"
                    value={state.copy.intro}
                    onChange={(event) => updateCopy("intro", event.target.value)}
                    rows={4}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="encart-tail">Phrase apres les contacts</label>
                  <textarea
                    id="encart-tail"
                    value={state.copy.contactTail}
                    onChange={(event) =>
                      updateCopy("contactTail", event.target.value)
                    }
                    rows={3}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="encart-empty-message">
                    Message si aucun contact
                  </label>
                  <textarea
                    id="encart-empty-message"
                    value={state.copy.emptyContactsMessage}
                    onChange={(event) =>
                      updateCopy("emptyContactsMessage", event.target.value)
                    }
                    rows={2}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="encart-closing">Paragraphe de conclusion</label>
                  <textarea
                    id="encart-closing"
                    value={state.copy.closing}
                    onChange={(event) => updateCopy("closing", event.target.value)}
                    rows={4}
                  />
                </div>

                <div className={styles.fieldGrid}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="encart-cordiality">Formule finale</label>
                    <input
                      id="encart-cordiality"
                      type="text"
                      value={state.copy.cordiality}
                      onChange={(event) =>
                        updateCopy("cordiality", event.target.value)
                      }
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="encart-reference-label">
                      Libelle reference
                    </label>
                    <input
                      id="encart-reference-label"
                      type="text"
                      value={state.copy.referenceLabel}
                      onChange={(event) =>
                        updateCopy("referenceLabel", event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.inlineLabel}>
              <label>Contacts stockes</label>
              <span>{selectedContacts.length} selectionne(s)</span>
            </div>
            <div className={styles.contactsList}>
              {state.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`${styles.contactCard} ${
                    contact.selected ? styles.contactCardSelected : ""
                  }`}
                >
                  <div className={styles.contactRow}>
                    <button
                      type="button"
                      className={styles.checkboxButton}
                      onClick={() => toggleContact(contact.id)}
                    >
                      <span className={styles.checkbox}>
                        {contact.selected ? "✓" : ""}
                      </span>
                      <span className={styles.contactState}>
                        {contact.selected ? "Affiche" : "Masque"}
                      </span>
                    </button>

                    <div className={styles.contactSummary}>
                      <p className={styles.contactName}>
                        {contact.name || "Contact sans nom"}
                      </p>
                      <p className={styles.contactDetails}>
                        {formatContactDetails(contact) || "Aucune coordonnee"}
                      </p>
                    </div>

                    <div className={styles.contactActions}>
                      <button
                        type="button"
                        className={styles.compactIconButton}
                        onClick={() => toggleContactEditor(contact.id)}
                        aria-expanded={expandedContactId === contact.id}
                        aria-label={
                          expandedContactId === contact.id
                            ? `Refermer l'edition de ${contact.name || "ce contact"}`
                            : `Editer ${contact.name || "ce contact"}`
                        }
                      >
                        {expandedContactId === contact.id ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>

                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => removeContact(contact.id)}
                        aria-label={`Supprimer ${contact.name || "ce contact"}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {expandedContactId === contact.id ? (
                    <div className={styles.contactFields}>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(event) =>
                          updateContact(contact.id, { name: event.target.value })
                        }
                        placeholder="Prenom NOM"
                      />
                      <input
                        type="text"
                        value={contact.phone}
                        onChange={(event) =>
                          updateContact(contact.id, { phone: event.target.value })
                        }
                        placeholder="06 XX XX XX XX"
                      />
                      <input
                        type="text"
                        value={contact.email}
                        onChange={(event) =>
                          updateContact(contact.id, { email: event.target.value })
                        }
                        placeholder="email@nmrk.com"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {!isAddFormOpen ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setIsAddFormOpen(true)}
              >
                <Plus size={15} />
                Ajouter un contact
              </button>
            ) : (
              <div className={styles.addForm}>
                <p className={styles.sectionTitle}>Ajouter un contact</p>
                <input
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Prenom NOM"
                />
                <input
                  type="text"
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                  placeholder="06 XX XX XX XX"
                />
                <input
                  type="text"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="email@nmrk.com"
                />
                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={addContact}
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => setIsAddFormOpen(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.exportButton}
            onClick={exportPNG}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Sparkles size={16} />
                Generation...
              </>
            ) : (
              <>
                <Download size={16} />
                Exporter en PNG
              </>
            )}
          </button>
        </aside>

        <section className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <div>
              <p className={styles.panelEyebrow}>Apercu</p>
              <h2 className={styles.panelTitle}>Encart genere</h2>
            </div>
            <p className={styles.previewHint}>
              L&apos;export capture uniquement l&apos;encart ci-dessous.
            </p>
          </div>

          <div className={styles.previewStage}>
            <div ref={flyerRef} className={styles.flyer}>
              <div className={styles.flyerHeader}>
                <Image
                  src="/newmark-logo-white.svg"
                  alt="Newmark"
                  width={180}
                  height={40}
                  priority
                  unoptimized
                  className={styles.logo}
                />
                <p className={styles.salutation}>
                  {state.copy.salutation.trim() || (
                    <span className={styles.placeholder}>Salutation</span>
                  )}
                </p>
                <p className={styles.intro}>
                  {state.copy.intro.trim() || (
                    <span className={styles.placeholder}>Introduction</span>
                  )}
                </p>
              </div>

              <div className={styles.addressBlock}>
                <div className={styles.addressText}>
                  {state.copy.address.trim() || (
                    <span className={styles.placeholder}>Adresse du bien</span>
                  )}
                </div>
              </div>

              <div className={styles.infoBlock}>
                <div className={styles.infoText}>
                  {state.copy.info.trim() || (
                    <span className={styles.placeholder}>
                      Informations complementaires
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.contactsBlock}>
                {selectedContacts.length > 0 ? (
                  <>
                    {selectedContacts.map((contact, index) => {
                      const details = formatContactDetails(contact);
                      return (
                        <div key={contact.id} className={styles.contactLine}>
                          {contact.name}
                          {details ? ` (${details})` : ""}
                          {index < selectedContacts.length - 1 ? " et" : ""}
                        </div>
                      );
                    })}
                    <div className={styles.contactTail}>
                      {state.copy.contactTail.trim() || (
                        <span className={styles.placeholder}>
                          Phrase apres les contacts
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={styles.placeholder}>
                    {state.copy.emptyContactsMessage.trim() ||
                      "Selectionnez au moins un contact."}
                  </div>
                )}
              </div>

              <div className={styles.flyerFooter}>
                <p className={styles.closing}>
                  {state.copy.closing.trim() || (
                    <span className={styles.placeholder}>
                      Paragraphe de conclusion
                    </span>
                  )}
                </p>
                <p className={styles.cordiality}>
                  {state.copy.cordiality.trim() || (
                    <span className={styles.placeholder}>Formule finale</span>
                  )}
                </p>
                <p className={styles.reference}>
                  {referenceLine || (
                    <span className={styles.placeholder}>Reference</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
