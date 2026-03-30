export type Contact = {
  id: number;
  name: string;
  phone: string;
  email: string;
  selected: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EncartEditableCopy = {
  salutation: string;
  intro: string;
  address: string;
  info: string;
  contactTail: string;
  emptyContactsMessage: string;
  closing: string;
  cordiality: string;
  referenceLabel: string;
};

export type EncartsDiffusionState = {
  version: 1;
  copy: EncartEditableCopy;
  offerReference: string;
  contacts: Contact[];
  updatedAt: string;
};

type ContactSeed = Omit<Contact, "createdAt" | "updatedAt">;

export const ENCART_COPY_FIELD_KEYS = [
  "salutation",
  "intro",
  "address",
  "info",
  "contactTail",
  "emptyContactsMessage",
  "closing",
  "cordiality",
  "referenceLabel",
] as const;

export const DEFAULT_COPY: EncartEditableCopy = {
  salutation: "Chere Consœur, Cher Confrere,",
  intro:
    "Nous avons le plaisir de vous transmettre la mise a jour des locaux que nous sommes charges de commercialiser situes au :",
  address: "64/68 rue du Dessous des Berges,\n75013 Paris",
  info: "MAJ : nouvelles surfaces de 915 m2 au R+2 et 561 m2 au R+6",
  contactTail:
    "se tiennent a votre disposition pour tout complement d'informations et/ou visites.",
  emptyContactsMessage: "Selectionnez au moins un contact.",
  closing:
    "Dans l'attente de pouvoir collaborer avec vous, je vous prie d'agreer, chere Consœur, cher Confrere, l'expression de nos salutations distinguees.",
  cordiality: "Cordialement,",
  referenceLabel: "Offre reference :",
};

export const DEFAULT_REFERENCE = "1419828";

const DEFAULT_CONTACTS_SEED: ContactSeed[] = [
  {
    id: 1,
    name: "Jules GALLAY",
    phone: "06 32 45 99 11",
    email: "jules.gallay@nmrk.com",
    selected: true,
  },
  {
    id: 2,
    name: "Steeve BENDAVID",
    phone: "06 13 93 49 91",
    email: "steeve.bendavid@nmrk.com",
    selected: true,
  },
  {
    id: 3,
    name: "Arthur SAUNIER",
    phone: "06 XX XX XX XX",
    email: "arthur.saunier@nmrk.com",
    selected: false,
  },
  {
    id: 4,
    name: "Jean-Baptiste HUIBAN",
    phone: "06 XX XX XX XX",
    email: "jb.huiban@nmrk.com",
    selected: false,
  },
];

function cloneContact(contact: Contact): Contact {
  return { ...contact };
}

function cloneCopy(copy: EncartEditableCopy): EncartEditableCopy {
  return { ...copy };
}

export function cloneEncartsDiffusionState(
  state: EncartsDiffusionState,
): EncartsDiffusionState {
  return {
    version: 1,
    copy: cloneCopy(state.copy),
    offerReference: state.offerReference,
    contacts: state.contacts.map(cloneContact),
    updatedAt: state.updatedAt,
  };
}

export function buildDefaultState(): EncartsDiffusionState {
  const timestamp = new Date().toISOString();

  return {
    version: 1,
    copy: cloneCopy(DEFAULT_COPY),
    offerReference: DEFAULT_REFERENCE,
    contacts: DEFAULT_CONTACTS_SEED.map((contact) => ({
      ...contact,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    updatedAt: timestamp,
  };
}

function normalizeContacts(raw: unknown, defaults: Contact[]): Contact[] {
  if (!Array.isArray(raw)) {
    return defaults.map(cloneContact);
  }

  return raw
    .filter(
      (contact): contact is Partial<Contact> =>
        typeof contact === "object" && contact !== null,
    )
    .map((contact, index) => {
      const timestamp = new Date().toISOString();

      return {
        id: typeof contact.id === "number" ? contact.id : index + 1,
        name: typeof contact.name === "string" ? contact.name.trim() : "",
        phone: typeof contact.phone === "string" ? contact.phone : "",
        email: typeof contact.email === "string" ? contact.email : "",
        selected: Boolean(contact.selected),
        createdAt:
          typeof contact.createdAt === "string" ? contact.createdAt : timestamp,
        updatedAt:
          typeof contact.updatedAt === "string" ? contact.updatedAt : timestamp,
      };
    })
    .filter((contact) => contact.name.length > 0);
}

export function normalizeEncartsDiffusionState(
  raw: unknown,
  defaults: EncartsDiffusionState,
): EncartsDiffusionState {
  if (typeof raw !== "object" || raw === null) {
    return cloneEncartsDiffusionState(defaults);
  }

  const parsed = raw as Partial<EncartsDiffusionState> & {
    copy?: Partial<EncartEditableCopy>;
  };

  const defaultCopy = defaults.copy;
  const copy = {
    salutation:
      typeof parsed.copy?.salutation === "string"
        ? parsed.copy.salutation
        : defaultCopy.salutation,
    intro:
      typeof parsed.copy?.intro === "string"
        ? parsed.copy.intro
        : defaultCopy.intro,
    address:
      typeof parsed.copy?.address === "string"
        ? parsed.copy.address
        : defaultCopy.address,
    info:
      typeof parsed.copy?.info === "string" ? parsed.copy.info : defaultCopy.info,
    contactTail:
      typeof parsed.copy?.contactTail === "string"
        ? parsed.copy.contactTail
        : defaultCopy.contactTail,
    emptyContactsMessage:
      typeof parsed.copy?.emptyContactsMessage === "string"
        ? parsed.copy.emptyContactsMessage
        : defaultCopy.emptyContactsMessage,
    closing:
      typeof parsed.copy?.closing === "string"
        ? parsed.copy.closing
        : defaultCopy.closing,
    cordiality:
      typeof parsed.copy?.cordiality === "string"
        ? parsed.copy.cordiality
        : defaultCopy.cordiality,
    referenceLabel:
      typeof parsed.copy?.referenceLabel === "string"
        ? parsed.copy.referenceLabel
        : defaultCopy.referenceLabel,
  };

  return {
    version: 1,
    copy,
    offerReference:
      typeof parsed.offerReference === "string"
        ? parsed.offerReference
        : defaults.offerReference,
    contacts: normalizeContacts(parsed.contacts, defaults.contacts),
    updatedAt:
      typeof parsed.updatedAt === "string"
        ? parsed.updatedAt
        : defaults.updatedAt,
  };
}
